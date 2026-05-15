#!/usr/bin/env python3
"""
Build public/card/1.4.json: mnemonic drawing DSL → hex bytecode (same encoding as draw.js).

Line tokens (straight segments, ab=00; tri nibble allows −3..+4 per byte):
  (dN)  N=1..4  — N units down  (+y)
  (uN)  N=1..4  — N units up    (−y); N=4 is two bytes (−3 then −1)
  (lN)  N=1..4  — N units left  (−x); N=4 is two bytes
  (rN)  N=1..4  — N units right (+x)

Straight diagonal lines (one straight segment, ab=00; both axes non-zero; tri −3..+4 each):
  (rN1dN2) (rN1uN2) (lN1dN2) (lN1uN2) — e.g. (r2d2) → enc_line(+2,+2); (l3u2) → enc_line(-3,-2).
  Omit pairs outside that range (same limits as compound arcs). Not the same as arcs (cr2d2).

Invisible line moves (pen up, ab=11; same grid deltas as visible counterparts):
  ((dN)) ((uN)) ((lN)) ((rN)) — cardinal; same N / two-byte u4,l4 as (dN) lines.
  ((rN1dN2)) ((rN1uN2)) ((lN1dN2)) ((lN1uN2)) — straight diagonal quiet moves (same valid pairs as (rN1dN2)).
  No ((cuN))…: no invisible arc byte; chain ((rN))((uN)) or similar if needed.

Point:
  (*) — draws a dot (byte 08, ab=01 zero tri in draw.js).

Short arc tokens (quarter arcs; diagonal endpoint (±N,∓N); tri range limits |neg|≤3):
  (cuN) (clN) (crN)  N=1..3 — arc_v (lowercase c); cr also allows N=4 (both deltas +)
  (CuN) (ClN) (CrN)         — arc_h (uppercase C); Cr allows N=4
    cu: right+up   (+N,-N)    cl: left+up   (-N,-N)    cr: right+down (+N,+N)

Compound arc tokens (arc_v with lowercase c, arc_h with uppercase C):
  (cl2u3) — 2 left, 3 up   → arc_v(-2,-3)
  (cr1d2) — 1 right, 2 down → arc_v(1,2)
  First axis letter must be l or r; second must be u or d (so both dx,dy ≠ 0).

Optional:
  (.) — row snap (byte 00, same as Latin glyphs often end with)
  (*) — draw a point at the current pen position

Quenya (first rule line, letter → output; then main line expands mnemonics → hex):
  a,b — your hand-tuned starters (constants in this file).
  c–z — hand-authored in tools/quenya_cz_mnemonics.py (telco/lúva-style sketches per Smith
  tengwa name), same DSL vocabulary as a/b — not copied from card 1.3. Preview and edit there.

Run: python3 tools/gen_card_1_4_dsl.py

If public/card/1.4.json already exists, the script merges options and default input only.
It does **not** replace an existing non-empty ``rule`` unless you pass ``--force-rule``
(so hand-edited Quenya + mnemonic tables in the JSON are preserved).

Run: python3 tools/gen_card_1_4_dsl.py
      python3 tools/gen_card_1_4_dsl.py --force-rule   # overwrite rule from this generator

Rule formatting: non-comment lines are split on whitespace into many source,target pairs;
each line is one applyRuleTransforms pass over the input. All pairs live on one line
here (after // comments) so the engine does a single pass instead of one pass per pair.
"""

from __future__ import annotations

import argparse
import json
import string
from pathlib import Path

from quenya_cz_mnemonics import QUENYA_CZ
from tengwar_hex_codec import enc_arc_h, enc_arc_v, enc_dot, enc_line, enc_move, enc_snap

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "public" / "card" / "1.4.json"

DEFAULT_OPTIONS: dict = {
    "size": 14,
    "backgroundColor": "#000000",
    "italics": True,
    "animate": False,
    "svgColor": True,
    # Grid is 5×3 (see static/cards.js displaySet); row 1 is often 1.1–1.3.
    "position": {"row": 2, "col": 1},
}

DEFAULT_INPUT = (
    "(r1)(d2)(l1)(u2)||\n"
    "(cu2)(cl2)(cr2)||\n"
    "(cl2u3)(Cr1d2)||\n"
    "(r2d2)(l1u1)||\n"
    "(r2)(d2)(r2)(u2)(l4)(.)||\n"
    "((r2))(d1)(*)"
)

# First rule pass: letter → mnemonic chains. Second pass (main pairs line): mnemonics → hex.
QUENYA_MANUAL_A = "(cl1d1)(Cr1d1)(cr1u1)(u1)(d4)((r2))(.)"
QUENYA_MANUAL_B = (
    "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))"
    "((l3u2))((l3))(r4)((r2))(.)"
)
QUENYA_PAIR_COUNT = 26


