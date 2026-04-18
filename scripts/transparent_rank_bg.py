"""Make rank-logo white backgrounds transparent without eating the
intentional white highlights inside the artwork.

Strategy:
- Flood-fill from every edge pixel. Any connected run of near-white
  (R,G,B all >= thresh) pixels that is reachable from the edge is the
  outer background → alpha set to 0.
- White regions *enclosed* by the colored silhouette (dragon teeth,
  deer eyes, fangs, etc.) are unreachable from the edge so they stay
  opaque.

Call this script with one or more file paths relative to the repo
root; defaults to the full rank set.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = [
    "frontend/public/novice.png",
    "frontend/public/advanced.png",
    "frontend/public/master.png",
]


def is_near_white(px: tuple[int, int, int, int], thresh: int = 235) -> bool:
    r, g, b, _a = px
    return r >= thresh and g >= thresh and b >= thresh


def process(path: Path, thresh: int = 235) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    pixels = im.load()
    assert pixels is not None

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_near_white(pixels[x, y], thresh):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_near_white(pixels[x, y], thresh):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if visited[idx]:
                    continue
                if is_near_white(pixels[nx, ny], thresh):
                    visited[idx] = 1
                    q.append((nx, ny))

    bg_count = 0
    for y in range(h):
        for x in range(w):
            if visited[y * w + x]:
                r, g, b, _a = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
                bg_count += 1

    im.save(path, optimize=True)
    print(f"[{path.relative_to(ROOT)}] {bg_count:,} / {w*h:,} pixels turned transparent.")


def main() -> None:
    targets = sys.argv[1:] or DEFAULTS
    for rel in targets:
        p = (ROOT / rel).resolve()
        if not p.exists():
            print(f"Skipping missing file: {rel}")
            continue
        process(p)


if __name__ == "__main__":
    main()
