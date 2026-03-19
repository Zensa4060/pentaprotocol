"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const BASE_DW = 860;
const BASE_DH = 80;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Crystal = { x: number; y: number; size: number; angle: number; phase: number; speed: number };
type Flake = { x: number; y: number; r: number; speed: number; drift: number; phase: number };

export default function ArcticVeilBanner({
  style = {},
  hideLabels = false,
}: {
  style?: React.CSSProperties;
  hideLabels?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const [dims, setDims] = useState({ w: BASE_DW, h: BASE_DH });

  const scene = useMemo(() => {
    const rand = mulberry32(20260320);
    const crystals: Crystal[] = Array.from({ length: 22 }, () => ({
      x: rand() * BASE_DW,
      y: rand() * BASE_DH,
      size: 5 + rand() * 11,
      angle: rand() * Math.PI,
      phase: rand() * Math.PI * 2,
      speed: 0.004 + rand() * 0.007,
    }));
    const flakes: Flake[] = Array.from({ length: 60 }, () => ({
      x: rand() * BASE_DW,
      y: rand() * BASE_DH,
      r: rand() * 1.4 + 0.2,
      speed: 0.2 + rand() * 0.4,
      drift: (rand() - 0.5) * 0.15,
      phase: rand() * Math.PI * 2,
    }));
    return { crystals, flakes, rand };
  }, []);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const crystals = scene.crystals.map((c) => ({ ...c }));
    const flakes = scene.flakes.map((f) => ({ ...f }));
    const rand = scene.rand;
    const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

    const drawCrystal = (x: number, y: number, size: number, angle: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      const pts: [number, number][] = [
        [0, -size],
        [size * 0.38, -size * 0.18],
        [size * 0.38, size * 0.48],
        [0, size],
        [-size * 0.38, size * 0.48],
        [-size * 0.38, -size * 0.18],
      ];

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
      ctx.closePath();

      const cg = ctx.createLinearGradient(0, -size, 0, size);
      cg.addColorStop(0, `rgba(255,255,255,${alpha * 0.6})`);
      cg.addColorStop(0.4, `rgba(186,230,253,${alpha * 0.25})`);
      cg.addColorStop(1, `rgba(125,211,252,${alpha * 0.1})`);
      ctx.fillStyle = cg;
      ctx.fill();

      ctx.strokeStyle = `rgba(186,230,253,${alpha * 0.8})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.6);
      ctx.lineTo(size * 0.15, 0);
      ctx.lineTo(0, size * 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.lineWidth = 0.4;
      ctx.stroke();

      ctx.restore();
    };

    let t = 0;

    const loop = () => {
      const w = Math.max(1, Math.floor(dims.w));
      const h = Math.max(1, Math.floor(dims.h));
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sx = w / BASE_DW;
      const sy = h / BASE_DH;
      ctx.scale(sx, sy);

      // Icy light background
      const bg = ctx.createLinearGradient(0, 0, BASE_DW, 0);
      bg.addColorStop(0, "#d8f0fc");
      bg.addColorStop(0.3, "#e8f6ff");
      bg.addColorStop(0.6, "#c5e8fb");
      bg.addColorStop(1, "#d8f0fc");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Aurora shimmer layers
      for (let i = 0; i < 5; i++) {
        const yc = BASE_DH * (0.12 + i * 0.18) + Math.sin(t * 0.38 + i * 1.4) * 10;
        const hue = 185 + i * 14;
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        const aur = ctx.createLinearGradient(0, yc - 14, 0, yc + 14);
        aur.addColorStop(0, `hsla(${hue},70%,85%,0)`);
        aur.addColorStop(0.5, `hsla(${hue},80%,78%,${0.18 + Math.sin(t * 0.6 + i) * 0.08})`);
        aur.addColorStop(1, `hsla(${hue},70%,85%,0)`);
        ctx.fillStyle = aur;
        ctx.beginPath();
        ctx.moveTo(0, yc - 14);
        for (let x = 0; x <= BASE_DW; x += 5) ctx.lineTo(x, yc + Math.sin(x * 0.012 + t * 0.6 + i) * 8 - 14);
        ctx.lineTo(BASE_DW, yc + 14);
        for (let x = BASE_DW; x >= 0; x -= 5) ctx.lineTo(x, yc + Math.sin(x * 0.012 + t * 0.6 + i) * 8 + 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Frost edge
      const fE = ctx.createLinearGradient(0, 0, BASE_DW, 0);
      fE.addColorStop(0, "rgba(200,240,255,0.5)");
      fE.addColorStop(0.1, "rgba(200,240,255,0)");
      fE.addColorStop(0.9, "rgba(200,240,255,0)");
      fE.addColorStop(1, "rgba(200,240,255,0.5)");
      ctx.fillStyle = fE;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      const fT = ctx.createLinearGradient(0, 0, 0, BASE_DH);
      fT.addColorStop(0, "rgba(230,248,255,0.45)");
      fT.addColorStop(0.2, "rgba(0,0,0,0)");
      fT.addColorStop(0.8, "rgba(0,0,0,0)");
      fT.addColorStop(1, "rgba(230,248,255,0.35)");
      ctx.fillStyle = fT;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Ice crystals
      for (const c of crystals) {
        c.phase += c.speed;
        const p = Math.sin(c.phase) * 0.5 + 0.5;
        drawCrystal(c.x, c.y, c.size * (0.8 + p * 0.2), c.angle + t * 0.015, 0.18 + p * 0.55);
      }

      // Micro snowflakes
      for (const f of flakes) {
        f.y += f.speed;
        f.x += f.drift + Math.sin(t * 0.5 + f.phase) * 0.2;
        if (f.y > BASE_DH + 5) {
          f.y = -5;
          f.x = rand() * BASE_DW;
        }

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(t * 0.2 + f.phase);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * f.r * 3.5, Math.sin(a) * f.r * 3.5);
          ctx.strokeStyle = "rgba(150,210,240,0.7)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, f.r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
        ctx.restore();
      }

      // Diamond gleam sparkles
      for (let i = 0; i < 12; i++) {
        const gx = (BASE_DW / 12) * i + 35;
        const gy = BASE_DH / 2 + Math.cos(t * 0.45 + i * 1.2) * 24;
        const gp = Math.sin(t * 4 + i * 2.7) * 0.5 + 0.5;
        if (gp > 0.78) {
          const s = (gp - 0.78) * 30;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.beginPath();
          ctx.moveTo(gx, gy - s);
          ctx.lineTo(gx, gy + s);
          ctx.moveTo(gx - s, gy);
          ctx.lineTo(gx + s, gy);
          ctx.moveTo(gx - s * 0.5, gy - s * 0.5);
          ctx.lineTo(gx + s * 0.5, gy + s * 0.5);
          ctx.moveTo(gx + s * 0.5, gy - s * 0.5);
          ctx.lineTo(gx - s * 0.5, gy + s * 0.5);
          ctx.strokeStyle = `rgba(255,255,255,${(gp - 0.78) * 3.5})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.restore();
        }
      }

      // IMPORTANT: no text / no badges / no fillText.

      t += 0.012;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims.w, dims.h, scene]);

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
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}

