"""Abstract base classes for ingest pipelines."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SourceConfig:
    """Configuration for a single source (PDF or web page)."""
    
    id: str
    title: str
    url: str
    category: str
    tags: List[str]
    description: Optional[str] = None
    published_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ChunkMetadata:
    """Metadata attached to a chunk."""
    
    source_id: str
    source_url: str
    published_at: Optional[str] = None
    sha256: Optional[str] = None
    
    # Additional domain-specific metadata
    extra: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


@dataclass
class Chunk:
    """A semantic chunk of content."""
    
    chunk_type: str  # 'section', 'table_row', 'paragraph', 'list', etc.
    text: str
    metadata: ChunkMetadata
    
    # Optional fields
    title: Optional[str] = None
    section_path: Optional[List[str]] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    pages: Optional[List[int]] = None
    anchor: Optional[str] = None
    order: int = 0
    
    # For sorting during merging
    position: tuple = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "chunkType": self.chunk_type,
            "text": self.text,
            "sourceId": self.metadata.source_id,
            "sourceUrl": self.metadata.source_url,
            "order": self.order,
        }
        
        if self.title:
            result["title"] = self.title
        if self.section_path:
            result["sectionPath"] = self.section_path
        if self.page_start is not None:
            result["pageStart"] = self.page_start
        if self.page_end is not None:
            result["pageEnd"] = self.page_end
        if self.pages:
            result["pages"] = self.pages
        if self.anchor:
            result["anchor"] = self.anchor
        if self.metadata.published_at:
            result["publishedAt"] = self.metadata.published_at
        if self.metadata.sha256:
            result["sha256"] = self.metadata.sha256
        
        # Merge extra metadata
        if self.metadata.extra:
            result["metadata"] = self.metadata.extra
        
        return result


class IngestPipeline(ABC):
    """Abstract base class for ingest pipelines."""
    
    def __init__(self, cache_dir: Path, output_dir: Path):
        self.cache_dir = cache_dir
        self.output_dir = output_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    @abstractmethod
    def fetch_source(self, source: SourceConfig, force: bool = False) -> Path:
        """
        Fetch/download the source content.
        Returns path to cached file.
        """
        pass
    
    @abstractmethod
    def extract_content(self, source_path: Path, source: SourceConfig) -> Dict[str, Any]:
        """
        Extract structured content from the source.
        Returns dict with 'meta' and content-specific keys.
        """
        pass
    
    @abstractmethod
    def build_chunks(self, content: Dict[str, Any]) -> List[Chunk]:
        """
        Build semantic chunks from extracted content.
        Returns list of Chunk objects.
        """
        pass
    
    def process_source(self, source: SourceConfig, force: bool = False) -> Path:
        """
        Full pipeline: fetch -> extract -> chunk -> save.
        Returns path to output JSON file.
        """
        # 1. Fetch source
        source_path = self.fetch_source(source, force=force)
        
        # 2. Extract content
        content = self.extract_content(source_path, source)
        
        # 3. Build chunks
        chunks = self.build_chunks(content)
        
        # 4. Sort and assign order
        chunks.sort(key=lambda c: c.position or (10**6, 0, 0))
        for idx, chunk in enumerate(chunks):
            chunk.order = idx
        
        # 5. Save output
        output = {
            "meta": content.get("meta", {}),
            "chunks": [chunk.to_dict() for chunk in chunks],
        }
        
        # Add tables if present
        if "tables" in content:
            output["tables"] = content["tables"]
        
        output_path = self.output_dir / f"{source.id}.json"
        self._write_json(output_path, output)
        
        return output_path
    
    @staticmethod
    def _write_json(path: Path, data: Dict[str, Any]) -> None:
        """Write JSON to file."""
        import json
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    
    def build_meta(self, source: SourceConfig, **kwargs) -> Dict[str, Any]:
        """Build standard metadata dict."""
        return {
            "sourceId": source.id,
            "sourceUrl": source.url,
            "title": source.title,
            "category": source.category,
            "tags": source.tags,
            "description": source.description,
            "publishedAt": source.published_at,
            "notes": source.notes,
            "extractionMethod": self.get_extraction_method(),
            "generator": f"{self.__class__.__name__}/1.0.0",
            "ingestedAt": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }
    
    @abstractmethod
    def get_extraction_method(self) -> str:
        """Return the extraction method name (e.g., 'docling', 'beautifulsoup')."""
        pass

