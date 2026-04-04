"""Regenerate frontend/public/professional.png from git HEAD professional.svg embedded PNG."""
import base64
import io
import math
import re
import subprocess
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "professional.png"


def load_source_png() -> Image.Image:
    raw = subprocess.check_output(
        ["git", "show", "HEAD:frontend/public/professional.svg"],
        cwd=ROOT,
    )
    text = raw.decode("utf-8", errors="replace")
    m = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", text)
    if not m:
        raise SystemExit("No base64 PNG in HEAD frontend/public/professional.svg")
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGBA")


def crop_content_frame(im: Image.Image, white_row_thresh: float = 0.08) -> Image.Image:
    """Trim letterboxing: keep rows/columns that have enough near-white pixels."""
    w, h = im.size
    px = im.load()

    def col_white_frac(x: int) -> float:
        t = 0
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 200 and min(r, g, b) >= 245:
                t += 1
        return t / h

    def row_white_frac(y: int) -> float:
        t = 0
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 200 and min(r, g, b) >= 245:
                t += 1
        return t / w

    lx, rx = 0, w - 1
    while lx < w and col_white_frac(lx) < white_row_thresh:
        lx += 1
    while rx >= 0 and col_white_frac(rx) < white_row_thresh:
        rx -= 1
    ty, by = 0, h - 1
    while ty < h and row_white_frac(ty) < white_row_thresh:
        ty += 1
    while by >= 0 and row_white_frac(by) < white_row_thresh:
        by -= 1

    pad = 4
    lx = max(0, lx - pad)
    ty = max(0, ty - pad)
    rx = min(w - 1, rx + pad)
    by = min(h - 1, by + pad)
    return im.crop((lx, ty, rx + 1, by + 1))


def white_to_transparent(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if min(r, g, b) >= 232:
                px[x, y] = (0, 0, 0, 0)
            elif min(r, g, b) >= 210 and max(r, g, b) - min(r, g, b) < 24:
                px[x, y] = (0, 0, 0, 0)


def strip_edge_dark_bars(im: Image.Image, max_depth: int = 165, dark_max: int = 48) -> None:
    """Remove black letterboxing still attached to image edges.

    Full edge flood would merge with the dragon (one dark component); we only walk
    a limited depth from the boundary so interior silhouette stays intact.
    """
    w, h = im.size
    px = im.load()

    def dark(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 200 and max(r, g, b) <= dark_max

    dist = [[-1] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dark(x, y) and dist[y][x] < 0:
                dist[y][x] = 0
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if dark(x, y) and dist[y][x] < 0:
                dist[y][x] = 0
                q.append((x, y))
    while q:
        x, y = q.popleft()
        d = dist[y][x]
        if d >= max_depth:
            continue
        nd = d + 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and dark(nx, ny) and dist[ny][nx] < 0:
                dist[ny][nx] = nd
                q.append((nx, ny))
    for y in range(h):
        for x in range(w):
            if dist[y][x] >= 0:
                px[x, y] = (0, 0, 0, 0)


def recolor_neutral_to_purple(im: Image.Image) -> None:
    """Turn black/gray silhouette into purples (matches PROFESSIONAL rank).

    The source glyph is neutral grayscale; making every black pixel transparent
    would remove the whole emblem, so dark tones become purple instead.
    """
    px = im.load()
    w, h = im.size
    dr = (91, 51, 182)  # #5B21B6
    md = (139, 92, 246)  # #8B5CF6
    hi = (196, 181, 253)  # #C4B5FD
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            if mx >= 250 and mn >= 250:
                px[x, y] = (0, 0, 0, 0)
                continue
            if mx - mn > 28:
                continue
            t = mx / 255.0
            if t < 0.18:
                nr, ng, nb = dr
            elif t < 0.5:
                u = (t - 0.18) / 0.32
                nr = int(dr[0] + (md[0] - dr[0]) * u)
                ng = int(dr[1] + (md[1] - dr[1]) * u)
                nb = int(dr[2] + (md[2] - dr[2]) * u)
            else:
                u = min(1.0, (t - 0.5) / 0.5)
                nr = int(md[0] + (hi[0] - md[0]) * u)
                ng = int(md[1] + (hi[1] - md[1]) * u)
                nb = int(md[2] + (hi[2] - md[2]) * u)
            px[x, y] = (nr, ng, nb, a)


def circle_mask_square_crop(im: Image.Image, feather_px: float = 1.25) -> Image.Image:
    """Inscribed circle mask, then square crop (drops rectangular corners / padding)."""
    w, h = im.size
    if w < 2 or h < 2:
        return im
    cx = w / 2.0
    cy = h / 2.0
    r = min(w, h) / 2.0
    px = im.load()
    r_out = r + feather_px
    r_in = max(0.0, r - feather_px)
    for y in range(h):
        for x in range(w):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d >= r_out:
                px[x, y] = (0, 0, 0, 0)
            elif d <= r_in:
                continue
            else:
                t = (r_out - d) / (r_out - r_in) if r_out > r_in else 0.0
                t = max(0.0, min(1.0, t))
                r0, g0, b0, a0 = px[x, y]
                px[x, y] = (r0, g0, b0, int(a0 * t))
    side = int(round(2 * r))
    x0 = int(round(cx - r))
    y0 = int(round(cy - r))
    x0 = max(0, min(x0, w - side))
    y0 = max(0, min(y0, h - side))
    x1 = min(w, x0 + side)
    y1 = min(h, y0 + side)
    return im.crop((x0, y0, x1, y1))


def downscale_60pct(im: Image.Image) -> Image.Image:
    """40% smaller than input (retain 60% of width/height)."""
    w, h = im.size
    nw, nh = max(1, round(w * 0.6)), max(1, round(h * 0.6))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def pad_to_square(im: Image.Image) -> Image.Image:
    w, h = im.size
    s = max(w, h)
    if w == h == s:
        return im
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return out


def tight_crop_alpha(im: Image.Image, pad: int = 2) -> Image.Image:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 32:
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return im
    minx = max(0, minx - pad)
    miny = max(0, miny - pad)
    maxx = min(w - 1, maxx + pad)
    maxy = min(h - 1, maxy + pad)
    return im.crop((minx, miny, maxx + 1, maxy + 1))


def main() -> None:
    im = load_source_png()
    im = crop_content_frame(im)
    white_to_transparent(im)
    strip_edge_dark_bars(im, max_depth=165, dark_max=48)
    im = tight_crop_alpha(im, pad=2)
    recolor_neutral_to_purple(im)
    im = tight_crop_alpha(im, pad=2)
    im = circle_mask_square_crop(im)
    im = downscale_60pct(im)
    im = tight_crop_alpha(im, pad=2)
    im = pad_to_square(im)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    px = im.load()
    iw, ih = im.size
    opaque = sum(1 for y in range(ih) for x in range(iw) if px[x, y][3] > 128)
    print(f"Wrote {OUT} size={im.size} opaque_pixels={opaque}")


if __name__ == "__main__":
    main()
