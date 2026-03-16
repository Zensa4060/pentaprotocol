"use client";
import React, { useEffect, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

export default function VoidRiftBanner({ style = {} }: { style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [dims, setDims] = useState({ w: 860, h: 80 });

  // Use ResizeObserver for true responsiveness
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

  const particles = useRef<any[]>([]);
  useEffect(() => {
    // Initialize or re-init particles when dims change
    particles.current = Array.from({ length: 80 }, () => ({
      x: dims.w / 2 + (Math.random() - 0.5) * 120,
      y: dims.h / 2 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.15 + Math.random() * 0.35),
      r: Math.random() * 1.8 + 0.3,
      life: Math.random(),
      speed: 0.004 + Math.random() * 0.006,
      hue: 280 + Math.random() * 40,
    }));
  }, [dims]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w * DPR;
    canvas.height = dims.h * DPR;
    ctx.scale(DPR, DPR);

    const cx = dims.w / 2;
    const cy = dims.h / 2;
    let t = 0;

    const draw = () => {
      // Deep space bg with radial depth
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, dims.w * 0.6);
      bg.addColorStop(0, "#0e0020"); bg.addColorStop(0.4, "#07000f"); bg.addColorStop(1, "#020005");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, dims.w, dims.h);

      // Distant star dust
      for (let i = 0; i < 120; i++) {
        const sx = (Math.sin(i * 127.3) * 0.5 + 0.5) * dims.w;
        const sy = (Math.sin(i * 311.7) * 0.5 + 0.5) * dims.h;
        const tw = Math.sin(t * 1.5 + i * 0.4) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(sx, sy, 0.4 + tw * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,180,255,${0.05 + tw * 0.15})`; ctx.fill();
      }

      // Rift ellipses — 12 rings with depth shimmer
      for (let i = 0; i < 12; i++) {
        const wave = Math.sin(t * 1.1 + i * 0.45) * 0.5 + 0.5;
        const rx = (18 + i * 26) * (dims.w / 860), ry = (5 + i * 4.5) * (dims.h / 80);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath(); ctx.ellipse(0, 0, rx * (1 + wave * 0.05), ry * (1 + wave * 0.08), 0, 0, Math.PI * 2);
        const alpha = (0.08 + wave * 0.28) * (1 - i / 14);
        ctx.strokeStyle = `hsla(${285 + i * 4},90%,${55 + wave * 20}%,${alpha})`;
        ctx.lineWidth = 0.7 + wave * 0.5;
        ctx.shadowColor = `hsla(${285 + i * 4},100%,70%,0.4)`; ctx.shadowBlur = 4;
        ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
      }

      // Central radial glow
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * (dims.h / 80));
      glow.addColorStop(0, "rgba(180,60,255,0.22)"); glow.addColorStop(0.5, "rgba(100,20,200,0.08)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, dims.w, dims.h); ctx.restore();

      // Particles
      particles.current.forEach((p) => {
        p.life += p.speed;
        if (p.life > 1) { p.life = 0; p.x = cx + (Math.random() - 0.5) * 80; p.y = cy + (Math.random() - 0.5) * 30; }
        const a = Math.sin(p.life * Math.PI);
        const px = p.x + Math.cos(t * 0.8 + p.vx * 20) * 18 * p.life;
        const py = p.y - p.life * 60 + Math.sin(t + p.vy * 15) * 6;
        ctx.save(); ctx.globalCompositeOperation = "screen";
        ctx.beginPath(); ctx.arc(px, py, p.r * (1.2 - p.life * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,75%,${a * 0.85})`; ctx.fill();
        ctx.restore();
      });

      // Rotating spokes
      for (let layer = 0; layer < 3; layer++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (0.5 + layer * 0.25) * (layer % 2 ? -1 : 1));
        const spokeCount = 6 + layer * 2;
        for (let i = 0; i < spokeCount; i++) {
          const a = (i * Math.PI * 2) / spokeCount;
          const len = (14 + layer * 6) * (dims.w / 860);
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 2);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len * 0.5);
          ctx.strokeStyle = `rgba(200,80,255,${0.4 - layer * 0.1})`; ctx.lineWidth = 0.8 - layer * 0.15; ctx.stroke();
        }
        ctx.restore();
      }

      // Core orb
      const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13 * (dims.h / 80));
      orb.addColorStop(0, "#fff"); orb.addColorStop(0.2, "#f0abfc"); orb.addColorStop(0.6, "#7c3aed"); orb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.globalCompositeOperation = "screen";
      ctx.beginPath(); ctx.arc(cx, cy, 13 * (dims.h / 80), 0, Math.PI * 2); ctx.fillStyle = orb; ctx.fill(); ctx.restore();

      // Lens flare
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const flareW = 120 * (dims.w / 860);
      const flare = ctx.createLinearGradient(cx - flareW / 2, cy, cx + flareW / 2, cy);
      flare.addColorStop(0, "rgba(0,0,0,0)"); flare.addColorStop(0.4, "rgba(160,80,255,0.12)"); flare.addColorStop(0.5, "rgba(255,200,255,0.25)"); flare.addColorStop(0.6, "rgba(160,80,255,0.12)"); flare.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = flare; ctx.fillRect(cx - flareW / 2, cy - 1.5, flareW, 3); ctx.restore();

      // Rarity badge
      ctx.save();
      ctx.fillStyle = "rgba(60,0,80,0.55)"; ctx.strokeStyle = "rgba(192,132,252,0.8)"; ctx.lineWidth = 0.8;
      roundRect(ctx, 10, cy - 9, 70, 18, 3); ctx.fill(); ctx.stroke();
      ctx.font = "700 7.5px 'Courier New',monospace"; ctx.fillStyle = "#e879f9"; ctx.textAlign = "left";
      ctx.fillText("✦ LEGENDARY", 15, cy + 4.5); ctx.restore();

      // Name label
      ctx.font = "700 8.5px 'Courier New',monospace"; ctx.fillStyle = "rgba(216,180,254,0.6)";
      ctx.textAlign = "right"; ctx.fillText("VOID RIFT", dims.w - 12, cy + 4);

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
