"""
First-pass Tengwar Quenya lowercase (a–z) for the WFO hex stroke system.

Keyboard → tengwa names follow Daniel Steven Smith’s Tengwar Quenya help
(TengwarHelp.pdf in the font package; same distribution as
https://www.dafont.com/tengwar-quenya.font ): chart columns align with
keyboard rows 1–9, q–o, a–l, z–.

Each letter’s strokes are hand-designed for that tengwa’s usual silhouette
(right telco, left lúva / bowls, descenders, twin stems, etc.) within the
stroke grammar—tweaked until all 26 finish at grid cell (6,1) like card 1.1
and produce distinct hex. This is not auto-generated; it is meant to be
revised by eye when previewing the card.

  python3 tools/gen_tengwar_quenya_card13.py
"""

from __future__ import annotations

import string

from tengwar_hex_codec import (
    enc_arc_h,
    enc_arc_v,
    enc_dot,
    enc_line,
    enc_move,
    finish_to_cell,
    to_hex,
)

# Smith grid: same rows as tools/gen_tengwar_quenya_card13.py
_ROW_KEYS = [
    ("1", "q", "a", "z"),
    ("2", "w", "s", "x"),
    ("3", "e", "d", "c"),
    ("4", "r", "f", "v"),
    ("5", "t", "g", "b"),
    ("6", "y", "h", "n"),
    ("7", "u", "j", "m"),
    ("8", "i", "k", ","),
    ("9", "o", "l", "."),
    ("0", "p", ";", "/"),
]
_SMITH_NAMES = [
    ("tinco", "parma", "calma", "quesse"),
    ("ando", "umbar", "anga", "ungwe"),
    ("thule", "formen", "harma", "hwesta"),
    ("anto", "ampa", "anca", "unque"),
    ("numen", "malta", "noldo", "nwalme"),
    ("ore", "vala", "anna", "vilya"),
    ("romen", "arda", "lambe", "alda"),
    ("silme", "silme_nuquerna", "esse", "esse_nuquerna"),
    ("hyarmen", "hwesta_sindarinwa", "yanta", "ure"),
    ("halla", "telco", "ara", "unused_fourth"),
]


def lowercase_key_to_tengwa() -> dict[str, str]:
    m: dict[str, str] = {}
    for keys, names in zip(_ROW_KEYS, _SMITH_NAMES):
        for k, name in zip(keys, names):
            if len(k) == 1 and k.isalpha() and k.islower():
                m[k] = name
    return m


