"use client";
import React, { useEffect, useRef, useState } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";

const DEFAULT_SIZE = 5;
const GET_COLS = (s: number) => Array.from({ length: s }, (_, i) => String.fromCharCode(65 + i));
const GET_ROWS = (s: number) => Array.from({ length: s }, (_, i) => i + 1);

function useCellSize(size: number, pad = 8) {
  const [cs, setCs] = useState(110);
  useEffect(() => {
    const c = () => {
      const b = Math.min(Math.max(window.innerWidth - 560, 260), Math.max(window.innerHeight - 200, 260));
      setCs(Math.max(50, (b - 2 * pad) / size));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad, size]);
  return cs;
}

// ── Background ─────────────────────────────────────────────────────────────
function GlacierBg({ W, H, gridSize = 5, isPaused = false }: { W: number; H: number; gridSize?: number; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) { if (raf.current) cancelAnimationFrame(raf.current); return; }
    const dpr = boardSkinCanvasDpr(gridSize);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const snow = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2.8 + 0.6,
      vy: Math.random() * 0.55 + 0.2, vx: Math.random() * 0.4 - 0.2,
      phase: Math.random() * Math.PI * 2,
    }));
    const snowflakes = Array.from({ length: 10 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * W * 0.035 + W * 0.012,
      rot: Math.random() * Math.PI,
      rotSpd: (Math.random() * 0.012 - 0.006),
      vy: Math.random() * 0.32 + 0.1, vx: Math.random() * 0.22 - 0.11,
    }));
    const iceShards = [
      { x: W * 0.15, y: H * 0.2, a: Math.PI / 6 },
      { x: W * 0.75, y: H * 0.35, a: -Math.PI / 4 },
      { x: W * 0.5, y: H * 0.08, a: Math.PI / 8 },
      { x: W * 0.9, y: H * 0.7, a: -Math.PI / 6 },
      { x: W * 0.05, y: H * 0.75, a: Math.PI / 3 },
    ];
    const auroraBands: Array<[number, number, string]> = [
      [W * 0.15, H * 0.05, "rgba(0,220,180,.09)"],
      [W * 0.65, H * 0.02, "rgba(0,120,255,.08)"],
      [W * 0.4,  H * 0.12, "rgba(60,0,200,.07)"],
    ];

    const draw = (now: number) => {
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.014 * dt;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, H);
      bg.addColorStop(0, "#000c1a"); bg.addColorStop(0.5, "#000610"); bg.addColorStop(1, "#000308");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Aurora bands
      auroraBands.forEach(([gx, gy, col], i) => {
        const sg = ctx.createRadialGradient(gx, gy + Math.sin(tc * 0.3 + i) * H * 0.04, 0, gx, gy, W * 0.58);
        sg.addColorStop(0, col); sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      });

      // Aurora sweep
      ctx.save();
      ctx.globalAlpha = 0.07 + 0.04 * Math.sin(tc * 0.5);
      const ag = ctx.createLinearGradient(0, H * 0.15, W, H * 0.25);
      ag.addColorStop(0, "transparent");
      ag.addColorStop(0.3, "rgba(0,200,160,.65)");
      ag.addColorStop(0.6, "rgba(60,120,255,.55)");
      ag.addColorStop(1, "transparent");
      ctx.fillStyle = ag; ctx.fillRect(0, H * 0.05, W, H * 0.25);
      ctx.restore();

      // Ice shards decoration
      iceShards.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a + Math.sin(tc * 0.2) * 0.08);
        ctx.strokeStyle = "rgba(180,240,255,.38)";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(180,240,255,.55)"; ctx.shadowBlur = 9;
        for (let j = 0; j < 3; j++) {
          const a = j * Math.PI / 3;
          const len = W * 0.065 + j * W * 0.016;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.moveTo(Math.cos(a + Math.PI) * len * 0.4, Math.sin(a + Math.PI) * len * 0.4);
          ctx.lineTo(Math.cos(a) * len * 0.62, Math.sin(a) * len * 0.62);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Drifting snowflakes
      snowflakes.forEach(sf => {
        sf.y += sf.vy * dt; sf.x += sf.vx * dt; sf.rot += sf.rotSpd * dt;
        if (sf.y > H + sf.size) sf.y = -sf.size;
        if (sf.x < -sf.size) sf.x = W + sf.size;
        if (sf.x > W + sf.size) sf.x = -sf.size;
        ctx.save(); ctx.translate(sf.x, sf.y); ctx.rotate(sf.rot);
        ctx.strokeStyle = "rgba(200,240,255,.65)"; ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(200,240,255,.5)"; ctx.shadowBlur = 9;
        for (let j = 0; j < 6; j++) {
          const a = j * 60 * Math.PI / 180;
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * sf.size, Math.sin(a) * sf.size);
          ctx.moveTo(
            Math.cos(a) * sf.size * 0.55 + Math.cos(a + Math.PI / 2) * sf.size * 0.19,
            Math.sin(a) * sf.size * 0.55 + Math.sin(a + Math.PI / 2) * sf.size * 0.19,
          );
          ctx.lineTo(Math.cos(a) * sf.size * 0.55, Math.sin(a) * sf.size * 0.55);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Snow particles
      snow.forEach(s => {
        s.y += s.vy * dt; s.x += (s.vx + Math.sin(tc + s.phase) * 0.28) * dt;
        if (s.y > H + 5) s.y = -5;
        if (s.x < -5) s.x = W + 5; if (s.x > W + 5) s.x = -5;
        ctx.save(); ctx.globalAlpha = 0.65;
        ctx.fillStyle = "rgba(220,240,255,.92)";
        ctx.shadowColor = "rgba(200,240,255,.55)"; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ── Grid Lines ──────────────────────────────────────────────────────────────
function GridLines({ W, H, PAD, CS, SIZE, isPaused = false }: { W: number; H: number; PAD: number; CS: number; SIZE: number; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) { if (raf.current) cancelAnimationFrame(raf.current); return; }
    const dpr = boardSkinCanvasDpr(SIZE);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const draw = (now: number) => {
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.014 * dt;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i <= SIZE; i++) {
        const x = PAD + i * CS;
        const y = PAD + i * CS;
        const icy = 0.6 + 0.4 * Math.sin(tc * 1.0 + i * 0.9);

        // Vertical lines — 4-pass glow
        ctx.save(); ctx.strokeStyle = "rgba(180,240,255,.07)"; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(160,230,255,${0.22 * icy})`; ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(180,240,255,.7)"; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(200,240,255,${0.74 * icy})`; ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(220,250,255,1)"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(240,252,255,${0.94 * icy})`; ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();

        // Horizontal lines — teal/cyan 4-pass glow
        ctx.save(); ctx.strokeStyle = "rgba(0,200,180,.07)"; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(0,190,170,${0.2 * icy})`; ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,220,200,.7)"; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(0,220,200,${0.72 * icy})`; ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(80,240,220,1)"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = `rgba(180,255,248,${0.92 * icy})`; ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
      }

      // Intersection sparkles
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS;
        const ny = PAD + r * CS;
        const sp = 0.5 + 0.5 * Math.abs(Math.sin(tc * 2 + (r * 6 + c) * 0.9));
        ctx.save(); ctx.translate(nx, ny); ctx.globalAlpha = sp * 0.9;
        ctx.strokeStyle = "rgba(220,250,255,.9)"; ctx.lineWidth = 1.3;
        ctx.shadowColor = "rgba(200,240,255,1)"; ctx.shadowBlur = 14 * sp;
        const sz = CS * 0.06 + sp * CS * 0.04;
        [0, 60, 120].forEach(a => {
          const rad = a * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(rad) * sz, -Math.sin(rad) * sz);
          ctx.lineTo(Math.cos(rad) * sz, Math.sin(rad) * sz);
          ctx.stroke();
        });
        ctx.fillStyle = `rgba(240,255,255,${0.92 * sp})`; ctx.shadowBlur = 12 * sp;
        ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, PAD, CS, SIZE, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

// ── Burst effect ────────────────────────────────────────────────────────────
type BurstFn = ((x: number, y: number, isP1: boolean) => void) | null;
function BurstCanvas({ burstRef, W, H, gridSize = 5 }: { burstRef: React.MutableRefObject<BurstFn>; W: number; H: number; gridSize?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);
  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [125, 211, 252] : [147, 197, 253];
    for (let i = 0; i < 4; i++)
      pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.04), alpha: 0.9 - i * 0.18, col: c1, decay: 0.028 + i * 0.008, w: 3 - i * 0.4 });
    for (let i = 0; i < 16; i++) {
      const a = Math.PI * 2 * Math.random(); const spd = 2.4 + Math.random() * 4.2;
      pts.current.push({ type: "shard", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, len: Math.random() * 15 + 7, angle: Math.random() * 360, alpha: 1, col: [224, 242, 254], decay: 0.024 + Math.random() * 0.02 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * i / 8 + (Math.random() - 0.5) * 0.3;
      pts.current.push({ type: "frostRay", x, y, a, len: 0, maxLen: W * (0.07 + Math.random() * 0.06), alpha: 0.82, col: c1, decay: 0.034 });
    }
    if (!raf.current) loop();
  };
  const loop = () => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null; if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    pts.current = pts.current.filter(p => p.alpha > 0.01);
    for (const p of pts.current) {
      if (p.type === "ring") {
        p.r += (p.maxR - p.r) * 0.16; p.alpha -= p.decay;
        ctx.save(); ctx.strokeStyle = `rgba(${p.col},${p.alpha})`; ctx.lineWidth = (p.w || 2) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.7)`; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else if (p.type === "shard") {
        p.x += p.vx; p.y += p.vy; p.vx *= 0.91; p.vy *= 0.91; p.alpha -= p.decay; p.angle += 3;
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180);
        ctx.strokeStyle = `rgb(${p.col})`; ctx.lineWidth = 1.8;
        ctx.shadowColor = `rgba(${p.col},.8)`; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(-p.len / 2, 0); ctx.lineTo(p.len / 2, 0);
        ctx.moveTo(0, -p.len * 0.3); ctx.lineTo(0, p.len * 0.3); ctx.stroke(); ctx.restore();
      } else if (p.type === "frostRay") {
        p.len += (p.maxLen - p.len) * 0.2; p.alpha -= p.decay;
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.strokeStyle = `rgb(${p.col})`; ctx.lineWidth = 1.3;
        ctx.shadowColor = `rgba(${p.col},.9)`; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len);
        const bx = p.x + Math.cos(p.a) * p.len * 0.6, by = p.y + Math.sin(p.a) * p.len * 0.6;
        ctx.moveTo(bx + Math.cos(p.a + Math.PI / 3) * p.len * 0.18, by + Math.sin(p.a + Math.PI / 3) * p.len * 0.18);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + Math.cos(p.a - Math.PI / 3) * p.len * 0.18, by + Math.sin(p.a - Math.PI / 3) * p.len * 0.18);
        ctx.stroke(); ctx.restore();
      }
    }
    if (pts.current.length > 0) raf.current = requestAnimationFrame(loop); else raf.current = null;
  };
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = boardSkinCanvasDpr(gridSize);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null; if (!ctx) return;
    ctx.scale(dpr, dpr);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

// ── P1 Piece: Crystal Snowflake ─────────────────────────────────────────────
// 6-arm ice crystal with barbs and glowing center — clearly visible on dark bg
function Snowflake({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.62;
  const glow = win
    ? "drop-shadow(0 0 8px #7dd3fc) drop-shadow(0 0 22px #38bdf8) drop-shadow(0 0 44px rgba(56,189,248,.7))"
    : "drop-shadow(0 0 5px #7dd3fc) drop-shadow(0 0 14px rgba(125,211,252,.75))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 56 56"
      style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 6, filter: glow, animation: "sfIn .5s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes sfIn{0%{transform:translate(-50%,-50%) scale(0) rotate(-90deg);opacity:0}60%{transform:translate(-50%,-50%) scale(1.18) rotate(12deg);opacity:1}80%{transform:translate(-50%,-50%) scale(.93) rotate(-4deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}`}</style>
      <g transform="translate(28,28)">
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg})`}>
            {/* Main arm */}
            <line x1="0" y1="-22" x2="0" y2="22" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />
            {/* Upper barbs */}
            <line x1="-5.5" y1="-13" x2="0" y2="-13" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="5.5"  y1="-13" x2="0" y2="-13" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
            {/* Mid barbs */}
            <line x1="-3.5" y1="-7" x2="0" y2="-7" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="3.5"  y1="-7" x2="0" y2="-7" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" />
            {/* Tip diamond */}
            <polygon points="0,-22 -2,-18 0,-25 2,-18" fill="#e0f2fe" opacity=".85" />
            {/* Animate in staggered */}
            <animate attributeName="opacity" from="0" to="1" dur=".06s" begin={`${.04 * i}s`} fill="freeze" />
          </g>
        ))}
        {/* Inner hex ring */}
        <polygon points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
          fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity=".7" />
        {/* Glowing center */}
        <circle cx="0" cy="0" r="3.5" fill="#e0f2fe">
          <animate attributeName="r" values="3;4.2;3" dur="2.2s" begin=".4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.6;1" dur="2.2s" begin=".4s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="0" r="5.5" fill="none" stroke="#bae6fd" strokeWidth=".8" opacity=".5">
          <animate attributeName="r" values="4;6;4" dur="2.2s" begin=".4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".5;0;.5" dur="2.2s" begin=".4s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

// ── P2 Piece: Ice Crystal Shard ─────────────────────────────────────────────
// Tall central shard with flanking shards and glowing facets
function IceShard({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.62;
  const glow = win
    ? "drop-shadow(0 0 9px #bfdbfe) drop-shadow(0 0 22px #93c5fd) drop-shadow(0 0 44px rgba(147,197,253,.7))"
    : "drop-shadow(0 0 5px #93c5fd) drop-shadow(0 0 16px rgba(147,197,253,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 56 56"
      style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 6, filter: glow, animation: "isIn .45s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes isIn{0%{transform:translate(-50%,-50%) scale(0) rotate(25deg);opacity:0}58%{transform:translate(-50%,-50%) scale(1.16) rotate(-4deg);opacity:1}80%{transform:translate(-50%,-50%) scale(.94) rotate(2deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}`}</style>
      {/* Central tall shard */}
      <path d="M28,5 L33,24 L28,51 L23,24 Z" fill="none" stroke="#93c5fd" strokeWidth="2.4" strokeLinejoin="round"
        strokeDasharray="80" strokeDashoffset="80">
        <animate attributeName="stroke-dashoffset" from="80" to="0" dur=".22s" fill="freeze" />
      </path>
      <path d="M28,5 L33,24 L28,51 L23,24 Z" fill="#93c5fd" opacity="0">
        <animate attributeName="opacity" from="0" to=".14" dur=".07s" begin=".2s" fill="freeze" />
      </path>
      {/* Highlight facet */}
      <line x1="28" y1="5" x2="31" y2="22" stroke="rgba(255,255,255,.55)" strokeWidth=".9" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".06s" begin=".24s" fill="freeze" />
      </line>
      {/* Left shard */}
      <path d="M12,14 L18,26 L16,42 L11,27 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.8" strokeLinejoin="round"
        strokeDasharray="55" strokeDashoffset="55">
        <animate attributeName="stroke-dashoffset" from="55" to="0" dur=".18s" begin=".14s" fill="freeze" />
      </path>
      <path d="M12,14 L18,26 L16,42 L11,27 Z" fill="#bfdbfe" opacity="0">
        <animate attributeName="opacity" from="0" to=".1" dur=".06s" begin=".3s" fill="freeze" />
      </path>
      {/* Right shard */}
      <path d="M44,14 L38,26 L40,42 L45,27 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.8" strokeLinejoin="round"
        strokeDasharray="55" strokeDashoffset="55">
        <animate attributeName="stroke-dashoffset" from="55" to="0" dur=".18s" begin=".14s" fill="freeze" />
      </path>
      <path d="M44,14 L38,26 L40,42 L45,27 Z" fill="#bfdbfe" opacity="0">
        <animate attributeName="opacity" from="0" to=".1" dur=".06s" begin=".3s" fill="freeze" />
      </path>
      {/* Crown tip glow */}
      <circle cx="28" cy="5" r="2.8" fill="#e0f2fe" opacity="0">
        <animate attributeName="opacity" values="0;1;.4;1;0" dur="2s" begin=".3s" repeatCount="indefinite" />
        <animate attributeName="r" values="2;3.8;2" dur="2s" begin=".3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Cell ────────────────────────────────────────────────────────────────────
function GlacierCell({ CS, value, onClick, isWinCell, justPlaced, isP1, isP2 }: {
  CS: number; value: string | null; onClick: () => void;
  isWinCell: boolean; justPlaced: boolean; isP1: boolean; isP2: boolean;
}) {
  const [hov, setHov] = useState(false);
  const wC = isP1 ? "rgba(125,211,252,.42)" : "rgba(147,197,253,.42)";
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        width: CS, height: CS, position: "relative", cursor: "pointer",
        overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: isWinCell
          ? "radial-gradient(ellipse,rgba(125,211,252,.28),transparent 70%)"
          : hov && !value
          ? "radial-gradient(ellipse,rgba(80,140,200,.2),transparent 70%)"
          : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s", contain: "layout style",
      }}>
      {justPlaced && (
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse,rgba(200,235,255,.78),transparent 70%)", animation: "icF .6s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />
      )}
      {isP1 && <Snowflake size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <IceShard  size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes icF{0%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.5)}100%{opacity:0;transform:scale(2.2)}}`}</style>
    </div>
  );
}
const MemoizedGlacierCell = React.memo(GlacierCell);

// ── Main export ─────────────────────────────────────────────────────────────
export default React.memo(function GlacierGrid({
  board, onCellClickAction, winCells = [], showLabels = true, isPaused = false, graphicsQuality = "quality",
}: {
  board?: (string | null)[][];
  onCellClickAction?: (r: number, c: number) => void;
  winCells?: [number, number][];
  showLabels?: boolean;
  isPaused?: boolean;
  graphicsQuality?: "performance" | "quality";
}) {
  const active = board ?? Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(null));
  const SIZE = active.length;
  const COLS = GET_COLS(SIZE);
  const ROWS = GET_ROWS(SIZE);
  const PAD = 8;
  const CS = useCellSize(SIZE, PAD);
  const BS = SIZE * CS + 2 * PAD;
  const [demo, setDemo] = useState<(string | null)[][]>(() => Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)));
  const [turn, setTurn] = useState("X");
  const [last, setLast] = useState<string | null>(null);
  const winSet = new Set(winCells.map(([r, c]) => `${r}-${c}`));
  const burstRef = useRef<BurstFn>(null);
  const lowFx = graphicsQuality === "performance";

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    if (!lowFx) {
      burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
      setLast(`${r}-${c}`);
      setTimeout(() => setLast(null), 700);
    }
    if (onCellClickAction) { onCellClickAction(r, c); return; }
    const n = demo.map(row => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn(t => t === "X" ? "O" : "X");
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(160,230,255,.92)", fontSize: fs(0.13),
    fontFamily: "'Trebuchet MS',Arial,sans-serif", fontWeight: "600",
    letterSpacing: ".14em", textShadow: "0 0 12px rgba(140,220,255,.8),0 0 24px rgba(100,200,255,.45)",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {showLabels && (
        <div style={{ display: "flex", paddingLeft: PAD + CS * 0.3 }}>
          {COLS.map(c => <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>{c}</div>)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {showLabels && (
          <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>
            {ROWS.map(r => <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>{r}</div>)}
          </div>
        )}
        <div style={{
          position: "relative", width: BS, height: BS,
          borderRadius: CS * 0.08, overflow: "hidden",
          border: "2px solid rgba(120,200,255,.68)",
          boxShadow: "0 0 0 1px rgba(80,160,220,.32),0 0 48px rgba(100,180,255,.42),0 0 110px rgba(50,100,200,.28),inset 0 0 80px rgba(0,0,15,.6)",
          willChange: "transform", contain: "layout size style",
        }}>
          {lowFx
            ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(5,18,34,.98),rgba(6,28,48,.98))" }} />
            : <GlacierBg W={BS} H={BS} gridSize={SIZE} isPaused={isPaused} />}
          {!lowFx && <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} isPaused={isPaused} />}
          {!lowFx && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {active.map((row, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {row.map((cell, c) => (
                  <MemoizedGlacierCell
                    key={`${r}-${c}`} CS={CS} value={cell}
                    onClick={() => click(r, c)}
                    isWinCell={winSet.has(`${r}-${c}`)}
                    justPlaced={!lowFx && last === `${r}-${c}`}
                    isP1={cell === "X"} isP2={cell === "O"}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
