#!/usr/bin/env python3
"""Membuat icon PNG 192 dan 512 tanpa pustaka eksternal.

Jalankan dari root proyek:
    python tools/generate-icons.py

Hanya memakai modul standar Python (math, struct, zlib, pathlib).
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "icons"
SIZES = (192, 512)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def mix(a, b, t):
    t = clamp(t)
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def over(base, color, alpha):
    if alpha <= 0:
        return base
    alpha = clamp(alpha)
    base_alpha = base[3] / 255.0
    out_alpha = alpha + base_alpha * (1.0 - alpha)
    if out_alpha <= 0:
        return (0.0, 0.0, 0.0, 0.0)
    channels = [
        (color[i] * alpha + base[i] * base_alpha * (1.0 - alpha)) / out_alpha
        for i in range(3)
    ]
    return (channels[0], channels[1], channels[2], out_alpha * 255.0)


def rounded_rect_inside(x, y, cx, cy, half, radius):
    qx = abs(x - cx) - (half - radius)
    qy = abs(y - cy) - (half - radius)
    distance = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius
    return distance <= 0.0


def ellipse_inside(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0


def cup_inside(x, y):
    if y < 186.0 or y > 364.0:
        return False
    if y <= 326.0:
        half_width = 104.0 - (y - 186.0) * (18.0 / 140.0)
        return abs(x - 256.0) <= half_width
    radius = 30.0
    center_y = 334.0
    half_width = 86.0
    if y < center_y:
        return abs(x - 256.0) <= half_width
    offset = y - center_y
    if offset > radius:
        return False
    available = math.sqrt(max(0.0, radius * radius - offset * offset))
    return abs(x - 256.0) <= (half_width - radius) + available


def ring_inside(x, y):
    dx = (x - 366.0) / 57.0
    dy = (y - 274.0) / 56.0
    distance = math.hypot(dx, dy)
    inner_dx = (x - 366.0) / 35.0
    inner_dy = (y - 274.0) / 34.0
    inner_distance = math.hypot(inner_dx, inner_dy)
    return distance <= 1.0 and inner_distance >= 1.0


def render_sample(x, y):
    color = (0.0, 0.0, 0.0, 0.0)

    if not rounded_rect_inside(x, y, 256.0, 256.0, 256.0, 112.0):
        return color

    gradient = clamp((x + y) / 1024.0)
    background = mix((58, 39, 25), (23, 16, 11), gradient)
    color = over(color, background, 1.0)

    glow_distance = math.hypot((x - 250.0) / 238.0, (y - 200.0) / 220.0)
    if glow_distance < 1.0:
        color = over(color, (233, 169, 91), 0.16 * (1.0 - glow_distance) ** 1.4)

    shadow_distance = math.hypot((x - 256.0) / 170.0, (y - 377.0) / 27.0)
    if shadow_distance < 1.0:
        color = over(color, (0, 0, 0), 0.26 * (1.0 - shadow_distance) ** 0.7)

    if ellipse_inside(x, y, 256.0, 358.0, 174.0, 34.0):
        plate_t = clamp((y - 324.0) / 68.0)
        plate_color = mix((244, 231, 214), (214, 187, 154), plate_t)
        color = over(color, plate_color, 1.0)

    if ellipse_inside(x, y, 256.0, 352.0, 118.0, 19.0):
        color = over(color, (228, 206, 179), 1.0)

    if ellipse_inside(x, y, 256.0, 350.0, 94.0, 13.0):
        color = over(color, (211, 184, 150), 0.82)

    if ring_inside(x, y):
        color = over(color, (240, 224, 205), 1.0)

    if cup_inside(x, y):
        cup_t = clamp((y - 186.0) / 178.0)
        cup_color = mix((255, 247, 235), (223, 198, 169), cup_t)
        if x < 224.0 and y < 330.0:
            cup_color = mix(cup_color, (255, 255, 255), 0.17)
        color = over(color, cup_color, 1.0)

    if ellipse_inside(x, y, 256.0, 186.0, 104.0, 22.0):
        color = over(color, (248, 236, 222), 1.0)

    if ellipse_inside(x, y, 256.0, 187.0, 87.0, 14.0):
        color = over(color, (90, 53, 31), 1.0)

    if ellipse_inside(x, y, 256.0, 184.0, 76.0, 9.0):
        color = over(color, (122, 74, 42), 1.0)

    if ellipse_inside(x, y, 230.0, 182.0, 25.0, 5.0):
        color = over(color, (163, 107, 67), 0.55)

    return color


def render(size):
    ss = 4 if size <= 192 else 3
    rows = []
    scale = 512.0 / size
    for py in range(size):
        row = bytearray()
        for px in range(size):
            premul_r = premul_g = premul_b = premul_a = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) * scale
                    y = (py + (sy + 0.5) / ss) * scale
                    r, g, b, a = render_sample(x, y)
                    alpha = a / 255.0
                    premul_r += r * alpha
                    premul_g += g * alpha
                    premul_b += b * alpha
                    premul_a += alpha
            samples = ss * ss
            if premul_a <= 0.0:
                row.extend((0, 0, 0, 0))
            else:
                row.extend((
                    int(round(clamp(premul_r / premul_a, 0, 255))),
                    int(round(clamp(premul_g / premul_a, 0, 255))),
                    int(round(clamp(premul_b / premul_a, 0, 255))),
                    int(round(clamp(premul_a / samples * 255.0, 0, 255)))
                ))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        target = OUTPUT_DIR / f"icon-{size}.png"
        print(f"Membuat {target.name} ({size}x{size})...")
        write_png(target, size, render(size))
        print(f"Selesai: {target}")


if __name__ == "__main__":
    main()
