"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

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

  const flakeCount = useMemo(() => Math.round(92), []);
  const flakesRef = useRef<Flake[]>([]);

  // Re-seed flakes when dimensions change (keeps density stable).
  useEffect(() => {
    const { w, h } = dims;
    flakesRef.current = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.9 + 0.35,
      vy: 0.35 + Math.random() * 0.95,
      drift: (Math.random() - 0.5) * 0.35,
      alpha: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
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

    const drawHexGrid = () => {
      const cell = 18 * sx;
      const stepY = cell * Math.sqrt(3) * 0.5;
      const r = cell * 0.5;

      // Subtle glow pass.
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(130,220,255,0.25)";
      ctx.lineWidth = 1 * sx;

      const rows = Math.ceil(DH / stepY) + 4;
      const cols = Math.ceil(DW / cell) + 4;
      for (let row = -2; row < rows; row++) {
        const cy = row * stepY;
        const offsetX = (row % 2) * (cell / 2);
        for (let col = -2; col < cols; col++) {
          const cx = col * cell + offsetX;
          if (cx < -cell || cx > DW + cell || cy < -stepY || cy > DH + stepY) continue;
          // Hex vertices (flat-top-ish).
          const points: Array<[number, number]> = [];
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 3) * i + Math.PI / 6;
            points.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
          }
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(points[i][0], points[i][1]);
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const draw = () => {
      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, DH);
      bg.addColorStop(0, "#030c20");
      bg.addColorStop(0.35, "#051536");
      bg.addColorStop(0.7, "#071a48");
      bg.addColorStop(1, "#020817");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, DW, DH);

      // Aurora bands
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i++) {
        const y = DH * (0.25 + i * 0.12) + Math.sin(t * 0.9 + i * 1.8) * (6 * sy);
        const band = ctx.createLinearGradient(0, y - 14 * sy, DW, y + 14 * sy);
        band.addColorStop(0, "rgba(70,200,255,0)");
        band.addColorStop(0.45, `rgba(120,240,255,${0.09 + i * 0.01})`);
        band.addColorStop(0.55, `rgba(170,255,245,${0.06 + i * 0.01})`);
        band.addColorStop(1, "rgba(70,200,255,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, y - 16 * sy, DW, 32 * sy);
      }
      ctx.restore();

      // Hex grid (slow fade in/out)
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.35));
      drawHexGrid();
      ctx.restore();

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
        const a = f.alpha * (0.35 + 0.65 * (1 - (py / (DH + 10)) * 0.6));
        ctx.fillStyle = `rgba(210,245,255,${a * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, f.r * sx, 0, Math.PI * 2);
        ctx.fill();

        // Small star-like twinkle for a subset.
        if (f.r > 1.6 && Math.sin(t * 2 + f.phase) > 0.75) {
          ctx.strokeStyle = `rgba(210,245,255,${a})`;
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

