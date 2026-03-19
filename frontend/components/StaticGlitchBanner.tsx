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

type NoiseSeed = {
  x: number;
  y: number;
  w: number;
  h: number;
  c: [number, number, number];
  a: number;
};

export default function StaticGlitchBanner({
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

  const seeded = useMemo(() => {
    const rand = mulberry32(20260320);
    const noiseSeeds: NoiseSeed[] = Array.from({ length: 300 }, () => {
      const isCyan = rand() > 0.5;
      const c: [number, number, number] = isCyan ? [0, 255, 200] : [255, 0, 55];
      return {
        x: rand() * BASE_DW,
        y: rand() * BASE_DH,
        w: rand() * 50 + 5,
        h: rand() * 1.5 + 0.5,
        c,
        a: rand() * 0.18,
      };
    });

    return {
      noiseSeeds,
      initialNextGlitch: 90 + rand() * 100,
      initialGlitchDur: 6 + Math.floor(rand() * 14),
      rand,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.floor(dims.w * DPR);
    canvas.height = Math.floor(dims.h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Scale base units into current banner size.
    const sx = dims.w / BASE_DW;
    const sy = dims.h / BASE_DH;
    // We draw in base coordinates by scaling to match container.
    // This keeps visuals consistent when height differs (Career vs Profile).
    ctx.scale(sx, sy);

    let frame = 0;
    let glitchActive = false;
    let glitchDur = seeded.initialGlitchDur;
    let nextGlitch = seeded.initialNextGlitch;

    const noiseSeeds = seeded.noiseSeeds;

    const draw = () => {
      frame += 1;

      // Base background
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Fine scanlines
      for (let y = 0; y < BASE_DH; y += 2) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(0, y, BASE_DW, 1);
      }

      // Subtle vignette
      const vig = ctx.createRadialGradient(BASE_DW / 2, BASE_DH / 2, BASE_DH * 0.2, BASE_DW / 2, BASE_DH / 2, BASE_DH * 0.6);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Deterministic glitch timing (no UI text)
      if (!glitchActive && frame > nextGlitch) {
        glitchActive = true;
        glitchDur = 6 + Math.floor(seeded.rand() * 14);
        frame = 0;
        nextGlitch = 50 + seeded.rand() * 90;
      }
      if (glitchActive) {
        glitchDur -= 1;
        if (glitchDur <= 0) glitchActive = false;
      }

      // Static noise
      for (const n of noiseSeeds) {
        if (seeded.rand() > 0.75) {
          n.x = seeded.rand() * BASE_DW;
          n.y = seeded.rand() * BASE_DH;
          n.a = seeded.rand() * 0.18;
        }
        const alpha = n.a * (glitchActive ? 2 : 1);
        ctx.fillStyle = `rgba(${n.c[0]},${n.c[1]},${n.c[2]},${alpha})`;
        ctx.fillRect(n.x, n.y, n.w, n.h);
      }

      // Glitch bars — displaced rows (no text)
      if (glitchActive) {
        const barCount = 6;
        for (let i = 0; i < barCount; i++) {
          const gy = seeded.rand() * BASE_DH;
          const gw = seeded.rand() * BASE_DW * 0.5;
          const gx = seeded.rand() * (BASE_DW - gw);
          const r = seeded.rand() > 0.5 ? 255 : 0;
          const g = seeded.rand() > 0.5 ? 255 : 0;
          const b = seeded.rand() > 0.5 ? 255 : 0;
          const a = seeded.rand() * 0.15;
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.fillRect(gx, gy, gw, 1 + seeded.rand() * 4);
        }
      }

      // Horizontal scan
      const scanY = ((frame * 1.2) % (BASE_DH + 12)) - 6;
      const sg = ctx.createLinearGradient(0, scanY, 0, scanY + 5);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.04)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY, BASE_DW, 5);

      // Corner HUD marks (no text)
      const col = glitchActive ? "rgba(255,0,60,0.6)" : "rgba(0,255,120,0.2)";
      ctx.fillStyle = col;
      [
        [0, 0],
        [BASE_DW - 20, 0],
        [0, BASE_DH - 6],
        [BASE_DW - 20, BASE_DH - 6],
      ].forEach(([x, y]) => {
        ctx.fillRect(x, y, 20, 1.5);
        ctx.fillRect(x, y, 1.5, 7);
      });

      // Signal strength bars (no text)
      for (let i = 0; i < 5; i++) {
        const bh = 3 + i * 2;
        const active = i < (glitchActive ? 2 : 4);
        ctx.fillStyle = active
          ? glitchActive
            ? "rgba(255,0,60,0.6)"
            : "rgba(0,255,120,0.4)"
          : "rgba(60,60,60,0.4)";
        ctx.fillRect(BASE_DW - 90 - i * 7, BASE_DH - 4 - bh, 5, bh);
      }

      // IMPORTANT: No badge / no fillText.

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims.w, dims.h, seeded]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