def build_quenya_rule_block() -> str:
    pairs = [f"a,{QUENYA_MANUAL_A}", f"b,{QUENYA_MANUAL_B}"]
    for ch in string.ascii_lowercase[2:]:
        pairs.append(f"{ch},{QUENYA_CZ[ch]}")
    return "// Quenya\n" + " ".join(pairs)


def _validate_quenya_against_sources(sources: set[str]) -> None:
    """Every Quenya parenthesis-token must be a defined rule source (handles nested ((…)))."""
    sorted_src = sorted(sources, key=len, reverse=True)

    def consume_chain(chain: str, label: str) -> None:
        i = 0
        while i < len(chain):
            if chain[i] != "(":
                raise ValueError(f"Quenya {label}: expected '(' at {i} in {chain[:100]!r}…")
            matched = False
            for src in sorted_src:
                if chain.startswith(src, i):
                    matched = True
                    i += len(src)
                    break
            if not matched:
                raise ValueError(
                    f"Quenya {label}: no rule source matches at {i}: {chain[i : i + 40]!r}…"
                )

    for label, chain in (
        ("a", QUENYA_MANUAL_A),
        ("b", QUENYA_MANUAL_B),
        *((ch, QUENYA_CZ[ch]) for ch in sorted(QUENYA_CZ)),
    ):
        consume_chain(chain, label)


def hx1(b: int) -> str:
    return f"{b:02X}"


def straight_diagonal_line_rules() -> list[tuple[str, str]]:
    """(rN1dN2) etc.: one enc_line byte, straight diagonal. Must list before (rN) in rule (prefix)."""
    out: list[tuple[str, str]] = []
    quads: list[tuple[str, str, int, int]] = [
        ("r", "d", 1, 1),
        ("r", "u", 1, -1),
        ("l", "d", -1, 1),
        ("l", "u", -1, -1),
    ]
    for h1, h2, sx, sy in quads:
        for n1 in range(1, 5):
            for n2 in range(1, 5):
                dx, dy = sx * n1, sy * n2
                if not (-3 <= dx <= 4 and -3 <= dy <= 4):
                    continue
                src = f"({h1}{n1}{h2}{n2})"
                out.append((src, hx1(enc_line(dx, dy))))
    return out


def invisible_straight_diagonal_line_rules() -> list[tuple[str, str]]:
    """((rN1dN2)) etc.: enc_move, same deltas as straight_diagonal_line_rules."""
    out: list[tuple[str, str]] = []
    quads: list[tuple[str, str, int, int]] = [
        ("r", "d", 1, 1),
        ("r", "u", 1, -1),
        ("l", "d", -1, 1),
        ("l", "u", -1, -1),
    ]
    for h1, h2, sx, sy in quads:
        for n1 in range(1, 5):
            for n2 in range(1, 5):
                dx, dy = sx * n1, sy * n2
                if not (-3 <= dx <= 4 and -3 <= dy <= 4):
                    continue
                src = f"(({h1}{n1}{h2}{n2}))"
                out.append((src, hx1(enc_move(dx, dy))))
    return out


def invisible_line_rules() -> list[tuple[str, str]]:
    """Double-parens: enc_move (ab=11), same deltas as line_rules."""
    out: list[tuple[str, str]] = []
    for n in range(1, 5):
        out.append((f"((d{n}))", hx1(enc_move(0, n))))
        out.append((f"((r{n}))", hx1(enc_move(n, 0))))
    for n in range(1, 4):
        out.append((f"((u{n}))", hx1(enc_move(0, -n))))
        out.append((f"((l{n}))", hx1(enc_move(-n, 0))))
    out.append(("((u4))", hx1(enc_move(0, -3)) + hx1(enc_move(0, -1))))
    out.append(("((l4))", hx1(enc_move(-3, 0)) + hx1(enc_move(-1, 0))))
    return out


def line_rules() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for n in range(1, 5):
        out.append((f"(d{n})", hx1(enc_line(0, n))))
        out.append((f"(r{n})", hx1(enc_line(n, 0))))
    for n in range(1, 4):
        out.append((f"(u{n})", hx1(enc_line(0, -n))))
        out.append((f"(l{n})", hx1(enc_line(-n, 0))))
    # Single-byte grid max is |3| on negative tri; 4 up/left = two moves.
    out.append(("(u4)", hx1(enc_line(0, -3)) + hx1(enc_line(0, -1))))
    out.append(("(l4)", hx1(enc_line(-3, 0)) + hx1(enc_line(-1, 0))))
    return out


