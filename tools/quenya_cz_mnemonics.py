"""
Hand-authored Quenya lowercase c–z for card 1.4 (Smith / Dan Smith keyboard → tengwa).

Shape cues follow the **Dan Smith Tengwar Quenya** lowercase chart (telco stems, U-bowls,
top bars, hooks, tilde / square / loop accents) — same DSL moves as your a–k starters.

Edit chains after preview in the app; run ``python3 tools/gen_card_1_4_dsl.py --force-rule``
when you want the JSON rule refreshed from this file.
"""

from __future__ import annotations

import string

QUENYA_CZ: dict[str, str] = {
    # c–k: user-authored (source of truth — keep in sync with your Quenya line).
    "c": "(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((l2u2))(r2)((r2))(.)",
    "d": "(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((r2))(.)",
    "e": "((l1u2))(d4)((u1))(Cr1u1)(cr1d1)(Cl1d1)(l1)(r2)((r2))(.)",
    "f": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((r2))(.)",
    "g": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    "h": "(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    "i": "((d2))(cl1u1)(Cr1u1)(cr1d1)(d1)(Cl1d1)(cl1d1)((r3))(.)",
    "j": "(r4)((l2))(l1d1)(d1)(Cr1d1)(cr1u1)((r2))(.)",
    "k": "((r2u2))(Cl1d1)(cl1d1)(d1)(Cr1d1)(cr1u1)(Cl1u1)((r2))(.)",
    # l–z: l user-authored; m–z chart-informed first pass (Dan Smith Quenya reference).
    "l": "((d2))(r2u2)(Cr1d2)((r2))(.)",
    # m: top bar + two n-bowls (twin bowls under a short telco run).
    "m": "(r2)(cl1d1)(Cr1d1)(cr1u1)(d1)(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    # n: top bar + single n-bowl.
    "n": "(r2)(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    # o: U-bowl + telco up + small right foot.
    "o": "(cl1d1)(Cr1d1)(cr1u1)(u1)(d3)(r1)((r2))(.)",
    # p: tilde-like wave (short zig).
    "p": "(r1d1)(l1d1)(r1d1)(l1d1)((r2))(.)",
    # q: stem down on the left + loop cluster low on the stem (cf. calma family, mirrored).
    "q": "((l1))(d4)(cr1u1)(cr1d1)((r2))(.)",
    # r: stem / bowl + left hook emphasis.
    "r": "((l1))(cl1d1)(Cr1d1)(cr1u1)(u2)(l1)((r2))(.)",
    # s: chart matches g in this font — reuse your g silhouette.
    "s": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    # t: two bowls linked by a top bar segment.
    "t": "(r2)(cl1d1)(Cr1d1)(cr1u1)(d1)(cl1d1)(Cr1d1)(cr1u1)(d2)((r2))(.)",
    # u: two stems with a crossing slash (approximate with diagonals between downs).
    "u": "(l1)(d2)(r1d1)(r1)(d2)((r2))(.)",
    # v: two bowls + top bar + stem up (close to your f; extra lift for the telco).
    "v": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)(u1)((r2))(.)",
    # w: stem on the left, double bowl to the right (mirror of g’s weighting).
    "w": "((l1))(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(d2)((r2))(.)",
    # x: like v but telco down on the right.
    "x": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)(d2)((r2))(.)",
    # y: small square / box (tight arc trio).
    "y": "(cl1u1)(cr1d1)(cu1)((r2))(.)",
    # z: stem down on the right + loop high on the left (mirror of q).
    "z": "((r1))(d4)(cl1u1)(cr1d1)((r2))(.)",
}

_expected = set(string.ascii_lowercase[2:])
assert set(QUENYA_CZ.keys()) == _expected, sorted(set(QUENYA_CZ.keys()) ^ _expected)
