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

export default function GoldenNexusBanner({
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

  const scene = useMemo(() => {
    const rand = mulberry32(20260321);

    const orbs = Array.from({ length: 8 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 8,
      speed: 0.007 + i * 0.0008,
      r: 2 + rand() * 1,
      phase: (i * Math.PI * 2) / 8,
    }));

    const sparks = Array.from({ length: 35 }, () => ({
      x: rand() * BASE_DW,
      y: rand() * BASE_DH,
      life: rand(),
      speed: 0.004 + rand() * 0.009,
      r: rand() * 2.2 + 0.5,
    }));

    return { orbs, sparks };
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

    const sx = dims.w / BASE_DW;
    const sy = dims.h / BASE_DH;
    ctx.scale(sx, sy);

    let t = 0;

    const sparks = scene.sparks.map((s) => ({ ...s }));
    const orbs = scene.orbs.map((o) => ({ ...o, angle: o.angle, phase: o.phase }));

    const draw = () => {
      // Background
      const CX = BASE_DW / 2;
      const CY = BASE_DH / 2;

      const bg = ctx.createLinearGradient(0, 0, BASE_DW, 0);
      bg.addColorStop(0, "#060200");
      bg.addColorStop(0.2, "#130800");
      bg.addColorStop(0.5, "#2a1400");
      bg.addColorStop(0.8, "#130800");
      bg.addColorStop(1, "#060200");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);

      // Gold nebula haze
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const haze = ctx.createRadialGradient(CX, CY, 0, CX, CY, 130);
      haze.addColorStop(0, "rgba(251,191,36,0.1)");
      haze.addColorStop(0.4, "rgba(180,100,0,0.05)");
      haze.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, BASE_DW, BASE_DH);
      ctx.restore();

      // Outer gear teeth ring
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(t * 0.18);
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI * 2) / 32;
        const r1 = 44;
        const r2 = i % 2 === 0 ? 50 : 47;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.45);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * 0.45);
        ctx.strokeStyle = `rgba(251,191,36,${i % 2 === 0 ? 0.5 : 0.2})`;
        ctx.lineWidth = i % 2 === 0 ? 1.4 : 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // Outer ring circle
      ctx.save();
      ctx.translate(CX, CY);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 21, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,191,36,0.2)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();

      // Mid rotating ring (counter)
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(-t * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 33, 15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(253,186,116,0.3)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI * 2) / 12;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 33, Math.sin(a) * 15, i % 3 === 0 ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? "rgba(253,224,71,0.7)" : "rgba(251,191,36,0.35)";
        ctx.fill();
      }
      ctx.restore();

      // Inner fast ring
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(t * 1.4);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 11);
        ctx.strokeStyle = "rgba(253,224,71,0.6)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();

      // Radial spokes
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(t * 0.35);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16;
        const pulse = Math.sin(t * 2.5 + i * 0.4) * 0.5 + 0.5;

        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 3);
        ctx.lineTo(Math.cos(a) * (BASE_DW * 0.55), Math.sin(a) * (BASE_DH * 0.7));

        const sg = ctx.createLinearGradient(0, 0, Math.cos(a) * 200, Math.sin(a) * 100);
        sg.addColorStop(0, `rgba(251,191,36,${0.25 + pulse * 0.15})`);
        sg.addColorStop(0.3, "rgba(251,191,36,0.08)");
        sg.addColorStop(1, "rgba(251,191,36,0)");
        ctx.strokeStyle = sg;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();

      // Orbiting orbs
      for (const o of orbs) {
        o.angle += o.speed;
        const OX = CX + Math.cos(o.angle) * 38;
        const OY = CY + Math.sin(o.angle) * 17;
        const p = Math.sin(t * 5 + o.phase) * 0.5 + 0.5;

        ctx.save();
        ctx.globalCompositeOperation = "screen";

        // Orb glow
        const og = ctx.createRadialGradient(OX, OY, 0, OX, OY, o.r * 4);
        og.addColorStop(0, "rgba(255,255,200,0.8)");
        og.addColorStop(0.4, "rgba(251,191,36,0.4)");
        og.addColorStop(1, "rgba(251,191,36,0)");
        ctx.beginPath();
        ctx.arc(OX, OY, o.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = og;
        ctx.fill();

        // Trail
        for (let tr = 1; tr <= 4; tr++) {
          const ta = o.angle - o.speed * tr * 3;
          const tx = CX + Math.cos(ta) * 38;
          const ty = CY + Math.sin(ta) * 17;
          const rr = o.r * (1 - tr * 0.2);

          ctx.beginPath();
          ctx.arc(tx, ty, rr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251,191,36,${0.3 - tr * 0.07})`;
          ctx.fill();
        }

        ctx.restore();
      }

      // Center nexus
      const nexus = ctx.createRadialGradient(CX, CY, 0, CX, CY, 16);
      nexus.addColorStop(0, "#fffde7");
      nexus.addColorStop(0.25, "#fef08a");
      nexus.addColorStop(0.55, "#fbbf24");
      nexus.addColorStop(0.8, "#d97706");
      nexus.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      ctx.arc(CX, CY, 18, 0, Math.PI * 2);
      ctx.fillStyle = nexus;
      ctx.fill();
      ctx.restore();

      // Triangle symbol
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(t * 0.9);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 4);
      ctx.lineTo(-7, 4);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Sparkles
      for (const s of sparks) {
        s.life += s.speed;
        if (s.life > 1) {
          s.life = 0;
          s.x = mulberry32(12345 + Math.floor(t * 1000))() * BASE_DW;
          s.y = mulberry32(54321 + Math.floor(t * 1000))() * BASE_DH;
        }

        const a = Math.sin(s.life * Math.PI);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.life * Math.PI * 2);
        ctx.globalCompositeOperation = "screen";
        ctx.beginPath();
        ctx.moveTo(0, -s.r * 2.5);
        ctx.lineTo(0, s.r * 2.5);
        ctx.moveTo(-s.r * 2.5, 0);
        ctx.lineTo(s.r * 2.5, 0);
        ctx.strokeStyle = `rgba(253,224,71,${a * 0.65})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      }

      // IMPORTANT: No badge / no fillText.

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims.w, dims.h, scene.orbs, scene.sparks]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

