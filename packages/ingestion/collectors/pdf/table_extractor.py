"""Utilities to build clean, merged tables from Docling output."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

import re


TableDict = Dict[str, Any]
DoclingDict = Dict[str, Any]


_WORD_TOKEN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+")
_BASIC_WORDS: Set[str] = {
    "we",
    "in",
    "om",
    "op",
    "aan",
    "van",
    "het",
    "de",
    "een",
    "voor",
    "en",
    "met",
    "hoe",
    "meer",
    "minder",
    "door",
    "ook",
    "dat",
    "als",
    "te",
    "menu",
    "ervoor",
    "duurzaam",
}


@dataclass(frozen=True)
class TableSlice:
    """Minimal representation of a table fragment on a single page."""

    ref: str
    page: int
    bbox: Dict[str, Any]
    grid: List[List[Any]]
    num_cols: int
    header_cells: Tuple[str, ...]
    header_present: bool
    x_left: float
    x_right: float
    column_ranges: Dict[int, Tuple[float, float]]


def extract_clean_tables(doc: DoclingDict) -> List[Dict[str, Any]]:
    """Return merged, normalised tables from a Docling document dict."""

    slices = [_create_slice(entry) for entry in _iter_tables(doc)]
    filtered_slices = [sl for sl in slices if sl is not None]
    if not filtered_slices:
        return []

    body_segments, body_wordset = _build_body_segments(doc)
    groups = _merge_slice_groups(filtered_slices)
    return [_merge_group(doc, group, body_segments, body_wordset) for group in groups]


def _iter_tables(doc: DoclingDict) -> Iterable[TableDict]:
    tables = doc.get("tables")
    if not isinstance(tables, list):
        return []
    return (entry for entry in tables if isinstance(entry, dict))


def _create_slice(entry: TableDict) -> Optional[TableSlice]:
    ref = entry.get("self_ref")
    if not isinstance(ref, str):
        return None

    provenance = entry.get("prov")
    if not (isinstance(provenance, list) and provenance):
        return None
    first_prov = provenance[0]
    if not isinstance(first_prov, dict):
        return None

    page = first_prov.get("page_no")
    bbox = first_prov.get("bbox")
    if not isinstance(page, int) or not isinstance(bbox, dict):
        return None

    data = entry.get("data")
    if not isinstance(data, dict):
        return None

    raw_grid = data.get("grid")
    grid: List[List[Any]] = [row for row in raw_grid if isinstance(row, list)] if isinstance(raw_grid, list) else []

    num_cols = data.get("num_cols")
    if not isinstance(num_cols, int):
        num_cols = max((len(row) for row in grid), default=0)

    header_cells = _extract_header_cells(grid)
    header_present = bool(header_cells)
    x_left, x_right = _bbox_x_range(bbox)
    column_ranges = _extract_column_ranges(data, num_cols)

    return TableSlice(
        ref=ref,
        page=page,
        bbox=bbox,
        grid=grid,
        num_cols=num_cols,
        header_cells=header_cells,
        header_present=header_present,
        x_left=x_left,
        x_right=x_right,
        column_ranges=column_ranges,
    )


def _extract_header_cells(grid: Sequence[Sequence[Any]]) -> Tuple[str, ...]:
    headers: List[str] = []
    for row in list(grid)[:2]:
        if not isinstance(row, list):
            continue
        row_headers: List[str] = []
        for cell in row:
            if isinstance(cell, dict) and cell.get("column_header"):
                text = _clean_text(cell.get("text"))
                if text:
                    row_headers.append(text)
        if row_headers:
            headers.extend(row_headers)
    return tuple(headers)


def _extract_column_ranges(data: Dict[str, Any], num_cols: int) -> Dict[int, Tuple[float, float]]:
    column_ranges: Dict[int, Tuple[float, float]] = {}
    cells = data.get("table_cells") if isinstance(data, dict) else None
    if not isinstance(cells, list):
        return column_ranges

    temp: Dict[int, List[float]] = {}
    for cell in cells:
        if not isinstance(cell, dict):
            continue
        start = cell.get("start_col_offset_idx")
        end = cell.get("end_col_offset_idx")
        bbox = cell.get("bbox")
        if bbox is None:
            bbox = {}
        if not isinstance(bbox, dict):
            continue
        if not isinstance(start, int) or not isinstance(end, int):
            continue
        left = float(bbox.get("l", 0.0))
        right = float(bbox.get("r", left))
        for col in range(max(0, start), min(num_cols - 1, end) + 1):
            bucket = temp.setdefault(col, [left, right])
            bucket[0] = min(bucket[0], left)
            bucket[1] = max(bucket[1], right)

    for col, (left, right) in temp.items():
        column_ranges[col] = (left, right)
    return column_ranges


def _clean_text(value: Any) -> str:
    text = (value or "") if isinstance(value, str) else str(value or "")
    return " ".join(text.split())


def _bbox_x_range(bbox: Dict[str, Any]) -> Tuple[float, float]:
    left = float(bbox.get("l", 0.0))
    right = float(bbox.get("r", left))
    return (left, right)


def _merge_slice_groups(slices: List[TableSlice]) -> List[List[TableSlice]]:
    sorted_slices = sorted(slices, key=lambda sl: (sl.page, float(sl.bbox.get("t", 0.0))))
    groups: List[List[TableSlice]] = []
    used: set[str] = set()

    for index, current in enumerate(sorted_slices):
        if current.ref in used:
            continue

        chain = [current]
        used.add(current.ref)

        for candidate in sorted_slices[index + 1 :]:
            if candidate.ref in used:
                continue
            if candidate.page > chain[-1].page + 1:
                break
            if _is_continuation(chain[-1], candidate):
                chain.append(candidate)
                used.add(candidate.ref)

        groups.append(chain)

    return groups


def _is_continuation(previous: TableSlice, candidate: TableSlice) -> bool:
    if candidate.page != previous.page + 1:
        return False

    if previous.num_cols and candidate.num_cols:
        if not _compatible_num_cols(previous.num_cols, candidate.num_cols):
            return False

    if not _ranges_close(previous.x_left, previous.x_right, candidate.x_left, candidate.x_right):
        return False

    if previous.header_present and candidate.header_present:
        return previous.header_cells == candidate.header_cells

    if previous.header_present and not candidate.header_present:
        return True

    if not previous.header_present and candidate.header_present:
        return False

    return True


def _compatible_num_cols(prev_cols: int, cand_cols: int) -> bool:
    if prev_cols == cand_cols:
        return True
    if prev_cols == cand_cols + 1:
        return True
    return False


def _ranges_close(prev_left: float, prev_right: float, cand_left: float, cand_right: float, *, tolerance: float = 15.0) -> bool:
    return abs(prev_left - cand_left) <= tolerance and abs(prev_right - cand_right) <= tolerance


def _merge_group(
    doc: DoclingDict,
    group: List[TableSlice],
    body_segments: List[Tuple[str, str]],
    body_wordset: Set[str],
) -> Dict[str, Any]:
    ordered = sorted(group, key=lambda sl: (sl.page, float(sl.bbox.get("t", 0.0))))
    table_id = ordered[0].ref.replace("#/tables/", "table-")

    canonical_header: Tuple[str, ...] = ()
    for slice_ in ordered:
        if slice_.header_present and slice_.header_cells:
            canonical_header = slice_.header_cells
            break

    base_num_cols = max((slice_.num_cols for slice_ in ordered), default=0)
    pages = sorted({slice_.page for slice_ in ordered})
    bbox = _merge_bboxes(slice_.bbox for slice_ in ordered)
    column_ranges = _merge_column_ranges(ordered, base_num_cols, bbox)

    merged_rows: List[List[str]] = []
    for index, slice_ in enumerate(ordered):
        for row in slice_.grid:
            row_cells = [_clean_text(cell.get("text")) if isinstance(cell, dict) else "" for cell in row]
            row_cells = [
                _restore_spacing(cell_text, body_segments, body_wordset)
                for cell_text in row_cells
            ]
            if canonical_header and _looks_like_header(row_cells, canonical_header):
                continue
            normalized = _normalize_row(row_cells, base_num_cols)
            merged_rows.append(normalized)

    header_out = list(canonical_header) if canonical_header else [f"col_{idx + 1}" for idx in range(base_num_cols)]

    header_out, merged_rows = _maybe_promote_implicit_header(header_out, merged_rows)

    table_dict = {
        "tableId": table_id,
        "pages": pages,
        "bbox": bbox,
        "header": header_out,
        "rows": merged_rows,
    }

    _append_floating_rows(
        doc,
        table_dict,
        column_ranges,
        base_num_cols,
        body_segments,
        body_wordset,
    )
    return table_dict


def _merge_bboxes(bboxes: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    lefts: List[float] = []
    rights: List[float] = []
    tops: List[float] = []
    bottoms: List[float] = []

    for bbox in bboxes:
        if not isinstance(bbox, dict):
            continue
        lefts.append(float(bbox.get("l", 0.0)))
        rights.append(float(bbox.get("r", 0.0)))
        tops.append(float(bbox.get("t", 0.0)))
        bottoms.append(float(bbox.get("b", 0.0)))

    if not lefts:
        return {"l": 0.0, "r": 0.0, "t": 0.0, "b": 0.0}

    return {
        "l": min(lefts),
        "r": max(rights),
        "t": min(tops),
        "b": max(bottoms),
    }


def _normalize_row(row: List[str], target_length: int) -> List[str]:
    if len(row) == target_length:
        return row
    if len(row) == target_length - 1:
        return [""] + row
    if len(row) < target_length:
        missing = target_length - len(row)
        return row + [""] * missing
    return row


def _looks_like_header(row_cells: List[str], header: Tuple[str, ...]) -> bool:
    if not header:
        return False
    matches = 0
    for item in header:
        if item and any(item == cell for cell in row_cells):
            matches += 1
    return matches >= max(1, len(header) // 2)


def _merge_column_ranges(slices: List[TableSlice], num_cols: int, bbox: Dict[str, Any]) -> Dict[int, Tuple[float, float]]:
    merged: Dict[int, List[float]] = {}

    primary_slice = next((sl for sl in slices if sl.header_present and sl.column_ranges), None)
    if primary_slice is not None:
        for col, (left, right) in primary_slice.column_ranges.items():
            merged[col] = [left, right]

    tolerance = 40.0
    for slice_ in slices:
        for col, (left, right) in slice_.column_ranges.items():
            bucket = merged.get(col)
            if bucket is None:
                merged[col] = [left, right]
                continue
            if abs(bucket[0] - left) > tolerance and abs(bucket[1] - right) > tolerance:
                continue
            bucket[0] = min(bucket[0], left)
            bucket[1] = max(bucket[1], right)

    if num_cols <= 0:
        return {}

    total_left = float(bbox.get("l", 0.0))
    total_right = float(bbox.get("r", total_left))
    approx_width = (total_right - total_left) / max(num_cols, 1)

    for col in range(num_cols):
        if col not in merged:
            left = total_left + col * approx_width
            right = left + approx_width
            merged[col] = [left, right]

    return {col: (rng[0], rng[1]) for col, rng in merged.items()}


def _build_body_segments(doc: DoclingDict) -> Tuple[List[Tuple[str, str]], Set[str]]:
    texts = doc.get("texts")
    if not isinstance(texts, list):
        return [], set()

    segments: List[Tuple[str, str]] = []
    words: Set[str] = set()
    for item in texts:
        if not isinstance(item, dict):
            continue
        if item.get("content_layer") != "body":
            continue
        text = item.get("text")
        if not isinstance(text, str):
            continue
        norm = _normalize_for_lookup(text)
        if len(norm) < 6:
            continue
        segments.append((norm, text.strip()))
        words.update(_extract_words(text))

    # Sort by length descending to favour longer matches first.
    segments.sort(key=lambda pair: len(pair[0]), reverse=True)
    words.update(_BASIC_WORDS)
    return segments, words


def _restore_spacing(text: str, segments: List[Tuple[str, str]], wordset: Set[str]) -> str:
    if not text:
        return text

    if segments and len(text) >= 6:
        normalized = _normalize_for_lookup(text)
        if len(normalized) >= 6:
            rebuilt: List[str] = []
            index = 0
            while index < len(normalized):
                match_text: Optional[str] = None
                match_len = 0
                for segment_norm, segment_text in segments:
                    if len(segment_norm) <= match_len:
                        break
                    if normalized.startswith(segment_norm, index):
                        match_text = segment_text
                        match_len = len(segment_norm)
                if match_text is None:
                    break
                rebuilt.append(match_text)
                index += match_len
            if index == len(normalized):
                candidate = " ".join(part.strip() for part in rebuilt if part.strip())
                if candidate:
                    return candidate

    spaced = _wordset_spacing_fix(text, wordset)
    if spaced != text:
        return _simple_spacing_fix(spaced)
    return _simple_spacing_fix(text)


def _normalize_for_lookup(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


def _wordset_spacing_fix(text: str, wordset: Set[str]) -> str:
    if not text or not wordset:
        return text

    result: List[str] = []
    last_index = 0
    changed = False

    for match in _WORD_TOKEN_RE.finditer(text):
        start, end = match.span()
        word = match.group(0)
        lower = word.lower()
        segments = _segment_word(lower, wordset)
        result.append(text[last_index:start])
        if segments is None:
            result.append(word)
        else:
            changed = True
            result.append(_apply_segment_case(word, segments))
        last_index = end

    result.append(text[last_index:])
    return "".join(result) if changed else text


def _simple_spacing_fix(text: str) -> str:
    if not text:
        return text

    value = re.sub(r"([.!?;])([A-Z])", r"\1 \2", text)
    replacements = {
        "Wewillen": "We willen",
        "Wewerken": "We werken",
        "Omduurzamekeuzes": "Om duurzame keuzes",
        "Omduurzame": "Om duurzame",
        "Ombestaande": "Om bestaande",
        "ombestaande": "om bestaande",
        "duurzamekeuzes": "duurzame keuzes",
    }

    for bad, good in replacements.items():
        value = value.replace(bad, good)

    value = re.sub(r"\s{2,}", " ", value)
    return value.strip()


def _extract_words(value: str) -> Set[str]:
    return {match.group(0).lower() for match in _WORD_TOKEN_RE.finditer(value)}


def _apply_segment_case(original: str, segments: Sequence[str]) -> str:
    if not segments:
        return original
    if original.isupper():
        return " ".join(part.upper() for part in segments)
    if original[0].isupper():
        capitalized = [segments[0].capitalize()] + [part for part in segments[1:]]
        return " ".join(capitalized)
    return " ".join(segments)


def _segment_word(word: str, wordset: Set[str]) -> Optional[List[str]]:
    if not word or word in wordset:
        return None

    length = len(word)
    max_word_len = min(max((len(item) for item in wordset), default=0), length)
    if max_word_len < 2:
        return None

    dp: List[Optional[List[str]]] = [None] * (length + 1)
    dp[0] = []

    for index in range(length):
        prefix = dp[index]
        if prefix is None:
            continue
        upper = min(length, index + max_word_len)
        for end in range(index + 2, upper + 1):
            candidate = word[index:end]
            if candidate not in wordset:
                continue
            path = prefix + [candidate]
            existing = dp[end]
            if existing is None or len(path) < len(existing):
                dp[end] = path

    segments = dp[length]
    if segments is None or len(segments) < 2:
        return None
    if any(len(part) < 2 for part in segments):
        return None
    return segments


def _maybe_promote_implicit_header(
    header: List[str],
    rows: List[List[str]],
) -> Tuple[List[str], List[List[str]]]:
    if header and header[0].startswith("col_"):
        # Header came from fallback; try to promote first row if it looks like labels.
        header = []

    if header or not rows:
        return header, rows

    first = rows[0]
    second = rows[1] if len(rows) > 1 else None

    if first and first[0].strip() and (second is None or not (second[0] or "").strip()):
        header = [cell for cell in first]
        rows = rows[1:]
    elif first and any("status" in cell.lower() for cell in first if cell):
        header = [cell for cell in first]
        rows = rows[1:]

    if not header:
        header = [f"col_{idx + 1}" for idx in range(len(first))]

    return header, rows


def _append_floating_rows(
    doc: DoclingDict,
    table: Dict[str, Any],
    column_ranges: Dict[int, Tuple[float, float]],
    num_cols: int,
    body_segments: List[Tuple[str, str]],
    body_wordset: Set[str],
) -> None:
    if not table.get("rows") or not table.get("pages"):
        return

    max_page = max(table["pages"])
    next_page = max_page + 1

    col0_range = column_ranges.get(0)
    if col0_range is None:
        return

    if _page_has_header_table(doc, next_page):
        return

    anchors = _collect_picture_anchors(doc, next_page, col0_range)
    if not anchors:
        return

    text_entries = _collect_text_entries(doc, next_page, column_ranges)
    if not text_entries:
        return

    used_texts: set[str] = set()
    rows_added = 0

    for anchor in anchors:
        row_values = [""] * num_cols
        row_values[0] = ""
        row_center = anchor["center"]

        for entry in text_entries:
            if entry["ref"] in used_texts:
                continue
            if abs(entry["center"] - row_center) > 25:
                continue
            row_values[entry["col"]] = _restore_spacing(entry["text"], body_segments, body_wordset)
            used_texts.add(entry["ref"])

        if _looks_like_header(row_values, tuple(table.get("header", ()))):
            continue

        if num_cols and not row_values[num_cols - 1].strip():
            continue

        if any(value for value in row_values[1:]):
            table["rows"].append(_normalize_row(row_values, num_cols))
            rows_added += 1

    if rows_added:
        pages = set(table.get("pages", []))
        pages.add(next_page)
        table["pages"] = sorted(pages)


def _collect_picture_anchors(doc: DoclingDict, page: int, col_range: Tuple[float, float]) -> List[Dict[str, Any]]:
    anchors: List[Dict[str, Any]] = []
    pictures = doc.get("pictures")
    if not isinstance(pictures, list):
        return anchors

    for picture in pictures:
        if not isinstance(picture, dict):
            continue
        prov = picture.get("prov")
        if not (isinstance(prov, list) and prov and isinstance(prov[0], dict)):
            continue
        if prov[0].get("page_no") != page:
            continue
        bbox = prov[0].get("bbox")
        if not isinstance(bbox, dict):
            continue
        left = float(bbox.get("l", 0.0))
        if not _value_in_range(col_range, left, tolerance=30.0):
            continue
        anchors.append({
            "ref": picture.get("self_ref"),
            "center": _center_from_bbox(bbox),
        })

    anchors.sort(key=lambda item: item["center"], reverse=True)
    return anchors


def _collect_text_entries(
    doc: DoclingDict,
    page: int,
    column_ranges: Dict[int, Tuple[float, float]],
) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    texts = doc.get("texts")
    if not isinstance(texts, list):
        return entries

    for text in texts:
        if not isinstance(text, dict):
            continue
        prov = text.get("prov")
        if not (isinstance(prov, list) and prov and isinstance(prov[0], dict)):
            continue
        if prov[0].get("page_no") != page:
            continue
        bbox = prov[0].get("bbox")
        if not isinstance(bbox, dict):
            continue
        left = float(bbox.get("l", 0.0))
        col_idx = _column_for_x(column_ranges, left, tolerance=18.0)
        if col_idx in (None, 0):
            continue
        entries.append({
            "ref": text.get("self_ref"),
            "col": col_idx,
            "center": _center_from_bbox(bbox),
            "text": _clean_text(text.get("text")),
        })

    entries.sort(key=lambda item: item["center"], reverse=True)
    return entries


def _column_for_x(column_ranges: Dict[int, Tuple[float, float]], x: float, tolerance: float) -> Optional[int]:
    candidates: List[Tuple[float, int]] = []
    for col, (left, right) in column_ranges.items():
        if not _value_in_range((left, right), x, tolerance):
            continue
        center = (left + right) / 2.0
        candidates.append((abs(center - x), col))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][1]


def _value_in_range(range_pair: Tuple[float, float], value: float, tolerance: float) -> bool:
    left, right = range_pair
    return (left - tolerance) <= value <= (right + tolerance)


def _page_has_header_table(doc: DoclingDict, page: int) -> bool:
    tables = doc.get("tables")
    if not isinstance(tables, list):
        return False
    for entry in tables:
        if not isinstance(entry, dict):
            continue
        prov = entry.get("prov")
        if not (isinstance(prov, list) and prov and isinstance(prov[0], dict)):
            continue
        if prov[0].get("page_no") != page:
            continue
        data = entry.get("data")
        grid = data.get("grid") if isinstance(data, dict) else None
        if not isinstance(grid, list):
            continue
        for row in grid[:2]:
            if not isinstance(row, list):
                continue
            for cell in row:
                if isinstance(cell, dict) and cell.get("column_header"):
                    return True
    return False


def _center_from_bbox(bbox: Dict[str, Any]) -> float:
    top = float(bbox.get("t", 0.0))
    bottom = float(bbox.get("b", top))
    return (top + bottom) / 2.0


