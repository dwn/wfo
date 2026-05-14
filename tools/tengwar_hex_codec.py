"""Shared hex stroke encoding for draw.js buildOps (see static/wfo.html)."""

from __future__ import annotations


def tri_bits_to_signed(v3: int) -> int:
    return v3 if v3 <= 4 else (4 - v3)


def enc_tri(n: int) -> int:
    assert -3 <= n <= 4
    return n & 7 if n >= 0 else (4 - n) & 7


def enc_move(dx: int, dy: int) -> int:
    return (1 << 7) | (enc_tri(dx) << 4) | (1 << 3) | enc_tri(dy)


def enc_line(dx: int, dy: int) -> int:
    return (0 << 7) | (enc_tri(dx) << 4) | (0 << 3) | enc_tri(dy)


def enc_arc_v(dx: int, dy: int) -> int:
    assert dx != 0 and dy != 0
    return (0 << 7) | (enc_tri(dx) << 4) | (1 << 3) | enc_tri(dy)


def enc_arc_h(dx: int, dy: int) -> int:
    assert dx != 0 and dy != 0
    return (1 << 7) | (enc_tri(dx) << 4) | (0 << 3) | enc_tri(dy)


def enc_dot() -> int:
    return 0x08


def enc_snap() -> int:
    return 0x00


def simulate_end(bs: list[int], grid_x: int = 200) -> tuple[int, int]:
    pad_left, pad_top, pad_right = 1, 1, 1
    xi, yi = pad_left, pad_top
    for b in bs:
        a = (b >> 7) & 1
        xxx = (b >> 4) & 7
        bit_b = (b >> 3) & 1
        yyy = b & 7
        is_zero = xxx == 0 and yyy == 0
        ab = (a << 1) | bit_b
        if is_zero:
            if ab == 0:
                yi = pad_top + 8 * int((yi - pad_top) / 8)
            continue
        dx = tri_bits_to_signed(xxx)
        dy = tri_bits_to_signed(yyy)
        max_x = grid_x - pad_right
        if dx > 0 and (xi + dx) > max_x:
            xi = pad_left
            yi += 8
        xi += dx
        yi += dy
    return xi, yi


def finish_to_cell(bs: list[int], tx: int = 6, ty: int = 1) -> list[int] | None:
    out = list(bs)
    xi, yi = simulate_end(out)
    for _ in range(40):
        if (xi, yi) == (tx, ty):
            break
        dx = max(-3, min(4, tx - xi))
        dy = max(-3, min(4, ty - yi))
        if dx == 0 and dy == 0:
            if xi < tx:
                dx = 1
            elif xi > tx:
                dx = -1
            elif yi < ty:
                dy = 1
            elif yi > ty:
                dy = -1
            else:
                break
        out.append(enc_move(dx, dy))
        xi += dx
        yi += dy
    if (xi, yi) != (tx, ty):
        return None
    out.append(enc_snap())
    return out


def to_hex(bs: list[int]) -> str:
    return "".join(f"{b:02X}" for b in bs)
