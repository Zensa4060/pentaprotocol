"""Mask the professional rank badge to a circular plate.

The existing `frontend/public/professional.png` renders as a hexagonal /
shield-shaped plate. The other rank PNGs (novice, advanced) read as tight
circles, so we want PROFESSIONAL to match.

Approach:
1. Find the inscribed disc centered in the image. Its radius is min(w, h)/2
   minus a tiny padding so the edge anti-aliases smoothly.
2. Inside the disc:
     - currently opaque purple  -> keep purple (plate)
     - currently opaque black   -> keep black  (phoenix)
     - currently transparent    -> fill purple (seals the disc)
3. Outside the disc:
     - force fully transparent.
4. Re-feather the disc edge so it looks painted, not stamped.

Backup of the pre-circle file is written once to professional.hex.png.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "public" / "professional.png"
BACKUP = ROOT / "frontend" / "public" / "professional.hex.png"

PURPLE_FILL = (139, 92, 246, 255)  # #8B5CF6 — PROFESSIONAL accent
EDGE_PADDING = 4                   # shave this many px off the radius for smooth aa


def build_disc_mask(w: int, h: int, padding: int = EDGE_PADDING) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    r = min(w, h) / 2 - padding
    cx, cy = w / 2, h / 2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    # Light blur to feather the rim (1.2 px) — keeps the disc looking painted.
    return mask.filter(ImageFilter.GaussianBlur(radius=1.2))


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing {SRC}")

    if not BACKUP.exists():
        BACKUP.write_bytes(SRC.read_bytes())
        print(f"[backup] wrote {BACKUP.name}")

    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()

    disc = build_disc_mask(w, h)
    dpx = disc.load()

    filled = 0
    clipped = 0
    for y in range(h):
        for x in range(w):
            m = dpx[x, y]
            if m == 0:
                # fully outside disc -> transparent
                _, _, _, a = px[x, y]
                if a != 0:
                    px[x, y] = (0, 0, 0, 0)
                    clipped += 1
                continue

            r, g, b, a = px[x, y]

            # Inside disc: fill any transparent gap with purple so the plate reads solid.
            if a < 32:
                if m >= 255:
                    px[x, y] = PURPLE_FILL
                else:
                    # Rim: purple blended against transparent so the edge feathers.
                    px[x, y] = (PURPLE_FILL[0], PURPLE_FILL[1], PURPLE_FILL[2], m)
                filled += 1
                continue

            # Inside disc and already opaque (black phoenix or purple plate):
            # if we're near the rim, soften the alpha using the disc mask so the
            # outer silhouette becomes round instead of hex-edged.
            if m < 255:
                new_a = min(a, m)
                px[x, y] = (r, g, b, new_a)

    im.save(SRC, "PNG", optimize=True)
    print(f"[ok] transparent-inside-disc filled: {filled}  outside-disc clipped: {clipped}")
    print(f"     wrote {SRC}")


if __name__ == "__main__":
    main()
