"""Invert the PROFESSIONAL rank badge: purple plate -> black plate, interior
transparent regions (phoenix cutout) -> purple, outside plate -> transparent.

Before:  purple hexagonal plate on transparent canvas, phoenix is a transparent
         cutout inside the plate.
After:   black hexagonal plate on transparent canvas, phoenix is a purple
         cutout inside the plate.

Strategy
--------
1. Build a binary mask of the existing purple plate pixels.
2. Morphologically dilate the mask so small notches in the plate's edge are
   sealed closed (otherwise flood-fill would leak through them and treat the
   phoenix cutout as "outside").
3. Flood-fill transparent pixels from the image edges, *blocked* by the dilated
   plate mask. Reached pixels are "outside plate"; unreached transparent pixels
   lie inside the cutout.
4. Rewrite each pixel:
       purple-opaque        -> black (keep alpha so anti-aliased edges stay soft)
       inside-cutout transp -> solid PURPLE_FILL
       outside-plate transp -> untouched
"""
from __future__ import annotations

from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "public" / "professional.png"
BACKUP = ROOT / "frontend" / "public" / "professional.purple.png"

BLACK = (12, 12, 14)          # slightly off-pure-black so it feels painted
PURPLE_FILL = (139, 92, 246, 255)  # #8B5CF6 — PROFESSIONAL rank accent

# Dilation radius (in pixels) used to seal gaps in the plate outline before
# flood-filling "outside" transparent pixels.
DILATE_RADIUS = 28


def is_purple(r: int, g: int, b: int, a: int) -> bool:
    if a < 32:
        return False
    return b > g + 18 and r > g and (r + b) // 2 > g + 10


def dilate_mask(mask: Image.Image, radius: int) -> Image.Image:
    """Dilate a mode-'L' mask by `radius` pixels using PIL MaxFilter.

    MaxFilter(N) expands by (N-1)/2 pixels. Apply repeatedly if radius exceeds
    the single-pass kernel limit.
    """
    if radius <= 0:
        return mask
    k = 21          # odd; expands by 10 pixels per pass
    passes = max(1, (radius + (k - 1) // 2 - 1) // ((k - 1) // 2))
    out = mask
    for _ in range(passes):
        out = out.filter(ImageFilter.MaxFilter(k))
    return out


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing {SRC}")

    if not BACKUP.exists():
        BACKUP.write_bytes(SRC.read_bytes())
        print(f"[backup] wrote {BACKUP.name}")

    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()

    # Build purple mask (255 where purple, else 0)
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_purple(r, g, b, a):
                mpx[x, y] = 255

    # Dilate to seal small gaps along the plate outline
    sealed = dilate_mask(mask, DILATE_RADIUS)
    spx = sealed.load()

    # Flood-fill "outside" transparent pixels from the image edges, blocked by
    # the sealed (dilated) plate region.
    outside = bytearray(w * h)  # 0 = unknown/inside, 1 = outside
    q: deque[tuple[int, int]] = deque()

    def maybe_seed(x: int, y: int) -> None:
        if outside[y * w + x]:
            return
        _, _, _, a = px[x, y]
        if a >= 32:          # opaque -> not outside
            return
        if spx[x, y] >= 128:  # inside sealed plate -> not outside
            return
        outside[y * w + x] = 1
        q.append((x, y))

    for x in range(w):
        maybe_seed(x, 0)
        maybe_seed(x, h - 1)
    for y in range(h):
        maybe_seed(0, y)
        maybe_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not outside[ny * w + nx]:
                _, _, _, a = px[nx, ny]
                if a >= 32:
                    continue
                if spx[nx, ny] >= 128:
                    continue
                outside[ny * w + nx] = 1
                q.append((nx, ny))

    # Repaint
    purple_to_black = 0
    inside_to_purple = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_purple(r, g, b, a):
                px[x, y] = (BLACK[0], BLACK[1], BLACK[2], a)
                purple_to_black += 1
            elif a < 32 and not outside[y * w + x]:
                px[x, y] = PURPLE_FILL
                inside_to_purple += 1

    im.save(SRC, "PNG", optimize=True)
    print(f"[ok] purple->black: {purple_to_black}  inside-transparent->purple: {inside_to_purple}")
    print(f"     wrote {SRC}")


if __name__ == "__main__":
    main()