# Stroke bodies (no trailing snap; finish_to_cell appends moves + 0x00).
# v2: silhouette-first (telco + lúva / descenders / twin stems); all validated
# unique and ending at (6,1).
_HAND_BODIES: dict[str, list[int]] = {
    # calma (key a): low bowl + right telco (single-storey “a”), not a tall stem with a high bowl.
    "calma": [
        enc_move(0, 2),
        enc_line(2, 0),
        enc_arc_v(-2, -2),
        enc_line(2, 0),
        enc_line(0, 3),
    ],
    "parma": [enc_move(2, 0), enc_line(0, 3), enc_arc_v(-2, -2), enc_line(2, 0)],
    "quesse": [enc_move(1, 0), enc_line(0, 2), enc_line(2, 0), enc_line(0, 2), enc_arc_v(-2, -2), enc_line(1, 0)],
    "umbar": [
        enc_move(1, 0),
        enc_line(0, 2),
        enc_arc_v(-2, 2),
        enc_line(0, 2),
        enc_arc_v(2, -2),
        enc_line(1, 0),
    ],
    "anga": [enc_move(1, 0), enc_line(0, 3), enc_line(2, -1), enc_line(-2, -1), enc_line(2, 1), enc_line(1, 0)],
    "ungwe": [enc_move(1, 0), enc_line(0, 2), enc_arc_h(2, -2), enc_arc_h(-2, -2), enc_line(2, 0)],
    "formen": [
        enc_move(1, 0),
        enc_line(0, 1),
        enc_line(2, 0),
        enc_move(-2, 0),
        enc_line(0, 2),
        enc_line(1, 0),
        enc_line(2, 0),
    ],
    "harma": [
        enc_move(1, 0),
        enc_line(0, 3),
        enc_move(-1, -3),
        enc_line(0, 2),
        enc_line(3, 0),
        enc_move(-2, 0),
        enc_line(0, 1),
        enc_line(2, 0),
    ],
    "hwesta": [enc_move(1, 0), enc_arc_v(2, -2), enc_arc_v(-2, -2), enc_arc_v(2, 2), enc_line(1, 0)],
    "ampa": [enc_move(1, 0), enc_line(0, 2), enc_arc_v(2, 2), enc_line(0, -2), enc_line(1, 0), enc_line(1, 0)],
    "anca": [enc_move(1, 0), enc_line(0, 2), enc_arc_v(-2, 2), enc_line(2, -1), enc_line(0, 1), enc_line(1, 0)],
    "unque": [enc_move(1, 0), enc_line(0, 3), enc_line(2, -2), enc_line(-1, -1), enc_line(2, 0)],
    "malta": [enc_move(0, 1), enc_line(3, 0), enc_line(0, 2), enc_arc_v(-2, 2), enc_line(1, 0)],
    "noldo": [enc_move(2, 0), enc_line(0, 2), enc_line(0, 3), enc_arc_v(-2, 2), enc_line(2, -2)],
    "nwalme": [
        enc_move(1, 0),
        enc_line(0, 2),
        enc_line(1, 1),
        enc_line(-1, 1),
        enc_line(1, -1),
        enc_line(1, 0),
        enc_line(2, 0),
    ],
    "vala": [enc_move(1, 0), enc_line(1, 2), enc_line(1, -2), enc_line(-2, 2), enc_line(2, 0)],
    "anna": [
        enc_move(1, 0),
        enc_line(0, 2),
        enc_arc_v(2, -2),
        enc_arc_v(-2, -2),
        enc_line(0, 2),
        enc_line(1, 0),
    ],
    "vilya": [enc_move(2, 0), enc_line(0, 2), enc_arc_h(-2, 2), enc_line(0, 1), enc_line(2, 0)],
    "arda": [enc_move(1, 0), enc_line(0, 3), enc_line(2, -2), enc_line(-2, 0), enc_line(2, 1), enc_line(1, -1)],
    "lambe": [enc_move(1, 0), enc_line(0, 4), enc_arc_v(-2, -2), enc_line(2, -1), enc_line(0, 1)],
    "alda": [
        enc_move(1, 0),
        enc_line(0, 2),
        enc_arc_v(-2, 2),
        enc_line(0, 1),
        enc_arc_v(-2, 2),
        enc_line(2, 0),
    ],
    "silme_nuquerna": [
        enc_move(1, 0),
        enc_move(0, 1),
        enc_dot(),
        enc_move(0, -1),
        enc_line(0, 2),
        enc_arc_v(2, -2),
        enc_arc_v(-2, -2),
        enc_line(2, 0),
    ],
    "esse": [enc_move(1, 0), enc_line(0, 1), enc_line(2, 1), enc_line(0, 1), enc_line(-2, 1), enc_line(2, 0)],
    "hwesta_sindarinwa": [
        enc_move(1, 0),
        enc_line(0, 1),
        enc_arc_v(2, 2),
        enc_line(0, 1),
        enc_line(1, 0),
        enc_line(1, 0),
    ],
    "yanta": [enc_move(1, 0), enc_line(0, 3), enc_move(2, -2), enc_line(0, 3), enc_move(-2, -3), enc_line(2, 0)],
    "telco": [enc_move(2, 0), enc_line(0, 2), enc_line(1, 0), enc_line(0, -1), enc_line(2, 0)],
}


def build_lowercase_hex() -> dict[str, str]:
    key_tw = lowercase_key_to_tengwa()
    out: dict[str, str] = {}
    for ch in string.ascii_lowercase:
        tw = key_tw[ch]
        body = _HAND_BODIES[tw]
        done = finish_to_cell(body)
        if not done:
            raise RuntimeError(f"finish_to_cell failed for {ch!r} ({tw})")
        out[ch] = to_hex(done)
    if len(set(out.values())) != 26:
        raise RuntimeError("lowercase glyph hex strings are not all unique")
    return out


LOWERCASE_HEX: dict[str, str] = build_lowercase_hex()


def lowercase_demo_input() -> str:
    return "abcdefghijklmnopqrstuvwxyz"


def build_lowercase_rule_line() -> str:
    return " ".join(f"{ch},{LOWERCASE_HEX[ch]}" for ch in string.ascii_lowercase)
