#!/usr/bin/env python3
"""Web scraper for HTML content ingestion with database-backed caching."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

# Ensure imports work when run as script
# INGESTION_ROOT points to packages/ingestion
INGESTION_ROOT = Path(__file__).resolve().parents[2]
COLLECTORS_ROOT = INGESTION_ROOT / "collectors"
if str(COLLECTORS_ROOT) not in sys.path:
    sys.path.insert(0, str(COLLECTORS_ROOT))

import requests
from bs4 import BeautifulSoup

# Import shared utilities from collectors/shared
from shared.env import load_env
from shared.hash_utils import compute_sha256_from_file
from shared.db_cache import (
    has_content_changed,
    process_source_update,
)
from web.chunk_builder import build_web_chunks

# Load environment variables from .env.local or .env
load_env()


LOG = logging.getLogger("web_scraper")


def _fetch_html(
    url: str,
    destination: Path,
    force: bool = False,
) -> tuple[str, int]:
    """Fetch HTML page and return (sha256, file_size)."""
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and not force:
        LOG.info("Using cached HTML: %s", destination)
        sha256 = compute_sha256_from_file(destination)
        file_size = destination.stat().st_size
        return sha256, file_size

    LOG.info("Fetching HTML from %s", url)

    response = requests.get(
        url,
        timeout=30,
        headers={"User-Agent": "GDH-Chatbot-WebScraper/2.0"},
    )
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"

    # Save to cache
    html_content = response.text
    destination.write_text(html_content, encoding="utf-8")

    # Compute hash
    sha256 = compute_sha256_from_file(destination)
    file_size = destination.stat().st_size

    LOG.info("Cached HTML to %s", destination)

    return sha256, file_size


def _extract_content(html_path: Path, base_url: str) -> tuple[BeautifulSoup, str]:
    """Parse HTML and extract main content."""
    html = html_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")

    # Extract main content
    main_content = soup.find("main") or soup.find("article") or soup.body

    if not main_content:
        LOG.warning("No main content found, using full body")
        main_content = soup.body or soup

    return main_content, html


def _build_source_metadata(
    source: Dict[str, Any],
    sha256: str,
    file_size: int,
) -> Dict[str, Any]:
    """Build metadata for DocumentSource table."""
    # Parse published_at to datetime if string
    published_at = source.get("published_at")
    if published_at and isinstance(published_at, str):
        try:
            published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            published_at = None

    return {
        "title": source.get("title", "Untitled"),
        "url": source.get("url", ""),
        "category": source.get("category", "uncategorized"),
        "tags": source.get("tags", []),
        "description": source.get("description"),
        "published_at": published_at,
        "notes": source.get("notes"),
        "bytes": file_size,
        "page_count": 0,  # Web pages don't have pages
        "manifest": {
            "extractionMethod": "beautifulsoup",
            "generator": "web_scraper@2.0.0",
            "ingestedAt": datetime.now(timezone.utc).isoformat(),
        },
    }


def _build_chunks_for_db(
    source_id: str,
    soup: BeautifulSoup,
    base_url: str,
    meta: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Build chunks in format ready for database insertion."""
    # Generate web chunks (returns Chunk objects)
    chunks = build_web_chunks(soup, meta, base_url=base_url)

    # Convert to database format
    db_chunks = []
    for chunk in chunks:
        chunk_dict = chunk.to_dict()  # Convert Chunk object to dict

        # Build metadata: use the nested "metadata" from chunk_dict (contains structuredLinks, etc.)
        # and add other top-level fields like "title"
        chunk_metadata = chunk_dict.get("metadata", {})
        # Add title if present at top level
        if "title" in chunk_dict:
            chunk_metadata["title"] = chunk_dict["title"]

        db_chunk = {
            "chunkId": f"{source_id}:{chunk.order:05d}",
            "text": chunk.text or "",
            "tokenCount": len((chunk.text or "").split()),  # Simple token estimate
            "pageStart": 0,  # Web pages don't have pages
            "pageEnd": 0,
            "chunkType": chunk.chunk_type,
            "sectionPath": chunk.section_path,
            "isTable": False,
            "tableId": None,
            "viewerAnchor": chunk.anchor,
            "metadata": chunk_metadata,
            "order": chunk.order,
        }
        db_chunks.append(db_chunk)

    return db_chunks


