#!/usr/bin/env python3
"""Docling ingest CLI: download PDF, run Docling, store directly in database."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional

# Ensure imports work when run as script
# INGESTION_ROOT points to packages/ingestion
INGESTION_ROOT = Path(__file__).resolve().parents[2]
COLLECTORS_ROOT = INGESTION_ROOT / "collectors"
if str(COLLECTORS_ROOT) not in sys.path:
    sys.path.insert(0, str(COLLECTORS_ROOT))

import requests
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
from docling_core.types.doc import DoclingDocument

# Import shared utilities from collectors/shared
from shared.env import load_env
from shared.hash_utils import compute_sha256_from_file
from shared.db_cache import (
    has_content_changed,
    process_source_update,
)
from pdf.table_extractor import extract_clean_tables
from pdf.chunk_builder import build_semantic_chunks

# Load environment variables from .env.local or .env
load_env()


LOG = logging.getLogger("docling_ingest")


def _ensure_single_threaded() -> None:
    import docling  # noqa: F401
    from docling.datamodel.settings import settings  # type: ignore

    settings.perf.doc_batch_size = 1
    settings.perf.doc_batch_concurrency = 1


def _build_converter() -> DocumentConverter:
    pipeline_options = PdfPipelineOptions(do_ocr=False, do_table_structure=True)
    pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


def _iter_chunks(handle: Any, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    while True:
        part = handle.read(chunk_size)
        if not part:
            break
        yield part


def _http_headers(user_agent: Optional[str]) -> Dict[str, str]:
    return {"User-Agent": user_agent or "GDH-DoclingIngest/2.0"}


def _download_pdf(
    url: str,
    destination: Path,
    headers: Optional[Dict[str, str]] = None,
    force: bool = False,
) -> tuple[str, int]:
    """Download PDF and return (sha256, file_size)."""
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and not force:
        LOG.info("Using cached PDF: %s", destination)
        sha256 = compute_sha256_from_file(destination)
        file_size = destination.stat().st_size
        return sha256, file_size

    LOG.info("Downloading PDF from %s", url)
    import hashlib

    hasher = hashlib.sha256()
    file_size = 0
    with requests.get(url, stream=True, timeout=90, headers=headers) as resp:
        resp.raise_for_status()
        with destination.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                fh.write(chunk)
                hasher.update(chunk)
                file_size += len(chunk)
    return hasher.hexdigest(), file_size


def _convert_pdf(converter: DocumentConverter, pdf_path: Path) -> DoclingDocument:
    result = converter.convert(str(pdf_path))
    if result.status.name not in {"SUCCESS", "PARTIAL_SUCCESS"}:
        raise RuntimeError(f"Docling convert failed with status {result.status}")
    return result.document


def _build_source_metadata(
    source: Dict[str, Any],
    doc: DoclingDocument,
    sha256: str,
    file_size: int,
    raw_doc: Dict[str, Any],
) -> Dict[str, Any]:
    """Build metadata for DocumentSource table."""
    # Get page count
    try:
        page_count = doc.num_pages()
    except (AttributeError, TypeError):
        pages = raw_doc.get("pages", [])
        page_count = len(pages) if isinstance(pages, list) else 0

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
        "page_count": page_count,
        "manifest": {
            "extractionMethod": "docling",
            "generator": "docling_ingest@2.0.0",
            "ingestedAt": datetime.now(timezone.utc).isoformat(),
        },
    }


def _build_chunks_for_db(
    source_id: str,
    raw_doc: Dict[str, Any],
    meta: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Build chunks in format ready for database insertion."""
    # Build document with text segments and tables
    # Docling exports to dict with 'texts' containing text items
    text_segments = raw_doc.get("texts", [])

    LOG.debug(f"Raw doc keys: {raw_doc.keys()}")
    LOG.debug(f"Text segments count: {len(text_segments)}")

    doc_for_chunking = {
        "meta": meta,
        "text_segments": text_segments,
        "tables": extract_clean_tables(raw_doc),
    }

    # Generate semantic chunks
    chunks = build_semantic_chunks(doc_for_chunking)
    LOG.info(f"Generated {len(chunks)} chunks for {source_id}")

    # Convert to database format
    db_chunks = []
    for chunk in chunks:
        # Ensure pageStart and pageEnd are not None
        page_start = chunk.get("pageStart")
        page_end = chunk.get("pageEnd")
        if page_start is None:
            page_start = chunk.get("firstPage", 0)
        if page_end is None:
            page_end = page_start if page_start is not None else 0
        if page_start is None:
            page_start = 0

        # For table chunks, make tableId unique by adding row index
        table_id = chunk.get("tableId")
        if table_id and chunk.get("chunkType") == "table_row":
            table_id = f"{table_id}:row{chunk['order']}"

        db_chunk = {
            "chunkId": f"{source_id}:{chunk['order']:05d}",
            "text": chunk.get("text", ""),
            "tokenCount": len(chunk.get("text", "").split()),  # Simple token estimate
            "pageStart": page_start,
            "pageEnd": page_end,
            "chunkType": chunk.get("chunkType", "section"),
            "sectionPath": chunk.get("sectionPath"),
            "isTable": chunk.get("chunkType") == "table_row",
            "tableId": table_id,
            "viewerAnchor": chunk.get("anchor"),
            "metadata": {
                k: v
                for k, v in chunk.items()
                if k
                not in {
                    "text",
                    "chunkType",
                    "pageStart",
                    "pageEnd",
                    "sectionPath",
                    "tableId",
                    "anchor",
                    "order",
                    "firstPage",
                }
            },
            "order": chunk["order"],
        }
        db_chunks.append(db_chunk)

    return db_chunks


