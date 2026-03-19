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

type Bolt = {
  angle: number;
  len: number;
  phase: number;
  speed: number;
  segDx: number[]; // deterministic offsets per segment
  segDy: number[]; // deterministic offsets per segment
};

type Ring = { r: number; phase: number; speed: number };

export default function PlasmaCoreBanner({
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

    const bolts: Bolt[] = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 8;
      const len = 22 + rand() * 18;
      const phase = rand() * Math.PI * 2;
      const speed = 0.04 + rand() * 0.035;
      // 6 segments used (i=1..6)
      const segDx = Array.from({ length: 6 }, () => (rand() - 0.5) * 5);
      const segDy = Array.from({ length: 6 }, () => (rand() - 0.5) * 3);
      return { angle, len, phase, speed, segDx, segDy };
    });

    const rings: Ring[] = Array.from({ length: 6 }, (_, i) => ({
      r: 6 + i * 12,
      phase: (i * Math.PI) / 3,
      speed: 0.005 + i * 0.003,
    }));

    return { bolts, rings };
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

    let w = Math.max(1, Math.floor(dims.w));
    let h = Math.max(1, Math.floor(dims.h));

    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    // Reset transform and then scale into base coords.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sx = w / BASE_DW;
    const sy = h / BASE_DH;
    ctx.scale(sx, sy);

    const CX = BASE_DW / 2;
    const CY = BASE_DH / 2;

    // Clone scene arrays so we can mutate phase/angle without affecting others.
    const bolts = scene.bolts.map((b) => ({ ...b, segDx: [...b.segDx], segDy: [...b.segDy] }));
    const rings = scene.rings.map((r) => ({ ...r }));

    let t = 0;

    const draw = () => {
      // Background: rich dark purple core
      const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, BASE_DW * 0.55);
      bg.addColorStop(0, "#12082a");
      bg.addColorStop(0.4, "#0c0520");
      bg.addColorStop(1, "#050210");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Plasma field noise (no text)
      for (let x = 0; x < BASE_DW; x += 10) {
        for (let y = 0; y < BASE_DH; y += 10) {
          const dx = x - CX;
          const dy = y - CY;
          const d = Math.sqrt(dx * dx + dy * dy);
          const v =
            Math.sin(x * 0.045 + t * 1.8) *
            Math.cos(y * 0.07 + t * 1.4) *
            Math.sin(d * 0.03 - t) *
            0.5 +
            0.5;
          if (v > 0.62 && d < 180) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(120,80,240,${(v - 0.62) * 0.2})`;
            ctx.fill();
          }
        }
      }

      // Pulsing ripple rings
      for (const ring of rings) {
        ring.phase += ring.speed;
        const p = Math.sin(ring.phase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.ellipse(
          CX,
          CY,
          ring.r * (1 + p * 0.07),
          ring.r * 0.42 * (1 + p * 0.07),
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(${90 + p * 80},${60 + p * 60},${255},${0.08 + p * 0.3})`;
        ctx.lineWidth = 0.7 + p * 0.5;
        ctx.shadowColor = `rgba(120,80,255,0.4)`;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 3 orbital ellipses at different tilts
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(t * (0.35 + i * 0.18) * (i % 2 ? -1 : 1) + (i * Math.PI) / 3);

        ctx.beginPath();
        ctx.ellipse(0, 0, 36 + i * 12, 13 + i * 4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${0.22 + i * 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        const beadA = t * (0.35 + i * 0.18) * (i % 2 ? -1 : 1);
        const bx = Math.cos(beadA) * (36 + i * 12);
        const by = Math.sin(beadA) * (13 + i * 4);

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, 4);
        bg2.addColorStop(0, "rgba(200,180,255,0.9)");
        bg2.addColorStop(1, "rgba(120,80,255,0)");
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.restore();
      }

      // Lightning bolt arms (deterministic offsets)
      if (Math.floor(t * 30) % 2 === 0) {
        for (const b of bolts) {
          b.angle += b.speed;

          const startR = 14;
          const endR = b.len;
          const pts: Array<[number, number]> = [];
          pts.push([Math.cos(b.angle) * startR, Math.sin(b.angle) * startR * 0.5]);

          // 6 segments
          for (let i = 1; i <= 6; i++) {
            const r = startR + (endR - startR) * (i / 6);
            const dx = b.segDx[i - 1];
            const dy = b.segDy[i - 1];
            pts.push([
              Math.cos(b.angle) * r + dx,
              Math.sin(b.angle) * r * 0.5 + dy,
            ]);
          }

          ctx.save();
          ctx.translate(CX, CY);
          ctx.globalCompositeOperation = "screen";

          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.strokeStyle = "rgba(200,170,255,0.55)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 0.3;
          ctx.stroke();

          ctx.restore();
        }
      }

      // Energy wave emanating from core
      for (let ww = 0; ww < 4; ww++) {
        const wPhase = ((t * 1.2 - ww * 0.25) % 1 + 1) % 1; // keep positive modulo
        const wR = 5 + wPhase * 70;
        ctx.beginPath();
        ctx.ellipse(CX, CY, wR, wR * 0.42, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(147,120,255,${(1 - wPhase) * 0.15})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Core — 3 layer glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.15, "#e0d0ff");
      core.addColorStop(0.5, "rgba(120,80,255,0.6)");
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(CX, CY, 18, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
      ctx.restore();

      // Rotating energy arcs
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10 + t * 1.6;
        const p = Math.sin(t * 6 + i) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(a) * 11, CY + Math.sin(a) * 5.5, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,181,253,${p * 0.9})`;
        ctx.fill();
      }

      // IMPORTANT: no badge, no fillText, no ctx.font.

      t += 0.022;
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

