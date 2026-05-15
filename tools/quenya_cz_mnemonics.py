"""
Hand-authored Quenya lowercase c–z for card 1.4 (Smith / Dan Smith keyboard → tengwa).

These are *not* copied from card 1.3 hex. They use the same DSL vocabulary as the
user’s a/b starters: compound arcs (cl1d1)(Cr1d1), short arcs (cr1u1)(cu2), lines,
invisible moves ((r2)), straight diagonals (r1d1), dot (*), row snap (.).

Each line is a first-pass “telco + lúva” sketch for that tengwa’s usual silhouette;
preview in the app and tweak here (or in gen_card_1_4_dsl overrides) until happy.
"""

from __future__ import annotations

import string

# Same opening bowl as user’s a/b: arc_v NW corner + arc_h SE quarter + arc_v SE hook.
BOWL_CALMA = "(cl1d1)(Cr1d1)(cr1u1)"

# Shorter harma-style hook (less “calma” closure than full BOWL_CALMA + cr1u1 tail).
HARMA_HOOK = "(cl1d1)(Cr1d1)"

QUENYA_CZ: dict[str, str] = {
    # c–k: user-authored (restored after generator merge overwrote card 1.4).
    "c": "(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((l2u2))(r2)((r2))(.)",
    "d": "(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((r2))(.)",
    "e": "((l1u2))(d4)((u1))(Cr1u1)(cr1d1)(Cl1d1)(l1)(r2)((r2))(.)",
    "f": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u3)(d4)((r2))(.)",
    "g": "(cl1d1)(Cr1d1)(cr1u1)((r1u1))(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    "h": "(cl1d1)(Cr1d1)(cr1u1)(u1)(d2)((r2))(.)",
    "i": "((d2))(cl1u1)(Cr1u1)(cr1d1)(d1)(Cl1d1)(cl1d1)((r3))(.)",
    "j": "(r4)((l2))(l1d1)(d1)(Cr1d1)(cr1u1)((r2))(.)",
    "k": "((r2u1))(Cl1d1)(cl1d1)(d1)(Cr1d1)(cr1u1)(Cl1u1)((u2))(.)",
    # l–z: first-pass sketches (edit freely).
    "l": f"{BOWL_CALMA}(d2)(Cu1)(cl1u1)((r2))(.)",
    "m": f"{BOWL_CALMA}(d1){BOWL_CALMA}(d1)((r2))(.)",
    "n": f"{BOWL_CALMA}(u1)(d2)(cr1u1)((r2))(.)",
    "o": "(cr2)(cl2)(u1)(d2)((r2))(.)",
    "p": "((d2))(r1)(d2)((r2))(.)",
    "q": "(Cr1d1)(cl1d1)(cr1u1)(u1)(d4)((r2))(.)",
    "r": f"{HARMA_HOOK}(cr1u1)(d3)((r2))(.)",
    "s": "(Cr1d1)(cl1d1)(d3)(cu1)((r2))(.)",
    "t": "((d1))(r2)(d3)((l1))(d1)(r1)((r2))(.)",
    "u": f"{BOWL_CALMA}(u1)(d2)((r2u2))(d2)((r2))(.)",
    "v": "(cl2d2)(cr2)(u1)((r2))(.)",
    "w": f"{BOWL_CALMA}((r1u1)){BOWL_CALMA}((r2))(.)",
    "x": "(Cu2)(cl2d2)((r2))(.)",
    "y": "(cr1u1)(d2)(l1u1)(r2)((r2))(.)",
    "z": "((r1))(d2)(r1)(d2)(r1)(d2)" + BOWL_CALMA + "((r2))(.)",
}

_expected = set(string.ascii_lowercase[2:])
assert set(QUENYA_CZ.keys()) == _expected, sorted(set(QUENYA_CZ.keys()) ^ _expected)
