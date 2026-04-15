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

    def insert_blank_set_after(self, after_set: int) -> int:
        """
        Renumber every card in sets ``after_set + 1`` and above to the next set number,
        leaving set ``after_set + 1`` empty on disk.

        Returns the new empty set index (always ``after_set + 1``).
        """
        ...

    def copy_set_into(self, from_set: int, to_set: int) -> None:
        """Replace all cards in ``to_set`` with copies of cards from ``from_set`` (same order indices)."""
        ...

    def delete_set_and_close_gap(self, set_num: int) -> None:
        """Remove all cards in ``set_num`` and renumber sets ``set_num + 1`` and above down by one."""
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

    def insert_blank_set_after(self, after_set: int) -> int:
        if after_set < 1:
            raise ValueError('after_set must be >= 1')
        inserted = after_set + 1
        self._dir.mkdir(parents=True, exist_ok=True)
        max_set = 0
        by_set: dict[int, list[Path]] = {}
        for f in self._dir.iterdir():
            if not f.is_file() or not CARD_NAME_RE.match(f.name):
                continue
            base = f.name.removesuffix('.json')
            set_part, _order = base.split('.', 1)
            s = int(set_part, 10)
            max_set = max(max_set, s)
            by_set.setdefault(s, []).append(f)
        for s in range(max_set, after_set, -1):
            for path in by_set.get(s, []):
                base = path.name.removesuffix('.json')
                _set_part, order = base.split('.', 1)
                new_name = f'{s + 1}.{order}.json'
                path.rename(self._dir / new_name)
        return inserted

    def copy_set_into(self, from_set: int, to_set: int) -> None:
        if from_set < 1 or to_set < 1:
            raise ValueError('set numbers must be >= 1')
        if from_set == to_set:
            raise ValueError('from and to must differ')
        self._dir.mkdir(parents=True, exist_ok=True)
        for path in list(self._dir.iterdir()):
            if not path.is_file() or not CARD_NAME_RE.match(path.name):
                continue
            base = path.name.removesuffix('.json')
            set_part, _order = base.split('.', 1)
            if int(set_part, 10) == to_set:
                path.unlink()
        for path in sorted(
            f for f in self._dir.iterdir() if f.is_file() and CARD_NAME_RE.match(f.name)
        ):
            base = path.name.removesuffix('.json')
            set_part, order = base.split('.', 1)
            if int(set_part, 10) != from_set:
                continue
            data: dict = json.loads(path.read_text(encoding='utf-8'))
            self.put(f'{to_set}.{order}.json', data)

    def delete_set_and_close_gap(self, set_num: int) -> None:
        if set_num < 1:
            raise ValueError('set_num must be >= 1')
        self._dir.mkdir(parents=True, exist_ok=True)
        paths = [
            f
            for f in self._dir.iterdir()
            if f.is_file() and CARD_NAME_RE.match(f.name)
        ]
        for path in paths:
            base = path.name.removesuffix('.json')
            set_part, _order = base.split('.', 1)
            if int(set_part, 10) == set_num:
                path.unlink()
        to_shift: list[tuple[int, str, Path]] = []
        for path in self._dir.iterdir():
            if not path.is_file() or not CARD_NAME_RE.match(path.name):
                continue
            base = path.name.removesuffix('.json')
            set_part, order = base.split('.', 1)
            s = int(set_part, 10)
            if s > set_num:
                to_shift.append((s, order, path))
        to_shift.sort(key=lambda t: (t[0], int(t[1], 10)))
        for s, order, path in to_shift:
            new_name = f'{s - 1}.{order}.json'
            path.rename(self._dir / new_name)


def get_card_store() -> CardStore:
    """Application entry point: change this to switch storage backends."""
    return LocalCardStore(_REPO_ROOT / 'public' / 'card')