def _process_source(
    converter: DocumentConverter,
    source: Dict[str, Any],
    *,
    cache_dir: Path,
    force_download: bool,
    user_agent: Optional[str],
    skip_unchanged: bool,
) -> None:
    """Process a single PDF source with database-backed caching."""
    source_id = source["id"]
    pdf_cache_path = cache_dir / f"{source_id}.pdf"

    # Download PDF and get hash
    sha256, file_size = _download_pdf(
        url=source["url"],
        destination=pdf_cache_path,
        headers=_http_headers(user_agent),
        force=force_download,
    )

    # Check if content has changed
    if skip_unchanged and not has_content_changed(source_id, sha256):
        LOG.info("Content unchanged for %s (hash: %s), skipping", source_id, sha256[:8])
        return

    LOG.info("Processing %s (new or changed content)", source_id)

    # Convert PDF with Docling
    doc = _convert_pdf(converter, pdf_cache_path)
    raw_doc = doc.export_to_dict()

    # Build source metadata
    source_metadata = _build_source_metadata(source, doc, sha256, file_size, raw_doc)

    # Build chunks for database
    chunks = _build_chunks_for_db(source_id, raw_doc, source_metadata)

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
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in sources file {path}") from exc
    if not isinstance(data, list):
        raise RuntimeError(f"Sources file {path} must contain a JSON array")
    return [item for item in data if isinstance(item, dict)]


def _parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GDH Docling ingest CLI v2.0")
    parser.add_argument(
        "--sources",
        dest="sources",
        default=INGESTION_ROOT / "config" / "pdf.json",
        type=Path,
        help="Path to JSON file with sources",
    )
    parser.add_argument(
        "--cache-dir",
        dest="cache_dir",
        default=INGESTION_ROOT / "storage" / "cache" / "pdf",
        type=Path,
        help="Directory for downloaded PDFs",
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
        help="Force re-download even if cached",
    )
    parser.add_argument(
        "--force-process",
        dest="skip_unchanged",
        action="store_false",
        help="Process all sources even if content hash unchanged",
    )
    parser.add_argument(
        "--user-agent",
        dest="user_agent",
        default=None,
        help="User-Agent override for HTTP requests",
    )
    parser.add_argument(
        "--log-level",
        dest="log_level",
        default="INFO",
        help="Log level (INFO, DEBUG, etc.)",
    )
    parser.set_defaults(skip_unchanged=True)
    return parser.parse_args(argv)


def _setup_logging(level_str: str) -> None:
    level = getattr(logging, level_str.upper(), logging.INFO)
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(message)s")


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = _parse_args(argv)
    _setup_logging(args.log_level)

    if not args.sources.exists():
        LOG.error("Sources file %s does not exist", args.sources)
        return 2

    _ensure_single_threaded()
    converter = _build_converter()

    sources = _load_sources(args.sources)
    processed = 0
    skipped = 0
    exit_code = 0

    for source in sources:
        if args.limit is not None and processed >= args.limit:
            break
        source_id = source.get("id")
        if not source_id or not source.get("url"):
            LOG.warning("Skipping source without id or url: %s", source)
            continue
        try:
            initial_processed = processed
            _process_source(
                converter,
                source,
                cache_dir=args.cache_dir,
                force_download=args.force_download,
                user_agent=args.user_agent,
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
