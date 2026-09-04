from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


@dataclass
class SectionEntry:
    text: str
    label: str
    page: Optional[int]
    ref: Optional[str]
    bbox: Optional[Dict[str, Any]]


@dataclass
class SectionBlock:
    title: str
    path: List[str]
    entries: List[SectionEntry]
    pages: List[int]
    labels: List[str]
    refs: List[str]
    first_page: Optional[int]
    first_top: float
    anchor: Optional[str]

    def to_chunk(self, meta: Dict[str, Any]) -> Dict[str, Any]:
        body_parts: List[str] = []
        for entry in self.entries:
            if not entry.text:
                continue
            if entry.label == "list_item":
                body_parts.append(f"• {entry.text}")
            else:
                body_parts.append(entry.text)
        body = "\n".join(part.strip() for part in body_parts if part.strip())

        pages_source = list(self.pages)
        if self.first_page is not None:
            pages_source.append(self.first_page)
        pages_sorted = sorted(set(pages_source))
        labels_sorted = sorted(set(self.labels))
        page_start = pages_sorted[0] if pages_sorted else self.first_page
        page_end = pages_sorted[-1] if pages_sorted else self.first_page

        return {
            "chunkType": "section",
            "title": self.title,
            "sectionPath": self.path,
            "text": body,
            "labels": labels_sorted,
            "pages": pages_sorted,
            "refs": list(dict.fromkeys(self.refs)),
            "sourceId": meta.get("sourceId"),
            "sourceUrl": meta.get("sourceUrl"),
            "publishedAt": meta.get("publishedAt"),
            "sha256": meta.get("sha256"),
            "firstPage": self.first_page,
            "pageStart": page_start,
            "pageEnd": page_end,
            "segmentCount": len(self.entries),
            "position": (
                self.first_page if self.first_page is not None else 10**6,
                -self.first_top,
                0,
            ),
            "anchor": self.anchor,
        }


