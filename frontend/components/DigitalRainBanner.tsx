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

type Col = {
  y: number;
  speed: number;
  chars: string[];
  ct: number;
  cs: number;
  bright: boolean;
  hue: number;
};

export default function DigitalRainBanner({
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
    const rand = mulberry32(20260322);
    const COL_W = 13;
    const NCOLS = Math.floor(BASE_DW / COL_W);
    const TRAIL = 10;
    const cols: Col[] = Array.from({ length: NCOLS }, () => ({
      y: rand() * BASE_DH * 2 - BASE_DH,
      speed: 0.45 + rand() * 1.15,
      chars: Array.from({ length: TRAIL }, () => String.fromCharCode(0x30a0 + Math.floor(rand() * 96))),
      ct: 0,
      cs: 3 + Math.floor(rand() * 4),
      bright: rand() > 0.82,
      hue: rand() > 0.92 ? 160 : 140,
    }));
    return { cols, COL_W, NCOLS, TRAIL, rand };
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

    const cols = scene.cols.map((c) => ({ ...c, chars: [...c.chars] }));
    const { COL_W, TRAIL } = scene;
    const rand = scene.rand;
    const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

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

      ctx.fillStyle = "rgba(0,7,2,0.86)";
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Fine scanlines
      for (let y = 0; y < BASE_DH; y += 3) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, y, BASE_DW, 1);
      }

      // Glyphs (no text labels; only the rain characters)
      ctx.font = `${COL_W - 1}px 'Courier New',monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i]!;
        col.y += col.speed;
        col.ct++;
        if (col.ct >= col.cs) {
          col.ct = 0;
          col.chars.shift();
          col.chars.push(String.fromCharCode(0x30a0 + Math.floor(rand() * 96)));
        }
        if (col.y > BASE_DH + TRAIL * COL_W) {
          col.y = -5 - rand() * 50;
          col.speed = 0.45 + rand() * 1.15;
          col.bright = rand() > 0.82;
        }

        const x = i * COL_W + COL_W / 2;
        for (let ci = 0; ci < col.chars.length; ci++) {
          const ch = col.chars[ci]!;
          const cy2 = col.y - ci * COL_W;
          if (cy2 < -COL_W || cy2 > BASE_DH + COL_W) continue;

          const isHead = ci === 0;
          const fade = Math.max(0, 1 - ci / TRAIL);

          if (isHead) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            const hg = ctx.createRadialGradient(x, cy2, 0, x, cy2, 7);
            hg.addColorStop(0, "rgba(0,255,120,0.22)");
            hg.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = hg;
            ctx.fillRect(x - 7, cy2 - 7, 14, 14);
            ctx.fillStyle = col.bright ? "#ffffff" : col.hue === 160 ? "#a0ffff" : "#b8ffd0";
            ctx.fillText(ch, x, cy2);
            ctx.restore();
          } else {
            const g = Math.floor(50 + fade * 185);
            const sat = col.hue === 160 ? Math.floor(fade * 100) : 0;
            ctx.fillStyle = `rgba(${sat},${g},${Math.floor(fade * 80)},${fade * 0.88})`;
            ctx.fillText(ch, x, cy2);
          }
        }
      }

      // Subtle green tint
      const tint = ctx.createLinearGradient(0, 0, 0, BASE_DH);
      tint.addColorStop(0, "rgba(0,15,4,0.1)");
      tint.addColorStop(1, "rgba(0,8,2,0.08)");
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Horizontal scan shimmer
      const sy2 = ((t * 1.1) % (BASE_DH + 10)) - 5;
      const sg = ctx.createLinearGradient(0, sy2, 0, sy2 + 4);
      sg.addColorStop(0, "rgba(0,255,100,0)");
      sg.addColorStop(0.5, "rgba(0,255,100,0.035)");
      sg.addColorStop(1, "rgba(0,255,100,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, sy2, BASE_DW, 4);

      // IMPORTANT: no badges / no label text.

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

