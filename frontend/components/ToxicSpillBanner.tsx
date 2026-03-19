"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const BASE_DW = 860;
const BASE_DH = 80;
const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Bubble = {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobble: number;
  ws: number;
  alpha: number;
};

type Splat = { x: number; y: number; r: number; a: number };

export default function ToxicSpillBanner({
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

  // Deterministic scene so Profile/Career look identical.
  const scene = useMemo(() => {
    const rand = mulberry32(20260323);

    const bubbles: Bubble[] = Array.from({ length: 45 }, () => ({
      x: rand() * BASE_DW,
      y: BASE_DH + rand() * 20,
      r: rand() * 4.5 + 0.8,
      speed: 0.18 + rand() * 0.55,
      wobble: rand() * Math.PI * 2,
      ws: 0.02 + rand() * 0.03,
      alpha: 0.5 + rand() * 0.5,
    }));

    const splats: Splat[] = Array.from({ length: 18 }, () => ({
      x: rand() * BASE_DW,
      y: BASE_DH * 0.35 + rand() * BASE_DH * 0.45,
      r: rand() * 7 + 1.5,
      a: 0.05 + rand() * 0.2,
    }));

    return { bubbles, splats, rand };
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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mutate arrays over time, but keep deterministic initial placement.
    const bubbles = scene.bubbles.map((b) => ({ ...b }));
    const splats = scene.splats.map((s) => ({ ...s }));
    const rand = scene.rand;

    let t = 0;

    const draw = () => {
      const w = Math.max(1, Math.floor(dims.w));
      const h = Math.max(1, Math.floor(dims.h));

      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);

      // Reset DPR scaling and then scale base units into current size.
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sx = w / BASE_DW;
      const sy = h / BASE_DH;
      ctx.scale(sx, sy);

      // Background
      ctx.fillStyle = "#010d03";
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Caustic light patterns
      for (let i = 0; i < 30; i++) {
        const cx = ((i * 73 + t * 8) % BASE_DW);
        const cy = BASE_DH * 0.4 + Math.sin(i * 0.7 + t * 0.5) * 20;
        const r = 8 + Math.sin(i + t) * 4;

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cg.addColorStop(0, `rgba(0,200,80,${0.04 + Math.sin(t * 2 + i) * 0.02})`);
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }

      const drawWave = (yBase: number, amp: number, freq: number, ph: number, r: number, gg: number, b: number, a: number) => {
        ctx.beginPath();
        ctx.moveTo(0, BASE_DH);
        for (let x = 0; x <= BASE_DW; x += 2) {
          const y =
            yBase +
            Math.sin(x * freq + t + ph) * amp +
            Math.sin(x * freq * 1.8 + t * 1.3 + ph) * amp * 0.35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(BASE_DW, BASE_DH);
        ctx.closePath();
        ctx.fillStyle = `rgba(${r},${gg},${b},${a})`;
        ctx.fill();
      };

      drawWave(BASE_DH * 0.72, 9, 0.011, 0, 15, 68, 35, 0.95);
      drawWave(BASE_DH * 0.67, 7, 0.014, 1.1, 20, 110, 50, 0.75);
      drawWave(BASE_DH * 0.62, 5.5, 0.017, 2.3, 22, 145, 65, 0.55);
      drawWave(BASE_DH * 0.59, 4, 0.021, 3.4, 60, 200, 100, 0.35);
      drawWave(BASE_DH * 0.57, 3, 0.025, 4.5, 100, 240, 130, 0.18);

      // Surface glint
      for (let x = 0; x < BASE_DW; x += 3) {
        const sy =
          BASE_DH * 0.57 +
          Math.sin(x * 0.025 + t * 1.5) * 3 +
          Math.sin(x * 0.014 + t) * 4;
        const g2 = Math.sin(x * 0.06 + t * 3) * 0.5 + 0.5;
        if (g2 > 0.72) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.beginPath();
          ctx.arc(x, sy, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150,255,180,${(g2 - 0.72) * 2.5})`;
          ctx.fill();
          ctx.restore();
        }
      }

      // Splat marks beneath surface
      for (const s of splats) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(60,180,90,${s.a})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100,230,120,${s.a * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Bubbles
      for (const b of bubbles) {
        b.y -= b.speed;
        b.wobble += b.ws;
        b.x += Math.sin(b.wobble) * 0.5;
        if (b.y < -b.r * 3) {
          b.y = BASE_DH + b.r;
          b.x = rand() * BASE_DW;
        }

        const surfY =
          BASE_DH * 0.57 + Math.sin(b.x * 0.025 + t * 1.5) * 3;
        const depth =
          b.y > surfY ? 1 : Math.max(0, 1 - (surfY - b.y) / 18);
        const a = b.alpha * depth;

        // Bubble body
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(60,200,100,${a * 0.65})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = `rgba(15,60,25,${a * 0.25})`;
        ctx.fill();

        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140,255,180,${a * 0.55})`;
        ctx.fill();

        // Refraction ring
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,255,120,${a * 0.12})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Hazard stripe top (no text)
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(60,200,80,0.07)" : "rgba(0,0,0,0)";
        ctx.fillRect((i * BASE_DW) / 28, 0, BASE_DW / 28, 3);
      }

      // IMPORTANT: No text, no badges, no fillText anywhere.

      t += 0.018;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
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
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

