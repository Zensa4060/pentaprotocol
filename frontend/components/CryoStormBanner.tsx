"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

// Deterministic PRNG so the banner looks consistent across screens.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

type Flake = {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  alpha: number;
  phase: number;
};

export default function CryoStormBanner({
  style = {},
  hideLabels = false,
}: {
  style?: React.CSSProperties;
  hideLabels?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const [dims, setDims] = useState({ w: 860, h: 80 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ w: width, h: height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const flakeCount = useMemo(() => {
    const baseW = 860;
    const baseH = 80;
    const baseArea = baseW * baseH;
    const area = dims.w * dims.h;
    // Keep flake density visually consistent across banner sizes.
    return Math.max(40, Math.min(160, Math.round(92 * (area / baseArea))));
  }, [dims.w, dims.h]);
  const flakesRef = useRef<Flake[]>([]);

  // Re-seed flakes when dimensions change (keeps density stable).
  useEffect(() => {
    const { w, h } = dims;
    const rand = mulberry32(1337);
    flakesRef.current = Array.from({ length: flakeCount }, () => ({
      x: rand() * w,
      y: rand() * h,
      r: rand() * 1.9 + 0.35,
      vy: 0.35 + rand() * 0.95,
      drift: (rand() - 0.5) * 0.35,
      alpha: 0.25 + rand() * 0.75,
      phase: rand() * Math.PI * 2,
    }));
  }, [dims, flakeCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w * DPR;
    canvas.height = dims.h * DPR;
    // Reset transform to avoid accumulated scaling.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const DW = dims.w;
    const DH = dims.h;
    const sx = DW / 860;
    const sy = DH / 80;

    let t = 0;

    // NOTE: The original Cryo Storm look uses only drifting snowflakes.
    // We intentionally do NOT render the hex-grid (honeycomb), because that
    // changes the banner identity compared to the reference artwork.

    const draw = () => {
      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, DH);
      bg.addColorStop(0, "#030c20");
      bg.addColorStop(0.35, "#051536");
      bg.addColorStop(0.7, "#071a48");
      bg.addColorStop(1, "#020817");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, DW, DH);

      // Aurora: a single dominant horizontal band (matches original artwork better)
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const bandTop = DH * 0.22;
      const bandBottom = DH * 0.58;
      const coreY = DH * 0.40 + Math.sin(t * 0.9) * (4 * sy) + Math.sin(t * 0.32) * (2.5 * sy);
      const bandHalf = (bandBottom - bandTop) * 0.12 + 12 * sy;
      const band = ctx.createLinearGradient(0, coreY - bandHalf, DW, coreY + bandHalf);
      band.addColorStop(0, "rgba(70,200,255,0)");
      band.addColorStop(0.45, "rgba(120,240,255,0.12)");
      band.addColorStop(0.55, "rgba(170,255,245,0.09)");
      band.addColorStop(1, "rgba(70,200,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, coreY - bandHalf, DW, bandHalf * 2);
      ctx.restore();

      // (hex-grid removed)

      // Snowflakes
      const flakes = flakesRef.current;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const f of flakes) {
        f.y += (0.35 + f.vy * 0.02) * (0.9 + Math.sin(t + f.phase) * 0.08) * sy;
        f.x += Math.sin(t * (0.6 + f.drift) + f.phase) * 0.09 * sx;
        if (f.y > DH + 6) {
          f.y = -5 - Math.random() * 10;
          f.x = Math.random() * DW;
        }
        const px = f.x;
        const py = f.y;
        const bandTop = DH * 0.22;
        const bandBottom = DH * 0.58;
        const bandPadTop = bandTop - 8 * sy;
        const bandPadBottom = bandBottom + 10 * sy;
        if (py < bandPadTop || py > bandPadBottom) continue;

        const core = py >= bandTop && py <= bandBottom;
        const bandMult = core ? 1 : 0.35;

        const a = f.alpha * (0.35 + 0.65 * (1 - (py / (DH + 10)) * 0.6));
        ctx.fillStyle = `rgba(210,245,255,${a * 0.6 * bandMult})`;
        ctx.beginPath();
        ctx.arc(px, py, f.r * sx, 0, Math.PI * 2);
        ctx.fill();

        // Small star-like twinkle for a subset.
        if (f.r > 1.6 && Math.sin(t * 2 + f.phase) > 0.75) {
          ctx.strokeStyle = `rgba(210,245,255,${a * bandMult})`;
          ctx.lineWidth = 1 * sx;
          ctx.beginPath();
          ctx.moveTo(px - 2 * sx, py);
          ctx.lineTo(px + 2 * sx, py);
          ctx.moveTo(px, py - 2 * sy);
          ctx.lineTo(px, py + 2 * sy);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Occasional gleam (diagonal)
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const gleam = 0.5 + 0.5 * Math.sin(t * 0.55);
      ctx.globalAlpha = 0.06 + gleam * 0.07;
      const x0 = -DW * 0.3;
      const y0 = DH * (0.15 + Math.sin(t * 0.3) * 0.05);
      const grad = ctx.createLinearGradient(x0, y0, DW + DW * 0.3, y0);
      grad.addColorStop(0, "rgba(120,240,255,0)");
      grad.addColorStop(0.45, "rgba(170,255,245,0.45)");
      grad.addColorStop(0.55, "rgba(120,240,255,0.45)");
      grad.addColorStop(1, "rgba(120,240,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-DW * 0.2, y0, DW * 1.4, 10 * sy);
      ctx.restore();

      // (Rarity/name badge removed for all screens)

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims, hideLabels]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

