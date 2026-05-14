#!/usr/bin/env python3
"""
Write public/card/1.3.json — Tengwar Quenya lowercase (a–z) using the hex stroke
system. See tools/tengwar_quenya_lowercase_glyphs.py for Smith keyboard mapping
and hand-tuned stroke bodies.

Run from repo root:
  python3 tools/gen_tengwar_quenya_card13.py
"""

from __future__ import annotations

import json
from pathlib import Path

from tengwar_quenya_lowercase_glyphs import build_lowercase_rule_line, lowercase_demo_input

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "public" / "card" / "1.3.json"


def main() -> None:
    card = {
        "options": {
            "size": 14,
            "backgroundColor": "#000000",
            "italics": True,
            "animate": False,
            "svgColor": True,
            "position": {"row": 1, "col": 3},
        },
        "rule": build_lowercase_rule_line(),
        "input": lowercase_demo_input(),
    }
    OUT.write_text(json.dumps(card, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} (lowercase a–z only)")


if __name__ == "__main__":
    main()
