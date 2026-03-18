"use client";
import React, { useState, useEffect, useRef } from "react";

const SIZE = 5;
const COLS = ["A", "B", "C", "D", "E"];
const ROWS = [1, 2, 3, 4, 5];

function useCellSize(pad = 8) {
  const [cs, setCs] = useState(110);
  useEffect(() => {
    const c = () => {
      const b = Math.min(Math.max(window.innerWidth - 560, 260), Math.max(window.innerHeight - 200, 260));
      setCs(Math.max(50, (b - 2 * pad) / 5));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad]);
  return cs;
}

function GlacierBg({ W, H }: { W: number; H: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const snow = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.5 + 0.5, vy: Math.random() * 0.5 + 0.25, vx: Math.random() * 0.4 - 0.2, phase: Math.random() * Math.PI * 2 }));
    const snowflakes = Array.from({ length: 8 }, () => ({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * W * 0.03 + W * 0.01, rot: Math.random() * Math.PI, rotSpd: Math.random() * 0.01 - 0.005, vy: Math.random() * 0.3 + 0.1, vx: Math.random() * 0.2 - 0.1 }));
    const iceShards = [{ x: W * 0.15, y: H * 0.2, a: Math.PI / 6 }, { x: W * 0.75, y: H * 0.35, a: -Math.PI / 4 }, { x: W * 0.5, y: H * 0.08, a: Math.PI / 8 }, { x: W * 0.9, y: H * 0.7, a: -Math.PI / 6 }, { x: W * 0.05, y: H * 0.75, a: Math.PI / 3 }];
    const auroraBands: Array<[number, number, string]> = [[W * 0.15, H * 0.05, "rgba(0,220,180,.08)"], [W * 0.65, H * 0.02, "rgba(0,120,255,.07)"], [W * 0.4, H * 0.12, "rgba(60,0,200,.06)"]];

    const draw = () => {
      t.current += 0.014;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, H);
      bg.addColorStop(0, "#000b18");
      bg.addColorStop(0.5, "#000610");
      bg.addColorStop(1, "#000308");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      auroraBands.forEach(([gx, gy, col], i) => {
        const sg = ctx.createRadialGradient(gx, gy + Math.sin(tc * 0.3 + i) * H * 0.04, 0, gx, gy, W * 0.55);
        sg.addColorStop(0, col);
        sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, W, H);
      });

      ctx.save();
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(tc * 0.5);
      const ag = ctx.createLinearGradient(0, H * 0.15, W, H * 0.25);
      ag.addColorStop(0, "transparent");
      ag.addColorStop(0.3, "rgba(0,200,160,.6)");
      ag.addColorStop(0.6, "rgba(60,120,255,.5)");
      ag.addColorStop(1, "transparent");
      ctx.fillStyle = ag;
      ctx.fillRect(0, H * 0.05, W, H * 0.25);
      ctx.restore();

      iceShards.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a + Math.sin(tc * 0.2) * 0.08);
        ctx.strokeStyle = "rgba(180,240,255,.35)";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(180,240,255,.5)";
        ctx.shadowBlur = 8;
        for (let j = 0; j < 3; j++) {
          const a = j * Math.PI / 3;
          const len = W * 0.06 + j * W * 0.015;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.moveTo(Math.cos(a + Math.PI) * len * 0.4, Math.sin(a + Math.PI) * len * 0.4);
          ctx.lineTo(Math.cos(a) * len * 0.6, Math.sin(a) * len * 0.6);
          ctx.stroke();
        }
        ctx.restore();
      });

      snowflakes.forEach(sf => {
        sf.y += sf.vy;
        sf.x += sf.vx;
        sf.rot += sf.rotSpd;
        if (sf.y > H + sf.size) sf.y = -sf.size;
        if (sf.x < -sf.size) sf.x = W + sf.size;
        if (sf.x > W + sf.size) sf.x = -sf.size;
        ctx.save();
        ctx.translate(sf.x, sf.y);
        ctx.rotate(sf.rot);
        ctx.strokeStyle = "rgba(200,240,255,.6)";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(200,240,255,.5)";
        ctx.shadowBlur = 8;
        for (let j = 0; j < 6; j++) {
          const a = j * 60 * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * sf.size, Math.sin(a) * sf.size);
          ctx.moveTo(Math.cos(a) * sf.size * 0.55 + Math.cos(a + Math.PI / 2) * sf.size * 0.18, Math.sin(a) * sf.size * 0.55 + Math.sin(a + Math.PI / 2) * sf.size * 0.18);
          ctx.lineTo(Math.cos(a) * sf.size * 0.55, Math.sin(a) * sf.size * 0.55);
          ctx.stroke();
        }
        ctx.restore();
      });

      snow.forEach(s => {
        s.y += s.vy;
        s.x += s.vx + Math.sin(tc + s.phase) * 0.25;
        if (s.y > H + 5) s.y = -5;
        if (s.x < -5) s.x = W + 5;
        if (s.x > W + 5) s.x = -5;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "rgba(220,240,255,.9)";
        ctx.shadowColor = "rgba(200,240,255,.5)";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

function GridLines({ W, H, PAD, CS }: { W: number; H: number; PAD: number; CS: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const draw = () => {
      t.current += 0.014;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= 5; i++) {
        const x = PAD + i * CS;
        const y = PAD + i * CS;
        const icy = 0.6 + 0.4 * Math.sin(tc * 1.0 + i * 0.9);
        ctx.save();
        ctx.strokeStyle = "rgba(180,240,255,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(160,230,255,${0.2 * icy})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(180,240,255,.7)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(200,240,255,${0.72 * icy})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(220,250,255,1)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(240,250,255,${0.92 * icy})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(0,200,180,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(0,190,170,${0.18 * icy})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,220,200,.7)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(0,220,200,${0.7 * icy})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(80,240,220,1)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(180,255,248,${0.9 * icy})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
        const nx = PAD + c * CS;
        const ny = PAD + r * CS;
        const sp = 0.5 + 0.5 * Math.abs(Math.sin(tc * 2 + (r * 6 + c) * 0.9));
        ctx.save();
        ctx.translate(nx, ny);
        ctx.globalAlpha = sp * 0.9;
        ctx.strokeStyle = "rgba(220,250,255,.9)";
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(200,240,255,1)";
        ctx.shadowBlur = 14 * sp;
        const sz = CS * 0.06 + sp * CS * 0.04;
        [0, 60, 120].forEach(a => {
          const rad = a * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(rad) * sz, -Math.sin(rad) * sz);
          ctx.lineTo(Math.cos(rad) * sz, Math.sin(rad) * sz);
          ctx.stroke();
        });
        ctx.fillStyle = `rgba(240,255,255,${0.9 * sp})`;
        ctx.shadowBlur = 12 * sp;
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, PAD, CS]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

type BurstFn = ((x: number, y: number, isP1: boolean) => void) | null;
function BurstCanvas({ burstRef, W, H }: { burstRef: React.MutableRefObject<BurstFn>; W: number; H: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);
  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [125, 211, 252] : [147, 197, 253];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.04), alpha: 0.9 - i * 0.18, col: c1, decay: 0.028 + i * 0.008, w: 3 - i * 0.4 });
    for (let i = 0; i < 14; i++) { const a = Math.PI * 2 * Math.random(); const s = 2.2 + Math.random() * 4; pts.current.push({ type: "shard", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, len: Math.random() * 14 + 6, angle: Math.random() * 360, alpha: 1, col: [224, 242, 254], decay: 0.025 + Math.random() * 0.02 }); }
    for (let i = 0; i < 8; i++) { const a = Math.PI * 2 * i / 8 + (Math.random() - 0.5) * 0.3; pts.current.push({ type: "frostRay", x, y, a, len: 0, maxLen: W * (0.07 + Math.random() * 0.05), alpha: 0.8, col: c1, decay: 0.035 }); }
    if (!raf.current) loop();
  };
  const loop = () => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    pts.current = pts.current.filter(p => p.alpha > 0.01);
    for (const p of pts.current) {
      if (p.type === "ring") { p.r += (p.maxR - p.r) * 0.16; p.alpha -= p.decay; ctx.save(); ctx.strokeStyle = `rgba(${p.col},${p.alpha})`; ctx.lineWidth = (p.w || 2) * p.alpha; ctx.shadowColor = `rgba(${p.col},.7)`; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      else if (p.type === "shard") { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.alpha -= p.decay; p.angle += 3; ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180); ctx.strokeStyle = `rgb(${p.col})`; ctx.lineWidth = 1.8; ctx.shadowColor = `rgba(${p.col},.8)`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(-p.len / 2, 0); ctx.lineTo(p.len / 2, 0); ctx.moveTo(0, -p.len * 0.3); ctx.lineTo(0, p.len * 0.3); ctx.stroke(); ctx.restore(); }
      else if (p.type === "frostRay") { p.len += (p.maxLen - p.len) * 0.2; p.alpha -= p.decay; ctx.save(); ctx.globalAlpha = p.alpha; ctx.strokeStyle = `rgb(${p.col})`; ctx.lineWidth = 1.2; ctx.shadowColor = `rgba(${p.col},.9)`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len); const bx = p.x + Math.cos(p.a) * p.len * 0.6, by = p.y + Math.sin(p.a) * p.len * 0.6; ctx.moveTo(bx + Math.cos(p.a + Math.PI / 3) * p.len * 0.18, by + Math.sin(p.a + Math.PI / 3) * p.len * 0.18); ctx.lineTo(bx, by); ctx.lineTo(bx + Math.cos(p.a - Math.PI / 3) * p.len * 0.18, by + Math.sin(p.a - Math.PI / 3) * p.len * 0.18); ctx.stroke(); ctx.restore(); }
    }
    if (pts.current.length > 0) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  };
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function Snowflake({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win ? "drop-shadow(0 0 10px #7dd3fc) drop-shadow(0 0 28px #7dd3fc) drop-shadow(0 0 55px rgba(125,211,252,.6))" : "drop-shadow(0 0 6px #7dd3fc) drop-shadow(0 0 18px rgba(125,211,252,.7))";
  const arms = [0, 60, 120, 180, 240, 300];
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "sfIn .55s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes sfIn{0%{transform:scale(0) rotate(-120deg);opacity:0}60%{transform:scale(1.22) rotate(15deg);opacity:1}80%{transform:scale(.9) rotate(-5deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <g transform="translate(24,24)">
        {arms.map((a, i) => (<g key={a} transform={`rotate(${a})`} opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".05s" begin={`.04*${i}s`} fill="freeze" /><line x1="0" y1="-19" x2="0" y2="19" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" /><line x1="-4.5" y1="-11" x2="0" y2="-11" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" /><line x1="4.5" y1="-11" x2="0" y2="-11" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" /><line x1="-3" y1="-6" x2="0" y2="-6" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" /><line x1="3" y1="-6" x2="0" y2="-6" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" /><polygon points="0,-19 -2,-15 0,-21 2,-15" fill="#e0f2fe" opacity=".7" /></g>))}
        <circle cx="0" cy="0" r="2.5" fill="#e0f2fe" opacity="0"><animate attributeName="opacity" values="0;1;.5;1;.8" dur=".4s" begin=".28s" fill="freeze" /><animate attributeName="r" values="2;3.5;2" dur="2.5s" begin=".5s" repeatCount="indefinite" /></circle>
      </g>
    </svg>
  );
}

function IceShard({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win ? "drop-shadow(0 0 10px #bfdbfe) drop-shadow(0 0 26px #93c5fd) drop-shadow(0 0 55px rgba(147,197,253,.6))" : "drop-shadow(0 0 6px #93c5fd) drop-shadow(0 0 18px rgba(147,197,253,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "isIn .45s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes isIn{0%{transform:scale(0) rotate(30deg);opacity:0}58%{transform:scale(1.18) rotate(-5deg);opacity:1}80%{transform:scale(.93) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <path d="M24,4 L28,20 L24,44 L20,20 Z" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="68" strokeDashoffset="68"><animate attributeName="stroke-dashoffset" from="68" to="0" dur=".2s" fill="freeze" /></path>
      <path d="M24,4 L28,20 L24,44 L20,20 Z" fill="#93c5fd" opacity="0"><animate attributeName="opacity" from="0" to=".12" dur=".07s" begin=".18s" fill="freeze" /></path>
      <path d="M8,10 L16,22 L14,38 L8,24 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="50" strokeDashoffset="50"><animate attributeName="stroke-dashoffset" from="50" to="0" dur=".16s" begin=".16s" fill="freeze" /></path>
      <path d="M40,10 L32,22 L34,38 L40,24 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="50" strokeDashoffset="50"><animate attributeName="stroke-dashoffset" from="50" to="0" dur=".16s" begin=".16s" fill="freeze" /></path>
      <line x1="24" y1="4" x2="28" y2="20" stroke="white" strokeWidth=".7" opacity="0"><animate attributeName="opacity" from="0" to=".5" dur=".06s" begin=".22s" fill="freeze" /></line>
      <circle cx="24" cy="4" r="2.5" fill="#e0f2fe" opacity="0"><animate attributeName="opacity" values="0;1;.4;1;0" dur="2.2s" begin=".28s" repeatCount="indefinite" /></circle>
    </svg>
  );
}

function Cell({ CS, value, onClick, isWinCell, justPlaced }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean }) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X";
  const isP2 = value === "O";
  const wC = isP1 ? "rgba(125,211,252,.4)" : "rgba(147,197,253,.4)";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick} style={{ width: CS, height: CS, position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isWinCell ? "radial-gradient(ellipse,rgba(125,211,252,.25),transparent 70%)" : hov && !value ? "radial-gradient(ellipse,rgba(80,140,200,.18),transparent 70%)" : "transparent", boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none", transition: "background .2s" }}>
      {justPlaced && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse,rgba(200,235,255,.75),transparent 70%)", animation: "icF .6s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />}
      {isP1 && <Snowflake size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <IceShard size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes icF{0%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.5)}100%{opacity:0;transform:scale(2.2)}}`}</style>
    </div>
  );
}

export default function GlacierGrid({ board, onCellClick, winCells = [] }: { board?: (string | null)[][]; onCellClick?: (r: number, c: number) => void; winCells?: [number, number][] }) {
  const PAD = 8;
  const CS = useCellSize(PAD);
  const [demo, setDemo] = useState<(string | null)[][]>(() => Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)));
  const [turn, setTurn] = useState("X");
  const [last, setLast] = useState<string | null>(null);
  const active = board ?? demo;
  const winSet = new Set(winCells.map(([r, c]) => `${r}-${c}`));
  const burstRef = useRef<BurstFn>(null);
  const BS = 5 * CS + 2 * PAD;

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    if (burstRef.current) burstRef.current(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
    setLast(`${r}-${c}`);
    setTimeout(() => setLast(null), 700);
    if (onCellClick) { onCellClick(r, c); return; }
    const n = demo.map(row => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn(t => t === "X" ? "O" : "X");
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = { color: "rgba(160,230,255,.9)", fontSize: fs(0.13), fontFamily: "'Trebuchet MS',Arial,sans-serif", fontWeight: "600", letterSpacing: ".14em", textShadow: "0 0 12px rgba(140,220,255,.8),0 0 24px rgba(100,200,255,.45)" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", paddingLeft: PAD + CS * 0.3 }}>{COLS.map(c => <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>{c}</div>)}</div>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>{ROWS.map(r => <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>{r}</div>)}</div>
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.08, overflow: "hidden", border: "2px solid rgba(120,200,255,.65)", boxShadow: "0 0 0 1px rgba(80,160,220,.3),0 0 45px rgba(100,180,255,.4),0 0 100px rgba(50,100,200,.25),inset 0 0 80px rgba(0,0,15,.55)" }}>
          <GlacierBg W={BS} H={BS} />
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} />
          <BurstCanvas burstRef={burstRef} W={BS} H={BS} />
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => (<Cell key={`${r}-${c}`} CS={CS} value={active[r][c]} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={last === `${r}-${c}`} />))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

