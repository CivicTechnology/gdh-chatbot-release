"""Hash utilities for content change detection."""

import hashlib
from pathlib import Path
from typing import BinaryIO


def compute_sha256_from_file(file_path: Path) -> str:
    """Compute SHA256 hash from a file.

    Args:
        file_path: Path to the file to hash

    Returns:
        Hexadecimal SHA256 hash string
    """
    hasher = hashlib.sha256()
    with file_path.open("rb") as fh:
        while chunk := fh.read(1024 * 1024):  # 1MB chunks
            hasher.update(chunk)
    return hasher.hexdigest()


def compute_sha256_from_stream(stream: BinaryIO) -> str:
    """Compute SHA256 hash from a binary stream.

    Args:
        stream: Binary stream to hash (must support read())

    Returns:
        Hexadecimal SHA256 hash string
    """
    hasher = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):  # 1MB chunks
        hasher.update(chunk)
    return hasher.hexdigest()


def compute_sha256_from_bytes(data: bytes) -> str:
    """Compute SHA256 hash from bytes.

    Args:
        data: Bytes to hash

    Returns:
        Hexadecimal SHA256 hash string
    """
    return hashlib.sha256(data).hexdigest()
