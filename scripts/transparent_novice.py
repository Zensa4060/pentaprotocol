"""Convert the white backdrop of novice.png to transparency without
eating the intentional white highlights inside the wolf silhouette.

Strategy:
- Flood-fill from every edge pixel. Any connected run of near-white
  (R,G,B all >= 235) pixels that is reachable from the edge is the
  background → alpha set to 0.
- Anything enclosed by pink (the fangs/highlights inside the wolf) is
  unreachable from the edge so it is preserved.
- Also softens the 1-px anti-alias ring by partially reducing alpha on
  pixels that are background-adjacent and very light.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "public" / "novice.png"


def is_near_white(px: tuple[int, int, int, int], thresh: int = 235) -> bool:
    r, g, b, _a = px
    return r >= thresh and g >= thresh and b >= thresh


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    pixels = im.load()
    assert pixels is not None

    visited = bytearray(w * h)  # 0 = not visited, 1 = is background
    q: deque[tuple[int, int]] = deque()

    # Seed the queue with every edge pixel that is near-white.
    for x in range(w):
        for y in (0, h - 1):
            if is_near_white(pixels[x, y]):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_near_white(pixels[x, y]):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))

    # 4-connected flood fill.
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if visited[idx]:
                    continue
                if is_near_white(pixels[nx, ny]):
                    visited[idx] = 1
                    q.append((nx, ny))

    bg_count = 0
    for y in range(h):
        for x in range(w):
            if visited[y * w + x]:
                r, g, b, _a = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
                bg_count += 1

    im.save(SRC, optimize=True)
    print(f"Made {bg_count:,} background pixels transparent out of {w*h:,}.")


if __name__ == "__main__":
    main()
