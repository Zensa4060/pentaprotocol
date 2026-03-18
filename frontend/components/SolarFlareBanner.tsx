"use client";
import React, { useEffect, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

export default function SolarFlareBanner({ style = {}, hideLabels = false }: { style?: React.CSSProperties; hideLabels?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [dims, setDims] = useState({ w: 860, h: 80 });

  // Responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ w: width, h: height });
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const embers = useRef(Array.from({ length: 60 }, () => ({
    x: 20 + Math.random() * 80, y: 80 + Math.random() * 15, // DH=80 as baseline
    vx: (Math.random() - 0.35) * 0.7, vy: -(0.5 + Math.random() * 1.1),
    r: Math.random() * 2.2 + 0.4, alpha: 0.5 + Math.random() * 0.5,
    color: Math.random() > 0.5 ? [255, 200, 80] : [255, 120, 30],
  })));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w * DPR;
    canvas.height = dims.h * DPR;
    // Reset transform so DPR scaling doesn't accumulate on resize.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    let t = 0;
    const DW = dims.w;
    const DH = dims.h;

    const draw = () => {
      // Sunrise gradient — dark left to blazing right
      const bg = ctx.createLinearGradient(0, 0, DW, 0);
      bg.addColorStop(0, "#060200"); bg.addColorStop(0.18, "#1c0800");
      bg.addColorStop(0.42, "#5c1c00"); bg.addColorStop(0.62, "#c45000");
      bg.addColorStop(0.78, "#f97316"); bg.addColorStop(0.9, "#fde68a");
      bg.addColorStop(1, "#fffbeb");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, DW, DH);

      // Atmospheric scattering bands
      for (let i = 0; i < 6; i++) {
        const y = DH * (0.1 + i * 0.15) + Math.sin(t * 0.6 + i * 0.8) * 3;
        const grad = ctx.createLinearGradient(60, y, DW, y);
        grad.addColorStop(0, `rgba(255,${100 + i * 20},0,0)`);
        grad.addColorStop(0.3, `rgba(255,${100 + i * 20},0,${0.04 + i * 0.01})`);
        grad.addColorStop(1, `rgba(255,${200 + i * 8},100,0.02)`);
        ctx.fillStyle = grad; 
        ctx.fillRect(0, y - 3, DW, 6);
      }

      const SC = { x: 62 * (DW / 860), y: DH / 2 };

      // Corona — multi-layer rotating rays
      for (let pass = 0; pass < 3; pass++) {
        ctx.save(); ctx.translate(SC.x, SC.y);
        ctx.rotate(t * (0.2 + pass * 0.12) * (pass % 2 ? -1 : 1));
        const count = 16 + pass * 8;
        for (let i = 0; i < count; i++) {
          const a = (i * Math.PI * 2) / count;
          const pulse = Math.sin(t * 2.5 + i * 0.3 + pass) * 0.5 + 0.5;
          const r1 = 22 + pass * 4, r2 = r1 + 12 + pulse * 18;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.strokeStyle = `rgba(253,224,71,${(0.15 + pulse * 0.25) / (pass + 1)})`;
          ctx.lineWidth = 1.2 - pass * 0.3; ctx.stroke();
        }
        ctx.restore();
      }

      // Solar prominences (large arcs)
      for (let i = 0; i < 3; i++) {
        const a = t * 0.15 + i * (Math.PI * 2 / 3);
        const px = SC.x + Math.cos(a) * 28, py = SC.y + Math.sin(a) * 14;
        const cpx = SC.x + Math.cos(a + 0.5) * 40, cpy = SC.y + Math.sin(a + 0.5) * 25;
        ctx.beginPath(); ctx.moveTo(SC.x + Math.cos(a) * 20, SC.y + Math.sin(a) * 10);
        ctx.quadraticCurveTo(cpx, cpy, px, py);
        ctx.strokeStyle = `rgba(251,146,60,${0.3 + Math.sin(t * 2 + i) * 0.15})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Sun body — layered radials
      const sun = ctx.createRadialGradient(SC.x - 4, SC.y - 4, 1, SC.x, SC.y, 24);
      sun.addColorStop(0, "#fffde7"); sun.addColorStop(0.3, "#fef08a");
      sun.addColorStop(0.65, "#f97316"); sun.addColorStop(0.85, "#c2410c");
      sun.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.globalCompositeOperation = "screen";
      ctx.beginPath(); ctx.arc(SC.x, SC.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = sun; ctx.fill(); ctx.restore();

      // Chromosphere flicker rings
      for (let i = 0; i < 3; i++) {
        const p = Math.sin(t * 4 + i * 1.4) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(SC.x, SC.y, 16 + i * 4 + p * 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${0.25 + p * 0.35})`; ctx.lineWidth = 0.8; ctx.stroke();
      }

      // Heat shimmer horizontal lines
      for (let i = 0; i < 8; i++) {
        const lx = (110 + i * 90) * (DW / 860), lw = (60 + Math.sin(t * 1.5 + i) * 30) * (DW / 860);
        const grad = ctx.createLinearGradient(lx, 0, lx + lw, 0);
        grad.addColorStop(0, "rgba(251,191,36,0)"); grad.addColorStop(0.4, `rgba(251,191,36,${0.12 - i * 0.01})`);
        grad.addColorStop(1, "rgba(251,191,36,0)");
        const ly = DH / 2 + Math.sin(t * 2 + i * 0.7) * 8;
        ctx.fillStyle = grad; ctx.fillRect(lx, ly - 1, lw, 2);
      }

      // Embers
      embers.current.forEach((e) => {
        // Adjust x for responsiveness
        const scaledX = e.x * (DW / 860);
        e.x += e.vx + Math.sin(t * 1.5 + e.x * 0.02) * 0.2;
        e.y += e.vy; e.alpha -= 0.004;
        if (e.alpha <= 0 || e.y < -5) {
          e.y = DH + 5; e.x = 10 + Math.random() * 100; e.alpha = 0.7 + Math.random() * 0.3;
          e.vy = -(0.5 + Math.random() * 1.1); e.vx = (Math.random() - 0.35) * 0.7;
        }
        ctx.save(); ctx.globalCompositeOperation = "screen";
        ctx.beginPath(); ctx.arc(scaledX, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${e.alpha})`; ctx.fill(); ctx.restore();
      });

      // Lens flare from sun
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const lf = ctx.createLinearGradient(SC.x, SC.y, DW * 0.7, SC.y);
      lf.addColorStop(0, "rgba(255,200,100,0.18)"); lf.addColorStop(0.5, "rgba(255,200,100,0.04)"); lf.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lf; ctx.fillRect(SC.x, SC.y - 2, DW * 0.7 - SC.x, 4); ctx.restore();

      // (Rarity/name badge removed for all screens)

      t += 0.018;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims, hideLabels]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
