"""Database cache interface for checking content changes and storing data directly."""

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

import psycopg
from psycopg.types.json import Jsonb


def get_db_connection():
    """Get a connection to the PostgreSQL database.

    Returns:
        psycopg.Connection: Database connection

    Raises:
        ValueError: If POSTGRES_URL environment variable is not set
    """
    db_url = os.getenv("POSTGRES_URL")
    if not db_url:
        raise ValueError("POSTGRES_URL environment variable is required")
    return psycopg.connect(db_url)


def get_source_hash(source_id: str) -> Optional[str]:
    """Get the current SHA256 hash for a source from the database.

    Args:
        source_id: The unique source identifier

    Returns:
        SHA256 hash string if source exists, None otherwise
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "sha256" FROM "DocumentSource" WHERE "sourceId" = %s',
                (source_id,),
            )
            result = cur.fetchone()
            return result[0] if result else None


def has_content_changed(source_id: str, new_hash: str) -> bool:
    """Check if the content hash has changed for a source.

    Args:
        source_id: The unique source identifier
        new_hash: The new SHA256 hash to compare

    Returns:
        True if content has changed or source doesn't exist, False otherwise
    """
    existing_hash = get_source_hash(source_id)
    if existing_hash is None:
        return True  # New source
    return existing_hash != new_hash


def get_source_uuid(source_id: str) -> Optional[UUID]:
    """Get the internal UUID for a source.

    Args:
        source_id: The unique source identifier

    Returns:
        UUID if source exists, None otherwise
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "id" FROM "DocumentSource" WHERE "sourceId" = %s',
                (source_id,),
            )
            result = cur.fetchone()
            if not result:
                return None
            # Result is already a UUID object from psycopg
            uuid_value = result[0]
            return uuid_value if isinstance(uuid_value, UUID) else UUID(uuid_value)


def upsert_source(
    source_id: str,
    title: str,
    url: str,
    category: str,
    tags: list[str],
    description: Optional[str],
    published_at: Optional[datetime],
    notes: Optional[str],
    sha256: str,
    bytes_size: int,
    page_count: int,
    manifest: Optional[dict[str, Any]],
) -> UUID:
    """Insert or update a document source.

    Args:
        source_id: Unique source identifier
        title: Document title
        url: Source URL
        category: Category string
        tags: List of tags
        description: Optional description
        published_at: Optional publication timestamp
        notes: Optional notes
        sha256: Content hash
        bytes_size: File size in bytes
        page_count: Number of pages (0 for web content)
        manifest: Optional metadata dictionary

    Returns:
        UUID of the source record
    """
    now = datetime.now(timezone.utc)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check if source exists
            existing_uuid = get_source_uuid(source_id)

            if existing_uuid:
                # Update existing source
                cur.execute(
                    """
                    UPDATE "DocumentSource"
                    SET "title" = %s,
                        "url" = %s,
                        "category" = %s,
                        "tags" = %s,
                        "description" = %s,
                        "publishedAt" = %s,
                        "lastCheckedAt" = %s,
                        "notes" = %s,
                        "sha256" = %s,
                        "bytes" = %s,
                        "pageCount" = %s,
                        "manifest" = %s,
                        "updatedAt" = %s
                    WHERE "sourceId" = %s
                    RETURNING "id"
                    """,
                    (
                        title,
                        url,
                        category,
                        Jsonb(tags),
                        description,
                        published_at,
                        now,
                        notes,
                        sha256,
                        bytes_size,
                        page_count,
                        Jsonb(manifest) if manifest else None,
                        now,
                        source_id,
                    ),
                )
                result = cur.fetchone()
                conn.commit()
                # Result is already a UUID object from psycopg
                uuid_value = result[0]
                return uuid_value if isinstance(uuid_value, UUID) else UUID(uuid_value)

            # Insert new source
            new_id = uuid4()
            cur.execute(
                """
                INSERT INTO "DocumentSource" (
                    "id", "sourceId", "title", "url", "category", "tags",
                    "description", "publishedAt", "lastCheckedAt", "notes",
                    "sha256", "bytes", "pageCount", "manifest",
                    "createdAt", "updatedAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING "id"
                """,
                (
                    str(new_id),
                    source_id,
                    title,
                    url,
                    category,
                    Jsonb(tags),
                    description,
                    published_at,
                    now,
                    notes,
                    sha256,
                    bytes_size,
                    page_count,
                    Jsonb(manifest) if manifest else None,
                    now,
                    now,
                ),
            )
            conn.commit()
            return new_id


def delete_source_chunks(source_uuid: UUID) -> int:
    """Delete all chunks for a source.

    Args:
        source_uuid: Internal UUID of the source

    Returns:
        Number of chunks deleted
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM "DocumentChunk" WHERE "sourceId" = %s',
                (str(source_uuid),),
            )
            deleted_count = cur.rowcount
            conn.commit()
            return deleted_count


def bulk_insert_chunks(
    source_uuid: UUID, chunks: list[dict[str, Any]]
) -> int:
    """Insert multiple chunks for a source.

    Args:
        source_uuid: Internal UUID of the source
        chunks: List of chunk dictionaries with keys:
            - chunkId: str (format: "{sourceId}:00001")
            - text: str
            - tokenCount: int
            - pageStart: int
            - pageEnd: int
            - chunkType: str
            - sectionPath: Optional[list]
            - isTable: bool
            - tableId: Optional[str]
            - viewerAnchor: Optional[str]
            - metadata: Optional[dict]
            - order: int

    Returns:
        Number of chunks inserted
    """
    if not chunks:
        return 0

    now = datetime.now(timezone.utc)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Prepare bulk insert
            values = []
            for chunk in chunks:
                chunk_uuid = str(uuid4())
                section_path = chunk.get("sectionPath")
                metadata = chunk.get("metadata", {})
                values.append(
                    (
                        chunk_uuid,
                        str(source_uuid),
                        chunk["chunkId"],
                        chunk["text"],
                        chunk["tokenCount"],
                        chunk["pageStart"],
                        chunk["pageEnd"],
                        chunk["chunkType"],
                        Jsonb(section_path) if section_path else None,
                        chunk.get("isTable", False),
                        chunk.get("tableId"),
                        chunk.get("viewerAnchor"),
                        Jsonb(metadata),
                        chunk["order"],
                        now,
                    )
                )

            # Execute bulk insert
            cur.executemany(
                """
                INSERT INTO "DocumentChunk" (
                    "id", "sourceId", "chunkId", "text", "tokenCount",
                    "pageStart", "pageEnd", "chunkType", "sectionPath",
                    "isTable", "tableId", "viewerAnchor", "metadata",
                    "order", "createdAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                values,
            )
            inserted_count = cur.rowcount
            conn.commit()
            return inserted_count


