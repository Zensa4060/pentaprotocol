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

type Star = {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  speed: number;
  r: number;
  phase: number;
  col: [number, number, number];
};

type Nebula = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  col: [number, number, number];
  a: number;
  ph: number;
};

export default function StarfieldBanner({
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
    const rand = mulberry32(20260321);
    const CX = BASE_DW / 2;
    const CY = BASE_DH / 2;

    const stars: Star[] = Array.from({ length: 96 }, () => {
      const a = rand() * Math.PI * 2;
      const d = rand() * 35 + 2;
      const baseDx = Math.cos(a) * (d / 35) * (0.12 + rand() * 0.35);
      const baseDy = Math.sin(a) * 0.5 * (d / 35) * (0.12 + rand() * 0.35);
      const col =
        rand() > 0.82 ? ([200, 210, 255] as const) : rand() > 0.5 ? ([255, 255, 255] as const) : ([180, 195, 240] as const);
      return {
        ox: CX + Math.cos(a) * d,
        oy: CY + Math.sin(a) * d * 0.5,
        dx: baseDx,
        dy: baseDy,
        speed: 0.15 + rand() * 0.5,
        r: rand() * 1.3 + 0.2,
        phase: rand() * Math.PI * 2,
        col: [col[0], col[1], col[2]],
      };
    });

    const nebulas: Nebula[] = Array.from({ length: 5 }, () => ({
      x: rand() * BASE_DW,
      y: rand() * BASE_DH,
      rx: 35 + rand() * 65,
      ry: 12 + rand() * 28,
      col: (rand() > 0.5 ? ([70, 30, 120] as const) : ([20, 50, 120] as const)) as any,
      a: 0.025 + rand() * 0.035,
      ph: rand() * Math.PI * 2,
    }));

    return { stars, nebulas, rand };
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

    const stars = scene.stars.map((s) => ({ ...s }));
    const nebulas = scene.nebulas.map((n) => ({ ...n }));
    const rand = scene.rand;
    const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;

    const CX = BASE_DW / 2;
    const CY = BASE_DH / 2;
    let t = 0;

    const w = Math.max(1, Math.floor(dims.w));
    const h = Math.max(1, Math.floor(dims.h));
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    const sx = w / BASE_DW;
    const sy = h / BASE_DH;

    const loop = () => {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.scale(sx, sy);

      // Deep space bg
      const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, BASE_DW * 0.65);
      bg.addColorStop(0, "#0d0720");
      bg.addColorStop(0.3, "#090518");
      bg.addColorStop(0.7, "#050210");
      bg.addColorStop(1, "#020108");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Nebula clouds
      for (const n of nebulas) {
        const p = Math.sin(t * 0.28 + n.ph) * 0.25 + 0.75;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(n.rx, n.ry) * p);
        ng.addColorStop(0, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},${n.a})`);
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.scale(1, n.ry / n.rx);
        ctx.translate(-n.x, -n.y);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.rx * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.restore();
      }

      // Center galaxy glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const gg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 70);
      gg.addColorStop(0, "rgba(80,60,140,0.07)");
      gg.addColorStop(0.5, "rgba(50,35,100,0.03)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);
      ctx.restore();

      // Stars
      for (const s of stars) {
        s.ox += s.dx * s.speed;
        s.oy += s.dy * s.speed;
        s.phase += 0.008;

        if (s.ox < -15 || s.ox > BASE_DW + 15 || s.oy < -10 || s.oy > BASE_DH + 10) {
          const a = rand() * Math.PI * 2;
          const d = rand() * 8 + 1;
          s.ox = CX + Math.cos(a) * d;
          s.oy = CY + Math.sin(a) * d * 0.5;
          s.dx = Math.cos(a) * (0.08 + rand() * 0.25);
          s.dy = Math.sin(a) * 0.5 * (0.08 + rand() * 0.25);
          s.speed = 0.15 + rand() * 0.5;
        }

        const dist = Math.sqrt((s.ox - CX) ** 2 + (s.oy - CY) ** 2);
        const spd = Math.min(1, dist / 90);
        const tw = Math.sin(s.phase * 3.5) * 0.3 + 0.7;
        const alpha = Math.min(1, dist / 18) * tw;
        const r = s.r * (0.4 + spd * 0.8);

        if (spd > 0.4) {
          const len = spd * 10;
          const denom = Math.sqrt(s.dx ** 2 + s.dy ** 2 + 0.001);
          const nx = -(s.dx / denom) * len;
          const ny = -(s.dy / denom) * len;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const trg = ctx.createLinearGradient(s.ox, s.oy, s.ox + nx, s.oy + ny);
          trg.addColorStop(0, `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${alpha * 0.9})`);
          trg.addColorStop(1, `rgba(${s.col[0]},${s.col[1]},${s.col[2]},0)`);
          ctx.beginPath();
          ctx.moveTo(s.ox, s.oy);
          ctx.lineTo(s.ox + nx, s.oy + ny);
          ctx.strokeStyle = trg;
          ctx.lineWidth = r * 0.55;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        if (r > 0.8) {
          const sg2 = ctx.createRadialGradient(s.ox, s.oy, 0, s.ox, s.oy, r * 3.5);
          sg2.addColorStop(0, `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${alpha * 0.4})`);
          sg2.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sg2;
          ctx.beginPath();
          ctx.arc(s.ox, s.oy, r * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(s.ox, s.oy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      // Shooting star
      const sst = (t * 0.28) % 1;
      if (sst < 0.15) {
        const sp = sst / 0.15;
        const sx2 = sp * BASE_DW * 1.2 - 50;
        const sy2 = 10 + Math.sin(sp * Math.PI) * 30;
        const ssl = ctx.createLinearGradient(sx2, sy2, sx2 - 60, sy2 + 15);
        ssl.addColorStop(0, `rgba(255,255,255,${(1 - sp) * 0.8})`);
        ssl.addColorStop(0.7, `rgba(200,210,255,${(1 - sp) * 0.3})`);
        ssl.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 - 60, sy2 + 15);
        ctx.strokeStyle = ssl;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx2, sy2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(1 - sp) * 0.9})`;
        ctx.fill();
      }

      // IMPORTANT: no text / no badges / no fillText.

      t += 0.016;
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

