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

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  col: [number, number, number];
};

type Flame = { x: number; phase: number; h: number; spd: number; w: number };

export default function InfernoBanner({
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
    const rand = mulberry32(20260324);
    const embers: Ember[] = Array.from({ length: 70 }, () => {
      const col =
        rand() > 0.55 ? ([255, 200, 50] as const) : rand() > 0.5 ? ([255, 110, 20] as const) : ([255, 50, 10] as const);
      return {
        x: rand() * BASE_DW,
        y: BASE_DH + rand() * 20,
        vx: (rand() - 0.5) * 0.9,
        vy: -(0.45 + rand() * 1.3),
        r: rand() * 2.5 + 0.4,
        life: rand(),
        col: [col[0], col[1], col[2]],
      };
    });
    const flames: Flame[] = Array.from({ length: 18 }, (_v, i) => ({
      x: (i / 17) * BASE_DW,
      phase: (i * Math.PI * 2) / 18,
      h: 0.28 + rand() * 0.55,
      spd: 1.3 + rand() * 1.6,
      w: 1.4 + rand() * 1.4,
    }));
    return { embers, flames, rand };
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

    const embers = scene.embers.map((e) => ({ ...e }));
    const flames = scene.flames.map((f) => ({ ...f }));
    const rand = scene.rand;
    const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

    const drawFlame = (
      x: number,
      baseY: number,
      height: number,
      flicker: number,
      w2: number,
      col: [number, number, number]
    ) => {
      const hh = height * BASE_DH * (0.8 + flicker * 0.25);
      ctx.save();
      ctx.beginPath();
      const cpL = x - w2 * BASE_DH * 0.25;
      const cpR = x + w2 * BASE_DH * 0.25;
      const topY = baseY - hh;
      ctx.moveTo(x - w2 * BASE_DH * 0.3, baseY);
      ctx.bezierCurveTo(
        cpL,
        baseY - hh * 0.35,
        x - w2 * BASE_DH * 0.08 + (rand() - 0.5) * 4,
        topY + hh * 0.28,
        x,
        topY
      );
      ctx.bezierCurveTo(
        x + w2 * BASE_DH * 0.08 + (rand() - 0.5) * 4,
        topY + hh * 0.28,
        cpR,
        baseY - hh * 0.35,
        x + w2 * BASE_DH * 0.3,
        baseY
      );
      ctx.closePath();

      const fg = ctx.createLinearGradient(x, topY, x, baseY);
      fg.addColorStop(0, "rgba(255,255,200,0)");
      fg.addColorStop(0.2, `rgba(${col[0]},${col[1]},${col[2]},0.85)`);
      fg.addColorStop(0.55, `rgba(${Math.max(0, col[0] - 30)},${Math.max(0, col[1] - 80)},0,0.92)`);
      fg.addColorStop(0.85, `rgba(${Math.max(0, col[0] - 50)},0,0,0.95)`);
      fg.addColorStop(1, `rgba(${Math.max(0, col[0] - 60)},0,0,1)`);
      ctx.fillStyle = fg;
      ctx.fill();
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

      ctx.fillStyle = "#080100";
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Lava glow from base
      const lava = ctx.createLinearGradient(0, BASE_DH * 0.45, 0, BASE_DH);
      lava.addColorStop(0, "rgba(0,0,0,0)");
      lava.addColorStop(0.6, "rgba(140,30,0,0.15)");
      lava.addColorStop(1, "rgba(200,60,0,0.3)");
      ctx.fillStyle = lava;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Heat shimmer
      for (let i = 0; i < 8; i++) {
        const hx = i * (BASE_DW / 8) + BASE_DW / 16;
        const hy = BASE_DH * (0.15 + (i % 3) * 0.2) + Math.sin(t * 3 + i * 0.8) * 4;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 20);
        hg.addColorStop(0, `rgba(255,80,0,${0.03 + Math.sin(t * 2 + i) * 0.015})`);
        hg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = hg;
        ctx.fillRect(hx - 20, hy - 20, 40, 40);
        ctx.restore();
      }

      // Flame columns — 3 tiers
      const cols: [number, number, number][] = [
        [255, 200, 50],
        [255, 110, 20],
        [255, 40, 5],
      ];
      for (let fi = 0; fi < flames.length; fi++) {
        const f = flames[fi]!;
        const flicker = Math.sin(t * f.spd + f.phase) * 0.5 + 0.5;
        const flicker2 = Math.sin(t * f.spd * 1.4 + f.phase + 0.9) * 0.4 + 0.6;
        const combined = flicker * flicker2;
        const tier = fi % 3;
        drawFlame(f.x, BASE_DH + 6, f.h * combined, flicker, f.w * 0.012, cols[tier]!);
      }

      // Secondary wispy tips
      for (let i = 0; i < 12; i++) {
        const wx = (i * 73 + t * 18) % BASE_DW;
        const wflicker = Math.sin(t * 4 + i) * 0.5 + 0.5;
        drawFlame(wx, BASE_DH + 3, 0.18 * wflicker, wflicker, 0.008, [255, 240, 100]);
      }

      // Embers
      for (const e of embers) {
        e.x += e.vx + Math.sin(t * 2.5 + e.x * 0.012) * 0.35;
        e.y += e.vy;
        e.life += 0.007;
        if (e.y < -e.r || e.life > 1) {
          e.y = BASE_DH + e.r;
          e.x = rand() * BASE_DW;
          e.life = 0;
          e.vy = -(0.45 + rand() * 1.3);
          e.vx = (rand() - 0.5) * 0.9;
        }
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (1.1 - e.life * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${e.col[0]},${e.col[1]},${e.col[2]},${Math.sin(e.life * Math.PI) * 0.8})`;
        ctx.fill();
        ctx.restore();
      }

      // Vignette darkening edges
      const vig = ctx.createLinearGradient(0, 0, BASE_DW, 0);
      vig.addColorStop(0, "rgba(0,0,0,0.35)");
      vig.addColorStop(0.15, "rgba(0,0,0,0)");
      vig.addColorStop(0.85, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // IMPORTANT: no text / no badges / no fillText.

      t += 0.022;
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

