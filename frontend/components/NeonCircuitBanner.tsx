"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const BASE_DW = 860;
const BASE_DH = 80;
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;

// Deterministic RNG for consistent visuals across screens.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Trace = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  speed: number;
  offset: number;
};

type Node = { x: number; y: number; phase: number };

export default function NeonCircuitBanner({
  style = {},
  hideLabels = false,
}: {
  style?: React.CSSProperties;
  hideLabels?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dims, setDims] = useState({ w: BASE_DW, h: BASE_DH });

  // Create banner geometry once (seeded).
  const scene = useMemo(() => {
    const rand = mulberry32(20260319);

    const traces: Trace[] = [];
    for (let row = 0; row < 4; row++) {
      let x = 0;
      const y = 8 + row * 16;
      while (x < BASE_DW) {
        const len = 35 + rand() * 75;
        traces.push({
          x1: x,
          y1: y,
          x2: x + len,
          y2: y,
          speed: 0.4 + rand() * 0.5,
          offset: rand() * 180,
        });
        x += len + 4 + rand() * 8;
      }
    }

    // Nodes are a subset of trace endpoints (seeded).
    const nodes: Node[] = traces
      .filter(() => rand() > 0.55)
      .map((p) => ({
        x: p.x2,
        y: p.y1,
        phase: rand() * Math.PI * 2,
      }));

    return { traces, nodes };
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

    let raf = 0;
    let t = 0;

    const w = Math.max(1, Math.floor(dims.w));
    const h = Math.max(1, Math.floor(dims.h));
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    const sx = w / BASE_DW;
    const sy = h / BASE_DH;

    const draw = () => {
      // Prevent accumulated scaling when dims changes.
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      // Scale base design into actual banner size.
      ctx.scale(sx, sy);

      // Background
      ctx.fillStyle = "#020a04";
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Grid dot background
      for (let gx = 0; gx < BASE_DW; gx += 24) {
        for (let gy = 0; gy < BASE_DH; gy += 20) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,200,80,0.06)";
          ctx.fill();
        }
      }

      // Traces with data pulses
      scene.traces.forEach((p) => {
        const len = p.x2 - p.x1;
        const flow = ((t * 55 * p.speed + p.offset) % (len + 80)) - 40;

        // Dim base trace
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.strokeStyle = "rgba(0,160,70,0.1)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Pulse head/tail
        if (flow > -30 && flow < len + 30) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x1, p.y1 - 3, len, 6);
          ctx.clip();

          const headX = p.x1 + flow;

          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const hGrd = ctx.createLinearGradient(headX - 18, 0, headX + 6, 0);
          hGrd.addColorStop(0, "rgba(0,255,120,0)");
          hGrd.addColorStop(0.6, "rgba(0,255,120,0.9)");
          hGrd.addColorStop(1, "rgba(200,255,240,1)");
          ctx.fillStyle = hGrd;
          ctx.fillRect(headX - 18, p.y1 - 1.5, 24, 3);

          const tGrd = ctx.createLinearGradient(headX - 45, 0, headX, 0);
          tGrd.addColorStop(0, "rgba(0,255,120,0)");
          tGrd.addColorStop(1, "rgba(0,255,120,0.2)");
          ctx.fillStyle = tGrd;
          ctx.fillRect(
            Math.max(p.x1, headX - 45),
            p.y1 - 1,
            Math.min(45, headX - p.x1),
            2
          );
          ctx.restore();
          ctx.restore();
        }
      });

      // Vertical connectors
      for (let i = 0; i < 12; i++) {
        const x = 25 + i * 52;
        const active = Math.sin(t * 3.5 + i * 0.9) > 0.4;

        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, BASE_DH - 8);
        ctx.strokeStyle = active ? "rgba(0,255,100,0.18)" : "rgba(0,80,40,0.08)";
        ctx.lineWidth = 0.7;
        ctx.stroke();

        if (active) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const pulse = Math.sin(t * 3.5 + i * 0.9) * 0.5 + 0.5;
          const vGrd = ctx.createLinearGradient(x, 8, x, BASE_DH - 8);
          vGrd.addColorStop(0, "rgba(0,255,100,0)");
          vGrd.addColorStop(0.5, `rgba(0,255,100,${pulse * 0.3})`);
          vGrd.addColorStop(1, "rgba(0,255,100,0)");
          ctx.fillStyle = vGrd;
          ctx.fillRect(x - 1, 8, 2, BASE_DH - 16);
          ctx.restore();
        }
      }

      // Nodes (halo + dot)
      scene.nodes.forEach((n) => {
        const flicker = Math.sin(t * 9 + n.phase) > 0.9;
        const pulse = Math.sin(t * 4.5 + n.phase) * 0.5 + 0.5;

        ctx.save();
        ctx.globalCompositeOperation = "screen";

        if (pulse > 0.5) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6 + pulse * 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,120,${(pulse - 0.5) * 0.3})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = flicker ? "#fff" : `rgba(0,255,120,${0.6 + pulse * 0.4})`;
        ctx.fill();

        ctx.restore();
      });

      // Scan beam
      const scanX = ((t * 50) % (BASE_DW + 100)) - 80;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const scanGrd = ctx.createLinearGradient(scanX, 0, scanX + 80, 0);
      scanGrd.addColorStop(0, "rgba(0,255,120,0)");
      scanGrd.addColorStop(0.6, "rgba(0,255,120,0.06)");
      scanGrd.addColorStop(0.8, "rgba(0,255,120,0.12)");
      scanGrd.addColorStop(1, "rgba(0,255,120,0)");
      ctx.fillStyle = scanGrd;
      ctx.fillRect(scanX, 0, 80, BASE_DH);
      ctx.restore();

      // HUD corner marks (no text)
      [
        [0, 0],
        [BASE_DW - 16, 0],
        [0, BASE_DH - 6],
        [BASE_DW - 16, BASE_DH - 6],
      ].forEach(([x, y]) => {
        ctx.fillStyle = "rgba(0,255,100,0.25)";
        ctx.fillRect(x, y, 16, 2);
        ctx.fillRect(x, y, 2, 6);
      });

      // NO TEXT/NO BADGES: requirement says remove any text from banners.

      t += 0.018;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [dims.w, dims.h, scene.traces, scene.nodes]);

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
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

