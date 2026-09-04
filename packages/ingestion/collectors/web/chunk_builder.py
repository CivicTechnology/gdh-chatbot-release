"""Build semantic chunks from HTML content."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add data-collection directory to path for shared imports
DATA_COLLECTION_ROOT = Path(__file__).resolve().parents[1]
if str(DATA_COLLECTION_ROOT) not in sys.path:
    sys.path.insert(0, str(DATA_COLLECTION_ROOT))

from bs4 import BeautifulSoup, Tag, NavigableString

from shared.base import Chunk, ChunkMetadata
from shared.chunk_utils import (
    format_list_items,
    validate_chunk,
    extract_links_from_html,
    categorize_links,
    filter_valid_links,
)


def build_web_chunks(
    soup: Tag | BeautifulSoup,
    meta: Dict[str, Any],
    *,
    base_url: str,
    validate_links: bool = False,
) -> List[Chunk]:
    """
    Build semantic chunks from HTML content.

    Args:
        soup: BeautifulSoup parsed HTML (main content area)
        meta: Metadata dict with sourceId, sourceUrl, etc.
        base_url: Base URL for resolving relative links
        validate_links: Whether to validate links (slow!)

    Returns:
        List of Chunk objects
    """
    chunks: List[Chunk] = []

    # Extract metadata for chunks
    chunk_metadata = ChunkMetadata(
        source_id=meta.get("sourceId", "unknown"),
        source_url=meta.get("sourceUrl", ""),
        published_at=meta.get("publishedAt"),
        sha256=meta.get("sha256"),
    )

    # Find all major content sections
    # Common patterns: h1-h6 headers followed by content
    sections = _extract_sections(soup)

    for idx, section in enumerate(sections):
        chunk = _build_section_chunk(
            section,
            chunk_metadata,
            base_url=base_url,
            validate_links=validate_links,
        )

        if chunk:
            chunk.order = idx
            chunk.position = (idx, 0, 0)  # For sorting
            chunks.append(chunk)

    return chunks


def _extract_sections(soup: Tag | BeautifulSoup) -> List[Dict[str, Any]]:
    """
    Extract sections with structured links from HTML.

    Focuses on <p><strong> patterns common on stadslandbouw pages.
    These contain a title, optional description, and a list of related links.
    """
    # Find <p> tags that start with <strong> and contain links
    strong_sections = _extract_strong_sections(soup)

    if not strong_sections:
        # No link sections found, return empty
        return []

    return strong_sections


def _extract_strong_sections(soup: Tag | BeautifulSoup) -> List[Dict[str, Any]]:
    """
    Extract sections that use <p><strong>Title</strong><br/>...</p> pattern.
    Common on stadslandbouw pages.

    Only extracts sections that contain links (the main purpose of this scraper).

    Returns list of section dicts with title, description, and structured links.
    """
    sections: List[Dict[str, Any]] = []

    # Find all <p> tags that contain a <strong> as first/early child
    for p_tag in soup.find_all("p"):
        strong = p_tag.find("strong")
        if not strong:
            continue

        # Check if this p tag contains any links - if not, skip it
        links = p_tag.find_all("a")
        if not links:
            continue

        # Check if strong is near the beginning of the p tag
        # (it should be one of the first elements)
        first_elements = []
        for child in p_tag.children:
            if isinstance(child, Tag):
                first_elements.append(child)
                if len(first_elements) >= 2:
                    break

        # If strong is not in the first 2 tags, skip
        if strong not in first_elements:
            continue

        # Extract title from strong tag
        title = strong.get_text(strip=True)
        if not title:
            continue

        # Extract description (text between strong and first link, if any)
        description_parts: List[str] = []

        # Get all content after the strong tag within the same p
        found_strong = False
        for child in p_tag.children:
            if child == strong:
                found_strong = True
                continue

            if not found_strong:
                continue

            # Stop at first <a> tag
            if isinstance(child, Tag) and child.name == "a":
                break

            # Collect text (skip <br> tags)
            if isinstance(child, NavigableString):
                text = str(child).strip()
                if text:
                    description_parts.append(text)
            elif isinstance(child, Tag) and child.name not in ["br", "a"]:
                text = child.get_text(strip=True)
                if text:
                    description_parts.append(text)

        description = " ".join(description_parts).strip()

        # Extract all links within this p tag
        links = p_tag.find_all("a")
        link_data: List[Dict[str, str]] = []

        for link in links:
            link_text = link.get_text(strip=True)
            link_url = link.get("href", "")
            if link_text and link_url:
                link_data.append(
                    {
                        "text": link_text,
                        "url": link_url,
                    }
                )

        # Build markdown-style content
        content_parts: List[str] = []

        if description:
            content_parts.append(description)

        if link_data:
            content_parts.append("")  # Empty line before links
            for item in link_data:
                content_parts.append(f"- [{item['text']}]({item['url']})")

        combined_content = "\n".join(content_parts)

        # Create section dict
        sections.append(
            {
                "title": title,
                "level": 3,  # Treat as h3 level
                "header": strong,
                "content_elements": [p_tag],
                "html": str(p_tag),
                "description": description,
                "links": link_data,
                "formatted_content": combined_content,
            }
        )

    return sections


def _build_section_chunk(
    section: Dict[str, Any],
    base_metadata: ChunkMetadata,
    *,
    base_url: str,
    validate_links: bool = False,
) -> Optional[Chunk]:
    """Build a chunk from a section."""

    # Extract text content
    text_parts: List[str] = []

    # Add title
    title = section.get("title", "")
    if title:
        text_parts.append(title)

    # Check if this is a pre-formatted strong section
    if section.get("formatted_content"):
        # Use the pre-formatted markdown content
        text_parts.append(section["formatted_content"])
        combined_text = "\n\n".join(text_parts)
    else:
        # Extract text from content elements (original logic)
        for elem in section.get("content_elements", []):
            if isinstance(elem, Tag):
                # Handle lists specially
                if elem.name in ["ul", "ol"]:
                    list_items = [li.get_text(strip=True) for li in elem.find_all("li")]
                    if list_items:
                        text_parts.append(format_list_items(list_items))
                else:
                    text = elem.get_text(separator="\n", strip=True)
                    if text:
                        text_parts.append(text)

        combined_text = "\n\n".join(text_parts)

    if not combined_text.strip():
        return None

    # Extract links from this section
    section_html = section.get("html", "")
    links = extract_links_from_html(
        section_html,
        base_url,
        validate=validate_links,
        skip_anchors=True,
    )

    # Filter broken links if validation was done
    if validate_links:
        links = filter_valid_links(links)

    # Categorize links
    categorized = categorize_links(links) if links else {}

    # Build extra metadata
    extra_metadata: Dict[str, Any] = {}

    # Add description and structured links for strong sections
    if section.get("description"):
        extra_metadata["description"] = section["description"]

    if section.get("links"):
        extra_metadata["structuredLinks"] = section["links"]

    if links:
        extra_metadata["relatedLinks"] = links
        extra_metadata["relatedLinksCategorized"] = categorized
        extra_metadata["linkCount"] = len(links)
        extra_metadata["hasExternalResources"] = True

    # Create chunk metadata with extra fields
    chunk_metadata = ChunkMetadata(
        source_id=base_metadata.source_id,
        source_url=base_metadata.source_url,
        published_at=base_metadata.published_at,
        sha256=base_metadata.sha256,
        extra=extra_metadata,
    )

    # Build chunk
    chunk = Chunk(
        chunk_type="web_section",
        text=combined_text,
        metadata=chunk_metadata,
        title=title or None,
        section_path=[title] if title else None,
    )

    return chunk