def short_arc_rules() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for n in range(1, 4):
        out.append((f"(cu{n})", hx1(enc_arc_v(n, -n))))
        out.append((f"(cl{n})", hx1(enc_arc_v(-n, -n))))
        out.append((f"(Cu{n})", hx1(enc_arc_h(n, -n))))
        out.append((f"(Cl{n})", hx1(enc_arc_h(-n, -n))))
    for n in range(1, 5):
        # +/+ diagonal fits tri 4 on both axes; negative magnitudes capped at 3 above.
        out.append((f"(cr{n})", hx1(enc_arc_v(n, n))))
        out.append((f"(Cr{n})", hx1(enc_arc_h(n, n))))
    return out


def compound_arc_rules() -> list[tuple[str, str]]:
    """(cl2u3), (Cr1d2), etc.: c/C + lr + digit + ud + digit."""
    out: list[tuple[str, str]] = []
    horiz = {"l": -1, "r": 1}
    vert = {"u": -1, "d": 1}
    for cap, arc_fn in (("c", enc_arc_v), ("C", enc_arc_h)):
        for h, sgnx in horiz.items():
            for v, sgny in vert.items():
                for n1 in range(1, 5):
                    for n2 in range(1, 5):
                        dx = sgnx * n1
                        dy = sgny * n2
                        # draw.js tri nibble: -3..+4 per axis
                        if not (-3 <= dx <= 4 and -3 <= dy <= 4):
                            continue
                        src = f"({cap}{h}{n1}{v}{n2})"
                        out.append((src, hx1(arc_fn(dx, dy))))
    return out


def build_rule_string() -> str:
    comments = [
        "// Line moves (ab=00). y+ = down on grid.",
        "// ((dN)) ((rN1dN2)) etc.: invisible moves (ab=11); no ((c…)) arcs.",
        "// (*): point/dot (byte 08). Arcs: lowercase c = arc_v, uppercase C = arc_h.",
        "// Straight diagonals: (r2d2) one segment; arcs need leading c/C, e.g. (cr2d2).",
        "// Short arcs (cuN); compound arcs (cl2u3) — curved, not straight diagonals.",
    ]
    all_pairs: list[tuple[str, str]] = [
        *invisible_line_rules(),
        *invisible_straight_diagonal_line_rules(),
        *straight_diagonal_line_rules(),
        *line_rules(),
        *short_arc_rules(),
        *compound_arc_rules(),
        ("(.)", hx1(enc_snap())),
        ("(*)", hx1(enc_dot())),
    ]
    pairs_line = " ".join(f"{src},{tgt}" for src, tgt in all_pairs)
    sources = {src for src, _ in all_pairs}
    _validate_quenya_against_sources(sources)
    return build_quenya_rule_block() + "\n" + "\n".join([*comments, pairs_line])


def main() -> None:
    parser = argparse.ArgumentParser(description="Build or merge public/card/1.4.json")
    parser.add_argument(
        "--force-rule",
        action="store_true",
        help="Replace an existing card's rule with the generated rule (default: keep your rule).",
    )
    args = parser.parse_args()

    rule = build_rule_string()
    n_rules = (
        QUENYA_PAIR_COUNT
        + len(invisible_line_rules())
        + len(invisible_straight_diagonal_line_rules())
        + len(straight_diagonal_line_rules())
        + len(line_rules())
        + len(short_arc_rules())
        + len(compound_arc_rules())
        + 2
    )

    if OUT.exists():
        try:
            raw = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raw = {}
        if not isinstance(raw, dict):
            raw = {}
        card = dict(raw)
        # Merge options: keep your values, add any missing default keys (e.g. position).
        user_opts = card.get("options")
        if isinstance(user_opts, dict):
            merged_pos = {
                **DEFAULT_OPTIONS.get("position", {}),
                **(user_opts.get("position") or {}),
            }
            card["options"] = {**DEFAULT_OPTIONS, **user_opts, "position": merged_pos}
        else:
            card["options"] = dict(DEFAULT_OPTIONS)
        if not str(card.get("input") or "").strip():
            card["input"] = DEFAULT_INPUT
        existing_rule = str(card.get("rule") or "").strip()
        if args.force_rule or not existing_rule:
            card["rule"] = rule
            msg = f"replaced rule ({n_rules} mnemonic→hex pairs in body line)"
        else:
            msg = "kept your rule (pass --force-rule to replace from generator)"
        print(f"Merged {OUT}: {msg}")
    else:
        card = {
            "options": dict(DEFAULT_OPTIONS),
            "rule": rule,
            "input": DEFAULT_INPUT,
        }
        print(f"Wrote new {OUT} ({n_rules} rule replacements)")

    OUT.write_text(json.dumps(card, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
