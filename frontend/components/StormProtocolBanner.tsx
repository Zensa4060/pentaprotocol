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

type Cloud = { x: number; y: number; w: number; h: number; speed: number; dark: number };
type Bolt = { x: number; timer: number; delay: number; active: boolean; dur: number; x2: number };

export default function StormProtocolBanner({
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
    const rand = mulberry32(20260319);
    const clouds: Cloud[] = Array.from({ length: 7 }, (_v, i) => ({
      x: i * 140 - 80,
      y: 4 + rand() * 12,
      w: 90 + rand() * 70,
      h: 16 + rand() * 10,
      speed: 0.25 + rand() * 0.3,
      dark: rand() * 0.2,
    }));
    const bolts: Bolt[] = Array.from({ length: 5 }, (_v, i) => ({
      x: 100 + i * 165,
      timer: Math.floor(rand() * 180),
      delay: 45 + i * 30 + rand() * 50,
      active: false,
      dur: 0,
      x2: 0,
    }));
    return { clouds, bolts, rand };
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

    const clouds = scene.clouds.map((c) => ({ ...c }));
    const bolts = scene.bolts.map((b) => ({ ...b }));
    const rand = scene.rand;
    const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;

    let t = 0;
    let flash = 0;

    const drawBolt = (x: number, y1: number, y2: number, rough: number, glow: number) => {
      const n = 8;
      const pts: [number, number][] = [[x, y1]];
      for (let i = 1; i < n; i++) {
        pts.push([
          x + (rand() - 0.5) * rough,
          y1 + (y2 - y1) * (i / n) + (rand() - 0.5) * rough * 0.3,
        ]);
      }
      pts.push([x + (rand() - 0.5) * 4, y2]);

      // Glow pass
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
      ctx.strokeStyle = `rgba(147,197,253,${glow * 0.35})`;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Core
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
      ctx.strokeStyle = `rgba(224,240,255,${glow})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Branch
      if (pts.length > 4 && rand() > 0.4) {
        const bi = 2 + Math.floor(rand() * (pts.length - 3));
        ctx.beginPath();
        ctx.moveTo(pts[bi][0], pts[bi][1]);
        ctx.lineTo(pts[bi][0] + (rand() - 0.5) * 22, pts[bi][1] + 12 + rand() * 14);
        ctx.strokeStyle = `rgba(186,230,253,${glow * 0.5})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    };

    const w = Math.max(1, Math.floor(dims.w));
    const h = Math.max(1, Math.floor(dims.h));
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    const sx = w / BASE_DW;
    const sy = h / BASE_DH;

    const loop = () => {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.scale(sx, sy);

      flash = Math.max(0, flash - 0.06);
      const fb = flash;

      // Storm sky
      const bg = ctx.createLinearGradient(0, 0, 0, BASE_DH);
      bg.addColorStop(0, `rgb(${6 + fb * 25},${8 + fb * 30},${20 + fb * 40})`);
      bg.addColorStop(0.5, `rgb(${10 + fb * 18},${12 + fb * 22},${30 + fb * 35})`);
      bg.addColorStop(1, `rgb(${14 + fb * 12},${16 + fb * 16},${38 + fb * 28})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Rain streaks — angled
      for (let i = 0; i < 56; i++) {
        const rx = ((i * 19 + t * 55) % (BASE_DW + 30)) - 15;
        const ry = ((i * 27 + t * 40) % (BASE_DH + 12)) - 6;
        const ra = 0.04 + Math.sin(i) * 0.025;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 9);
        ctx.strokeStyle = `rgba(147,197,253,${ra})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Clouds — layered with shadow undersides
      for (const c of clouds) {
        c.x += c.speed;
        if (c.x > BASE_DW + c.w) c.x = -c.w;

        const cshadow = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h + 4);
        cshadow.addColorStop(0, `rgba(20,30,50,${0.7 + c.dark})`);
        cshadow.addColorStop(1, `rgba(8,14,28,${0.5 + c.dark})`);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + c.h * 0.6, c.w / 2, c.h / 2 + 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = cshadow;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22,30,48,${0.85 + c.dark})`;
        ctx.fill();

        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.ellipse(c.x + i * c.w * 0.3, c.y - c.h * 0.1, c.w * 0.28, c.h * 0.42, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(18,26,42,${0.8 + c.dark})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.ellipse(c.x - c.w * 0.1, c.y - c.h * 0.3, c.w * 0.35, c.h * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(50,60,90,0.25)";
        ctx.fill();
      }

      // Lightning
      for (const b of bolts) {
        b.timer++;
        if (!b.active && b.timer > b.delay) {
          b.active = true;
          b.dur = 5 + Math.floor(rand() * 9);
          b.timer = 0;
          b.delay = 55 + rand() * 100;
          b.x2 = b.x + (rand() - 0.5) * 20;
          flash = 0.9;
        }
        if (b.active) {
          drawBolt(b.x2 + (rand() - 0.5) * 6, 5, BASE_DH - 3, 14, 0.5 + rand() * 0.45);
          b.dur--;
          if (b.dur <= 0) b.active = false;
        }
      }

      // Flash overlay
      if (fb > 0) {
        ctx.fillStyle = `rgba(180,215,255,${fb * 0.14})`;
        ctx.fillRect(0, 0, BASE_DW, BASE_DH);
      }

      // Thunder shimmer fringe
      const shimmer = ctx.createLinearGradient(0, BASE_DH - 8, 0, BASE_DH);
      shimmer.addColorStop(0, "rgba(100,150,255,0)");
      shimmer.addColorStop(1, `rgba(100,150,255,${0.04 + fb * 0.06})`);
      ctx.fillStyle = shimmer;
      ctx.fillRect(0, BASE_DH - 8, BASE_DW, 8);

      // IMPORTANT: no text / no badges / no fillText.

      t += 0.018;
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

