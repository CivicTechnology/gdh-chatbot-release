"""Environment variable loading utilities."""

from __future__ import annotations

import os
from pathlib import Path


def load_env() -> None:
    """
    Load environment variables from .env.local first, then .env
    This ensures local development variables take precedence.

    In production, environment variables are provided by the platform
    and .env files are not needed or used.
    """
    # Skip loading .env files if we're in production environment
    if os.getenv("NODE_ENV") == "production":
        return

    # Find project root (where .env files are located)
    current = Path(__file__).resolve()
    project_root = current.parents[4]  # Go up from shared/ -> collectors/ -> ingestion/ -> packages/ -> root

    # Try to load .env.local first, then fall back to .env
    env_local = project_root / ".env.local"
    env_default = project_root / ".env"

    if env_local.exists():
        _load_env_file(env_local)
    elif env_default.exists():
        _load_env_file(env_default)


def _load_env_file(path: Path) -> None:
    """Load environment variables from a file."""
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue

            # Parse KEY=VALUE
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()

                # Remove quotes if present
                if value and value[0] in ('"', "'") and value[-1] == value[0]:
                    value = value[1:-1]

                # Only set if not already in environment
                if key and key not in os.environ:
                    os.environ[key] = value
