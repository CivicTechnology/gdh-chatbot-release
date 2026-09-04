"""Chunk formatting and link extraction utilities."""

from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


def format_list_items(items: List[str]) -> str:
    """Format a list of items as markdown bullet points."""
    return "\n".join(f"- {item}" for item in items if item)


def validate_chunk(chunk: Any) -> bool:
    """Validate that a chunk has required content."""
    if not chunk:
        return False
    text = getattr(chunk, "text", "") or ""
    return len(text.strip()) > 0


def extract_links_from_html(
    html: str,
    base_url: str,
    *,
    validate: bool = False,
    skip_anchors: bool = True,
) -> List[Dict[str, str]]:
    """
    Extract links from HTML content.

    Args:
        html: HTML string to parse
        base_url: Base URL for resolving relative links
        validate: Whether to validate links (not implemented)
        skip_anchors: Whether to skip anchor-only links (#section)

    Returns:
        List of dicts with 'text' and 'url' keys
    """
    soup = BeautifulSoup(html, "lxml")
    links = []

    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "")
        text = a_tag.get_text(strip=True)

        # Skip anchor-only links
        if skip_anchors and href.startswith("#"):
            continue

        # Skip empty links
        if not href or not text:
            continue

        # Resolve relative URLs
        full_url = urljoin(base_url, href)

        links.append({"text": text, "url": full_url})

    return links


def categorize_links(links: List[Dict[str, str]]) -> Dict[str, List[Dict[str, str]]]:
    """
    Categorize links by type (internal, external, document, etc.).

    Args:
        links: List of link dicts with 'text' and 'url' keys

    Returns:
        Dict with category keys and link lists
    """
    categorized: Dict[str, List[Dict[str, str]]] = {
        "internal": [],
        "external": [],
        "documents": [],
        "other": [],
    }

    doc_extensions = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}

    for link in links:
        url = link.get("url", "")
        parsed = urlparse(url)
        path_lower = parsed.path.lower()

        # Check for document links
        if any(path_lower.endswith(ext) for ext in doc_extensions):
            categorized["documents"].append(link)
        # Check for external links (has scheme and netloc)
        elif parsed.scheme and parsed.netloc:
            categorized["external"].append(link)
        # Internal links
        elif parsed.path:
            categorized["internal"].append(link)
        else:
            categorized["other"].append(link)

    return categorized


def filter_valid_links(links: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Filter to only valid links.

    Note: This is a stub that returns all links.
    Actual validation would require HTTP requests.
    """
    return [link for link in links if link.get("url")]
