"""
Card persistence backend. Swap `get_card_store()` to use another implementation
(e.g. Supabase Storage) while keeping the same protocol for route handlers.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Protocol

_REPO_ROOT = Path(__file__).resolve().parent.parent


CARD_NAME_RE = re.compile(r'^\d+\.\d+\.json$')


class CardStore(Protocol):
    """List, write, and delete card JSON blobs by filename (e.g. ``1.3.json``)."""

    def list_filenames(self) -> list[str]:
        """Sorted valid card filenames."""
        ...

    def put(self, filename: str, data: dict) -> None:
        """Write or replace card JSON. Raises ``ValueError`` if filename is invalid."""
        ...

    def delete(self, filename: str) -> None:
        """
        Remove a card file.
        Raises ``ValueError`` if filename is invalid, ``FileNotFoundError`` if missing.
        """
        ...


class LocalCardStore:
    """Filesystem storage under a single directory (``public/card``)."""

    def __init__(self, directory: Path) -> None:
        self._dir = directory

    def _validate(self, filename: str) -> None:
        if not CARD_NAME_RE.match(filename):
            raise ValueError('Invalid card filename')

    def list_filenames(self) -> list[str]:
        self._dir.mkdir(parents=True, exist_ok=True)
        return sorted(
            f.name
            for f in self._dir.iterdir()
            if f.is_file() and CARD_NAME_RE.match(f.name)
        )

    def put(self, filename: str, data: dict) -> None:
        self._validate(filename)
        self._dir.mkdir(parents=True, exist_ok=True)
        path = self._dir / filename
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + '\n',
            encoding='utf-8',
        )

    def delete(self, filename: str) -> None:
        self._validate(filename)
        path = self._dir / filename
        if not path.is_file():
            raise FileNotFoundError(filename)
        path.unlink()


def get_card_store() -> CardStore:
    """Application entry point: change this to switch storage backends."""
    return LocalCardStore(_REPO_ROOT / 'public' / 'card')
