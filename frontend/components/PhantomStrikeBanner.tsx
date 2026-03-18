"use client";
import React, { useEffect, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

export default function PhantomStrikeBanner({ style = {}, hideLabels = false }: { style?: React.CSSProperties; hideLabels?: boolean }) {
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

  const slashes = useRef(Array.from({length:6},(_,i)=>({
    x: 80 + i * 145,
    progress: i * 0.16,
    speed: 0.01 + Math.random() * 0.007,
    delay: i * 0.16,
    w: 1.4 + Math.random() * 0.8,
    angle: -0.28 + Math.random() * 0.12
  })));
  const afterImages = useRef<any[]>([]);

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

    const draw = () => {
      ctx.fillStyle = "#060010";
      ctx.fillRect(0, 0, dims.w, dims.h);

      const bg = ctx.createLinearGradient(0, 0, dims.w, 0);
      bg.addColorStop(0, "#0a0020"); bg.addColorStop(0.5, "#110028"); bg.addColorStop(1, "#0a0020");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, dims.w, dims.h);

      // Speed lines
      for (let i = 0; i < 25; i++) {
        const y = (i * (dims.h / 25)) + 3;
        const a = Math.sin(t * 1.5 + i * 0.35) * 0.035 + 0.015;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dims.w, y + Math.sin(i * 0.4) * 2);
        ctx.strokeStyle = `rgba(180,100,255,${a})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Manage afterimages
      const ai = afterImages.current;
      slashes.current.forEach(s => {
        // Adjust x based on current dims scale
        const scaledX = s.x * (dims.w / 860);
        if (s.progress > 0.08 && s.progress < 0.35 && Math.random() > 0.65) {
          ai.push({ x: scaledX, angle: s.angle, alpha: 0.28, decay: 0.012, w: s.w * 0.7 });
        }
      });

      // Draw afterimages
      for (let i = ai.length - 1; i >= 0; i--) {
        const a2 = ai[i];
        a2.alpha -= a2.decay;
        if (a2.alpha <= 0) {
          ai.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(a2.x, dims.h / 2);
        ctx.rotate(a2.angle);
        const ht = dims.h * 0.85;
        const ag = ctx.createLinearGradient(0, -ht, 0, ht);
        ag.addColorStop(0, "rgba(180,80,255,0)");
        ag.addColorStop(0.5, `rgba(180,80,255,${a2.alpha})`);
        ag.addColorStop(1, "rgba(180,80,255,0)");
        ctx.fillStyle = ag;
        ctx.fillRect(-a2.w / 2, -ht, a2.w, ht * 2);
        ctx.restore();
      }

      // Main slashes
      slashes.current.forEach(s => {
        const scaledX = s.x * (dims.w / 860);
        s.progress += s.speed;
        if (s.progress > 1 + s.delay) s.progress = 0;
        const p = Math.max(0, s.progress - s.delay);
        if (p <= 0) return;
        const ease = p < 0.5 ? p * 2 : (1 - p) * 2;
        const ht = dims.h * 0.88;

        ctx.save();
        ctx.translate(scaledX, dims.h / 2);
        ctx.rotate(s.angle);

        // Wide outer aura
        const aura = ctx.createLinearGradient(0, -ht, 0, ht);
        aura.addColorStop(0, "rgba(168,85,247,0)");
        aura.addColorStop(0.5, `rgba(168,85,247,${ease * 0.2})`);
        aura.addColorStop(1, "rgba(168,85,247,0)");
        ctx.fillStyle = aura;
        ctx.fillRect(-10, -ht, 20, ht * 2);

        // Mid glow
        const mid = ctx.createLinearGradient(0, -ht, 0, ht);
        mid.addColorStop(0, "rgba(232,121,249,0)");
        mid.addColorStop(0.5, `rgba(232,121,249,${ease * 0.6})`);
        mid.addColorStop(1, "rgba(232,121,249,0)");
        ctx.fillStyle = mid;
        ctx.fillRect(-4, -ht, 8, ht * 2);

        // Sharp blade core
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const blade = ctx.createLinearGradient(0, -ht, 0, ht);
        blade.addColorStop(0, "rgba(255,200,255,0)");
        blade.addColorStop(0.25, `rgba(255,255,255,${ease * 0.85})`);
        blade.addColorStop(0.5, `rgba(255,255,255,${ease})`);
        blade.addColorStop(0.75, `rgba(255,255,255,${ease * 0.85})`);
        blade.addColorStop(1, "rgba(255,200,255,0)");
        ctx.fillStyle = blade;
        ctx.fillRect(-s.w / 2, -ht, s.w, ht * 2);
        ctx.restore();

        // Impact burst at peak
        if (ease > 0.9) {
          const fl = (ease - 0.9) * 8;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
          fg.addColorStop(0, `rgba(255,255,255,${fl * 0.5})`);
          fg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      });

      // Shadow silhouette on right
      const sil = ctx.createLinearGradient(dims.w - 100, 0, dims.w, 0);
      sil.addColorStop(0, "rgba(0,0,0,0)");
      sil.addColorStop(1, "rgba(100,40,180,0.05)");
      ctx.fillStyle = sil;
      ctx.fillRect(dims.w - 100, 0, 100, dims.h);

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
