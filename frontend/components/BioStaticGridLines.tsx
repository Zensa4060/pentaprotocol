"use client";
import React, { useEffect, useRef } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";

/**
 * Static BIO-style grid lines:
 * - always visible
 * - no requestAnimationFrame / blinking
 * - drawn once on mount + when dimensions change
 */
export default function BioStaticGridLines({
  W,
  H,
  PAD,
  CS,
  SIZE,
}: {
  W: number;
  H: number;
  PAD: number;
  CS: number;
  SIZE: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const dpr = boardSkinCanvasDpr(SIZE);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;

    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, W, H);

    // Constant factors so lines never "blink" or disappear.
    const bio = 0.85;
    const pl = 0.78;

    // ── layered strokes ─────────────────────────────────────────────────────
    for (let i = 0; i <= SIZE; i++) {
      const x = PAD + i * CS;
      const y = PAD + i * CS;

      ctx.save();
      ctx.strokeStyle = "rgba(0,255,200,.07)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(0,240,180,${0.2 * bio})`;
      ctx.lineWidth = 9;
      ctx.shadowColor = "rgba(0,255,180,.7)";
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(0,255,200,${0.72 * bio})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(0,255,200,1)";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(180,255,240,${0.92 * bio})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(255,255,255,.8)";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(120,0,255,.06)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(140,80,255,${0.18 * bio})`;
      ctx.lineWidth = 9;
      ctx.shadowColor = "rgba(160,80,255,.7)";
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(180,100,255,${0.72 * bio})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(200,100,255,1)";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(220,200,255,${0.92 * bio})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(255,255,255,.8)";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();
    }

    // ── intersection glow ─────────────────────────────────────────────────
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS;
        const ny = PAD + r * CS;
        const cc = (r + c) % 2 === 0 ? "0,255,200" : "180,100,255";

        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12 * pl);
        ng.addColorStop(0, `rgba(${cc},${0.4 * pl})`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, 12 * pl, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = `rgba(${cc},${0.9 * pl})`;
        ctx.shadowColor = `rgb(${cc})`;
        ctx.shadowBlur = 16 * pl;
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [W, H, PAD, CS, SIZE]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