def build_semantic_chunks(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    meta = doc.get("meta", {})
    text_segments = doc.get("text_segments", [])
    tables = doc.get("tables", [])

    section_chunks = _build_section_chunks(text_segments, meta)
    table_chunks = _build_table_chunks(tables, meta)

    all_chunks = section_chunks + table_chunks
    all_chunks.sort(key=lambda item: item.get("position", (10**6, 0, 0)))

    for order, chunk in enumerate(all_chunks):
        chunk["order"] = order
        chunk.pop("position", None)

    return all_chunks


def _build_section_chunks(
    segments: Iterable[Dict[str, Any]],
    meta: Dict[str, Any],
) -> List[Dict[str, Any]]:
    sorted_segments = sorted(
        (seg for seg in segments if isinstance(seg, dict)),
        key=_segment_sort_key,
    )

    blocks: List[SectionBlock] = []
    header_stack: List[Tuple[float, str]] = []
    current_block: Optional[SectionBlock] = None

    for segment in sorted_segments:
        label = segment.get("label")
        text = (segment.get("text") or "").strip()
        if not text:
            continue

        page = segment.get("page")
        bbox = segment.get("bbox") if isinstance(segment.get("bbox"), dict) else None
        top = float(bbox.get("t", 0.0)) if bbox else 0.0
        left = float(bbox.get("l", 0.0)) if bbox else 0.0
        ref = segment.get("ref")

        if label == "section_header":
            if current_block is not None:
                blocks.append(current_block)
                current_block = None

            while header_stack and left <= header_stack[-1][0]:
                header_stack.pop()
            header_stack.append((left, text))

            path = [item[1] for item in header_stack]
            pages = [page] if isinstance(page, int) else []
            refs = [ref] if ref else []
            current_block = SectionBlock(
                title=text,
                path=path,
                entries=[],
                pages=pages,
                labels=[label],
                refs=refs,
                first_page=page,
                first_top=top,
                anchor=ref,
            )
            continue

        if current_block is None:
            continue

        current_block.entries.append(
            SectionEntry(text=text, label=label or "text", page=page, ref=ref, bbox=bbox)
        )
        if page is not None:
            current_block.pages.append(page)
        if label:
            current_block.labels.append(label)
        if ref:
            current_block.refs.append(ref)

    if current_block is not None:
        blocks.append(current_block)

    return [block.to_chunk(meta) for block in blocks if (_has_meaningful_text(block))]


def _build_table_chunks(tables: Iterable[Dict[str, Any]], meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []

    for table_index, table in enumerate(tables):
        if not isinstance(table, dict):
            continue

        header = table.get("header") or []
        rows = table.get("rows") or []
        pages = table.get("pages") or []
        bbox = table.get("bbox") if isinstance(table.get("bbox"), dict) else None
        top = float(bbox.get("t", 0.0)) if bbox else 0.0
        table_id = table.get("tableId")

        normalized_header = [cell if cell else f"col_{idx + 1}" for idx, cell in enumerate(header)]

        for row_index, row in enumerate(rows):
            if not isinstance(row, list):
                continue

            cells = _map_cells(normalized_header, row)
            text_parts = []
            for key, value in cells.items():
                if value:
                    text_parts.append(f"{key}: {value}")
            row_text = "\n".join(text_parts)

            if not row_text.strip():
                continue

            metadata_extra = _derive_table_metadata(header, normalized_header, cells)

            chunk = {
                "chunkType": "table_row",
                "tableId": table_id,
                "tableHeader": header,
                "row": row,
                "cells": cells,
                "text": row_text,
                "pages": pages,
                "sourceId": meta.get("sourceId"),
                "sourceUrl": meta.get("sourceUrl"),
                "publishedAt": meta.get("publishedAt"),
                "sha256": meta.get("sha256"),
                "rowIndex": row_index,
                "metadata": metadata_extra,
                "position": (
                    pages[0] if pages else 10**6,
                    -top,
                    row_index,
                ),
            }
            chunks.append(chunk)

    for chunk in chunks:
        pages = chunk.get("pages") or []
        page_start = pages[0] if pages else None
        page_end = pages[-1] if pages else None
        chunk["pageStart"] = page_start
        chunk["pageEnd"] = page_end
        chunk["firstPage"] = pages[0] if pages else None

    return chunks


def _segment_sort_key(segment: Dict[str, Any]) -> Tuple[int, float, str]:
    page = segment.get("page")
    if page is None:
        page = 10**6
    bbox = segment.get("bbox") if isinstance(segment.get("bbox"), dict) else None
    top = float(bbox.get("t", 0.0)) if bbox else 0.0
    return (int(page), -top, segment.get("ref") or "")


def _map_cells(header: Sequence[str], row: Sequence[Any]) -> Dict[str, str]:
    cells: Dict[str, str] = {}
    for index, value in enumerate(row):
        if index >= len(header):
            key = f"col_{index + 1}"
        else:
            key = header[index] or f"col_{index + 1}"
        text = (value or "") if isinstance(value, str) else str(value or "")
        cells[key] = text.strip()
    return cells


def _has_meaningful_text(block: SectionBlock) -> bool:
    if block.entries:
        return any(entry.text.strip() for entry in block.entries)
    return False


def _first_nonempty(cells: Dict[str, str], keys: Sequence[str]) -> Optional[str]:
    for key in keys:
        value = cells.get(key)
        if value and value.strip():
            return value.strip()
    return None


def _derive_table_metadata(
    original_header: Sequence[str],
    normalized_header: Sequence[str],
    cells: Dict[str, str],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    policy_context: Optional[str] = None
    status_value: Optional[str] = None
    pillar_value: Optional[str] = None
    metadata: Dict[str, Any] = {}

    def _normalize_header(text: str) -> str:
        text = text.strip()
        if text.lower().startswith("activiteiten "):
            text = text[len("Activiteiten ") :].strip()
        if ":" in text:
            parts = [part.strip() for part in text.split(":", 1)]
            return ": ".join(part for part in parts if part)
        return text

    for idx, header_cell in enumerate(original_header):
        key = header_cell if header_cell else normalized_header[idx]
        header_text = (header_cell or normalized_header[idx] or "").strip()
        value = cells.get(key)
        if not value:
            continue

        header_lower = header_text.lower()
        if "status" in header_lower:
            status_value = value
            continue
        if "pijler" in header_lower or "pillar" in header_lower:
            pillar_value = value
            continue

        if "activiteit" in header_lower or "context" in header_lower or "beleid" in header_lower:
            if policy_context is None or len(value) > len(policy_context or ""):
                policy_context = _normalize_header(header_text)

    lower_headers = [h.lower() for h in original_header if isinstance(h, str)]
    if any("wie gaat erover" in h for h in lower_headers) or any(
        "vergunning" in h for h in lower_headers
    ):
        theme_index = _first_nonempty(cells, ["THEMA", "Thema", "thema"])

        if "col_5" in cells:
            authority_val = cells.get("vergunning")
            permit_val = cells.get("col_5")
            legal_basis_val = " ".join(
                part
                for part in [cells.get("WETTEN (belangrijkste)"), cells.get("WIE GAAT EROVER")]
                if part
            ).strip()
        else:
            authority_val = _first_nonempty(
                cells,
                [
                    "WIE GAAT EROVER",
                    "Wie gaat erover",
                    "wie gaat erover",
                ],
            )
            permit_val = _first_nonempty(
                cells,
                [
                    "vergunning",
                    "Vergunning",
                ],
            )
            legal_basis_val = _first_nonempty(
                cells,
                [
                    "WETTEN (belangrijkste)",
                    "Wetten (belangrijkste)",
                    "wetten (belangrijkste)",
                ],
            )

        if authority_val:
            metadata["authority"] = authority_val
        if permit_val:
            metadata["permitRequirement"] = permit_val
        if legal_basis_val:
            metadata["legalBasis"] = legal_basis_val
        if theme_index:
            metadata["themeIndex"] = theme_index

    if policy_context is not None:
        metadata["policyContext"] = policy_context
    if status_value is not None:
        metadata["status"] = status_value
    if pillar_value is not None:
        metadata["pillar"] = pillar_value

    return metadata