def _process_source(
    source: Dict[str, Any],
    *,
    cache_dir: Path,
    force_download: bool,
    skip_unchanged: bool,
) -> None:
    """Process a single web source with database-backed caching."""
    source_id = source["id"]
    html_cache_path = cache_dir / f"{source_id}.html"

    # Fetch HTML and get hash
    sha256, file_size = _fetch_html(
        url=source["url"],
        destination=html_cache_path,
        force=force_download,
    )

    # Check if content has changed
    if skip_unchanged and not has_content_changed(source_id, sha256):
        LOG.info("Content unchanged for %s (hash: %s), skipping", source_id, sha256[:8])
        return

    LOG.info("Processing %s (new or changed content)", source_id)

    # Extract content
    main_content, html = _extract_content(html_cache_path, source["url"])

    # Build source metadata
    source_metadata = _build_source_metadata(source, sha256, file_size)

    # Build chunks for database
    chunks = _build_chunks_for_db(source_id, main_content, source["url"], source_metadata)

    # Store directly in database
    source_uuid, chunks_count = process_source_update(
        source_id=source_id,
        source_metadata=source_metadata,
        chunks=chunks,
        sha256=sha256,
    )

    LOG.info(
        "Stored source %s (UUID: %s) with %d chunks",
        source_id,
        source_uuid,
        chunks_count,
    )


def _load_sources(path: Path) -> List[Dict[str, Any]]:
    """Load sources from JSON file."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in sources file {path}") from exc

    if not isinstance(data, list):
        raise RuntimeError(f"Sources file {path} must contain a JSON array")

    return [item for item in data if isinstance(item, dict)]


def _parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GDH Web Scraper v2.0")
    parser.add_argument(
        "--sources",
        dest="sources",
        default=INGESTION_ROOT / "config" / "web.json",
        type=Path,
        help="Path to JSON file with web sources",
    )
    parser.add_argument(
        "--cache-dir",
        dest="cache_dir",
        default=INGESTION_ROOT / "storage" / "cache" / "web",
        type=Path,
        help="Cache directory for downloaded HTML",
    )
    parser.add_argument(
        "--limit",
        dest="limit",
        type=int,
        default=None,
        help="Max number of sources to process",
    )
    parser.add_argument(
        "--force-download",
        dest="force_download",
        action="store_true",
        help="Force re-fetch even if cached",
    )
    parser.add_argument(
        "--force-process",
        dest="skip_unchanged",
        action="store_false",
        help="Process all sources even if content hash unchanged",
    )
    parser.add_argument(
        "--log-level",
        dest="log_level",
        default="INFO",
        help="Log level (INFO, DEBUG, WARNING, ERROR)",
    )
    parser.set_defaults(skip_unchanged=True)
    return parser.parse_args(argv)


def _setup_logging(level_str: str) -> None:
    level = getattr(logging, level_str.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = _parse_args(argv)
    _setup_logging(args.log_level)

    if not args.sources.exists():
        LOG.error("Sources file %s does not exist", args.sources)
        return 2

    # Load sources
    sources_data = _load_sources(args.sources)
    processed = 0
    skipped = 0
    exit_code = 0

    for source in sources_data:
        if args.limit is not None and processed >= args.limit:
            break

        source_id = source.get("id")
        if not source_id or not source.get("url"):
            LOG.warning("Skipping source without id or url: %s", source)
            continue

        try:
            _process_source(
                source,
                cache_dir=args.cache_dir,
                force_download=args.force_download,
                skip_unchanged=args.skip_unchanged,
            )
            processed += 1

        except Exception as exc:
            exit_code = 1
            LOG.exception("Processing failed for %s: %s", source_id, exc)

    LOG.info("Processed: %d sources, Skipped: %d (unchanged)", processed, skipped)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
