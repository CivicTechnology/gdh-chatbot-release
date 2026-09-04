"""Helpers om Docling JSON voor chunking klaar te maken."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional


DocJson = Dict[str, Any]
TextNode = Dict[str, Any]


def extract_document_content(doc_json: DocJson) -> Dict[str, Any]:
    """Geef compacte content terug voor downstream chunking.

    Resultaat:
      {
        "meta": {...},
        "tables": [...],
        "text_segments": [
            {
              "text": str,
              "label": str,
              "ref": str,
              "bbox": {...},
              "page": int | None,
            }
        ],
      }
    """

    tables: List[Dict[str, Any]] = list(doc_json.get("tables", []))
    raw_doc = doc_json.get("rawDocling", {})
    text_segments = _collect_body_text_segments(raw_doc)

    return {
        "meta": doc_json.get("meta", {}),
        "tables": tables,
        "text_segments": text_segments,
    }


def _collect_body_text_segments(raw_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    texts = raw_doc.get("texts")
    if not isinstance(texts, list):
        return []

    segments: List[Dict[str, Any]] = []
    for node in texts:
        if not isinstance(node, dict):
            continue

        content_layer = node.get("content_layer")
        if content_layer != "body":
            # negeer OCR uit afbeeldingen of andere lagen
            continue

        label = node.get("label")
        if label == "page_footer":
            continue

        text = node.get("text")
        if not isinstance(text, str):
            continue

        norm = text.strip()
        if not norm:
            continue

        prov = node.get("prov")
        page: Optional[int] = None
        bbox: Optional[Dict[str, Any]] = None
        if isinstance(prov, list) and prov and isinstance(prov[0], dict):
            page = prov[0].get("page_no")
            bbox = prov[0].get("bbox") if isinstance(prov[0].get("bbox"), dict) else None

        if _is_infographic_fragment(label, norm, bbox):
            continue

        segments.append(
            {
                "text": norm,
                "label": label,
                "ref": node.get("self_ref"),
                "page": page,
                "bbox": bbox,
            }
        )

    return segments


def _is_infographic_fragment(label: Optional[str], text: str, bbox: Optional[Dict[str, Any]]) -> bool:
    if label != "text" or not bbox:
        return False

    word_count = len(text.split())
    if word_count > 6:
        return False

    length = len(text)
    if length > 60:
        return False

    left = float(bbox.get("l", 0.0))
    right = float(bbox.get("r", left))
    top = float(bbox.get("t", 0.0))
    bottom = float(bbox.get("b", top))

    width = abs(right - left)
    height = abs(top - bottom)

    if width <= 150.0 and height <= 12.0:
        return True
    return False


