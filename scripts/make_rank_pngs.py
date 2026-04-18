"""Rasterize the remaining vector rank badges (novice / advanced / emerald) to PNG.

After this script runs, every rank in NavBar.tsx's RANKS array can point at a
.png file, matching how MASTER / LEGEND / PROFESSIONAL already work.

Why it exists:
- MASTER and LEGEND already ship as PNG under frontend/public/.
- PROFESSIONAL was converted earlier via scripts/make_professional_png.py
  (a bespoke pipeline since its SVG embedded a base64 PNG).
- NOVICE, ADVANCED, EMERALD are pure vector SVGs today. To achieve a uniform
  all-PNG rank set we need to rasterize them.

Dependencies (pure-Python, no system libcairo required):
    pip install svglib reportlab pillow

Usage:
    python scripts/make_rank_pngs.py

Output (overwrites existing):
    frontend/public/novice.png
    frontend/public/advanced.png
    frontend/public/emerald.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPM
from svglib.svglib import svg2rlg

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"

# Target raster dimensions (square, high-DPI). NavBar renders badges up to ~116px
# for the rank-up reveal; 512 gives comfortable headroom with tight file sizes.
TARGET_PX = 512


def rasterize_svg_to_png(svg_path: Path, png_path: Path, target_px: int = TARGET_PX) -> None:
    drawing = svg2rlg(str(svg_path))
    if drawing is None:
        raise SystemExit(f"svglib could not parse {svg_path}")

    # Scale the RL drawing so its longest edge matches target_px. svglib preserves
    # the SVG's viewBox aspect; we force a square canvas afterward to match the
    # existing NavRankBadge which assumes square emblems.
    w = float(drawing.width or target_px)
    h = float(drawing.height or target_px)
    scale = target_px / max(w, h)
    drawing.width = w * scale
    drawing.height = h * scale
    drawing.scale(scale, scale)

    png_path.parent.mkdir(parents=True, exist_ok=True)
    renderPM.drawToFile(drawing, str(png_path), fmt="PNG", bg=0xFFFFFF, configPIL={"transparent": 0xFFFFFF})

    # reportlab can't always honor transparent bg for non-trivial paths; post-process
    # with Pillow to make white pixels transparent and pad to square.
    im = Image.open(png_path).convert("RGBA")
    px = im.load()
    iw, ih = im.size
    for y in range(ih):
        for x in range(iw):
            r, g, b, a = px[x, y]
            if a > 0 and r >= 248 and g >= 248 and b >= 248:
                px[x, y] = (0, 0, 0, 0)

    if iw != ih:
        side = max(iw, ih)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - iw) // 2, (side - ih) // 2), im)
        im = canvas

    im.save(png_path, "PNG", optimize=True)


def main() -> None:
    jobs = [
        ("novice.svg",   "novice.png"),
        ("advanced.svg", "advanced.png"),
        ("emerald.svg",  "emerald.png"),
    ]
    for src_name, dst_name in jobs:
        src = PUBLIC / src_name
        dst = PUBLIC / dst_name
        if not src.exists():
            print(f"[skip] {src_name}: source not found")
            continue
        rasterize_svg_to_png(src, dst)
        print(f"[ok]   {src_name} -> {dst_name} ({dst.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