def process_source_update(
    source_id: str,
    source_metadata: dict[str, Any],
    chunks: list[dict[str, Any]],
    sha256: str,
) -> tuple[UUID, int]:
    """Process a complete source update: upsert source and replace chunks.

    This is a transactional operation that:
    1. Upserts the source with new metadata and hash
    2. Deletes all existing chunks for the source
    3. Inserts new chunks

    Args:
        source_id: Unique source identifier
        source_metadata: Dictionary with source fields (title, url, etc.)
        chunks: List of chunk dictionaries
        sha256: Content hash

    Returns:
        Tuple of (source_uuid, chunks_inserted_count)
    """
    # Use a single connection for the entire transaction
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            now = datetime.now(timezone.utc)

            # Check if source exists
            cur.execute(
                'SELECT "id" FROM "DocumentSource" WHERE "sourceId" = %s',
                (source_id,),
            )
            result = cur.fetchone()

            if result:
                # Update existing source
                existing_uuid = result[0]
                if isinstance(existing_uuid, UUID):
                    source_uuid = existing_uuid
                else:
                    source_uuid = UUID(existing_uuid)

                cur.execute(
                    """
                    UPDATE "DocumentSource"
                    SET "title" = %s,
                        "url" = %s,
                        "category" = %s,
                        "tags" = %s,
                        "description" = %s,
                        "publishedAt" = %s,
                        "lastCheckedAt" = %s,
                        "notes" = %s,
                        "sha256" = %s,
                        "bytes" = %s,
                        "pageCount" = %s,
                        "manifest" = %s,
                        "updatedAt" = %s
                    WHERE "sourceId" = %s
                    """,
                    (
                        source_metadata["title"],
                        source_metadata["url"],
                        source_metadata["category"],
                        Jsonb(source_metadata.get("tags", [])),
                        source_metadata.get("description"),
                        source_metadata.get("published_at"),
                        now,
                        source_metadata.get("notes"),
                        sha256,
                        source_metadata["bytes"],
                        source_metadata.get("page_count", 0),
                        Jsonb(source_metadata.get("manifest")) if source_metadata.get("manifest") else None,
                        now,
                        source_id,
                    ),
                )
            else:
                # Insert new source
                source_uuid = uuid4()
                cur.execute(
                    """
                    INSERT INTO "DocumentSource" (
                        "id", "sourceId", "title", "url", "category", "tags",
                        "description", "publishedAt", "lastCheckedAt", "notes",
                        "sha256", "bytes", "pageCount", "manifest",
                        "createdAt", "updatedAt"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(source_uuid),
                        source_id,
                        source_metadata["title"],
                        source_metadata["url"],
                        source_metadata["category"],
                        Jsonb(source_metadata.get("tags", [])),
                        source_metadata.get("description"),
                        source_metadata.get("published_at"),
                        now,
                        source_metadata.get("notes"),
                        sha256,
                        source_metadata["bytes"],
                        source_metadata.get("page_count", 0),
                        Jsonb(source_metadata.get("manifest")) if source_metadata.get("manifest") else None,
                        now,
                        now,
                    ),
                )

            # Delete old chunks in same transaction
            cur.execute(
                'DELETE FROM "DocumentChunk" WHERE "sourceId" = %s',
                (str(source_uuid),),
            )

            # Insert new chunks in same transaction
            chunks_count = 0
            if chunks:
                values = []
                for chunk in chunks:
                    chunk_uuid = str(uuid4())
                    section_path = chunk.get("sectionPath")
                    metadata = chunk.get("metadata", {})
                    values.append(
                        (
                            chunk_uuid,
                            str(source_uuid),
                            chunk["chunkId"],
                            chunk["text"],
                            chunk["tokenCount"],
                            chunk["pageStart"],
                            chunk["pageEnd"],
                            chunk["chunkType"],
                            Jsonb(section_path) if section_path else None,
                            chunk.get("isTable", False),
                            chunk.get("tableId"),
                            chunk.get("viewerAnchor"),
                            Jsonb(metadata),
                            chunk["order"],
                            now,
                        )
                    )

                cur.executemany(
                    """
                    INSERT INTO "DocumentChunk" (
                        "id", "sourceId", "chunkId", "text", "tokenCount",
                        "pageStart", "pageEnd", "chunkType", "sectionPath",
                        "isTable", "tableId", "viewerAnchor", "metadata",
                        "order", "createdAt"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    values,
                )
                chunks_count = cur.rowcount

            # Commit the transaction
            conn.commit()

            return source_uuid, chunks_count
