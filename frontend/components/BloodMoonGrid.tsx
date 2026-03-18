"use client";
import React, { useEffect, useRef, useState } from "react";

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

function BloodMoonBg({ W, H }: { W: number; H: number }) {
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drips = Array.from({ length: 12 }, (_, i) => ({
      x: W * ((i + 0.5) / 12) + Math.random() * W * 0.05 - W * 0.025,
      y: 0,
      len: 0,
      maxLen: H * (0.1 + Math.random() * 0.3),
      w: Math.random() * 2.5 + 1.2,
      spd: 0.5 + Math.random() * 0.5,
      trail: [] as { y: number; a: number }[],
    }));
    const scratches = Array.from({ length: 16 }, () => ({
      x1: Math.random() * W,
      y1: Math.random() * H,
      x2: Math.random() * W,
      y2: Math.random() * H,
      alpha: Math.random() * 0.1 + 0.03,
    }));
    const moon = { cx: W * 0.72, cy: H * 0.18, r: W * 0.1 };

    const draw = () => {
      t.current += 0.014;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.8);
      bg.addColorStop(0, "#080000");
      bg.addColorStop(0.5, "#050000");
      bg.addColorStop(1, "#020000");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const pulse = 0.6 + 0.4 * Math.sin(tc * 0.7);
      for (let ring = 6; ring >= 1; ring--) {
        const rr = moon.r * (ring * 0.45) * pulse;
        const mg = ctx.createRadialGradient(moon.cx, moon.cy, 0, moon.cx, moon.cy, rr);
        mg.addColorStop(0, `rgba(180,20,0,${0.15 * ring * pulse})`);
        mg.addColorStop(0.6, `rgba(100,0,0,${0.05 * ring * pulse})`);
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(moon.cx, moon.cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.fillStyle = `rgba(200,40,0,${0.85 * pulse})`;
      ctx.shadowColor = "rgba(200,20,0,1)";
      ctx.shadowBlur = 30 * pulse;
      ctx.beginPath();
      ctx.arc(moon.cx, moon.cy, moon.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.beginPath();
      ctx.arc(moon.cx - moon.r * 0.2, moon.cy - moon.r * 0.15, moon.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const eg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.6);
      eg.addColorStop(0, `rgba(100,0,0,${0.12 + 0.04 * Math.sin(tc * 0.6)})`);
      eg.addColorStop(1, "transparent");
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, W, H);

      scratches.forEach((s) => {
        ctx.save();
        ctx.strokeStyle = `rgba(180,100,80,${s.alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.restore();
      });

      drips.forEach((d) => {
        if (d.len < d.maxLen) d.len += d.spd;
        d.trail.push({ y: d.len, a: 0.9 });
        d.trail = d.trail.slice(-8);
        ctx.save();
        ctx.strokeStyle = "rgba(160,0,0,.75)";
        ctx.lineWidth = d.w;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(180,0,0,.6)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(d.x, 0);
        ctx.lineTo(d.x, d.len);
        ctx.stroke();
        ctx.fillStyle = "rgba(180,0,0,.85)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.len, d.w * 0.8, d.w * 1.5, 0, 0, Math.PI * 2);
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      t.current += 0.014;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i <= 5; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(tc * 2.4 + i * 1.5 + Math.sin(tc * 7 + i) * 0.25));

        ctx.save();
        ctx.strokeStyle = "rgba(180,0,0,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(180,0,0,${0.18 * flicker})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(200,0,0,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(220,0,0,${0.74 * flicker})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(220,0,0,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,180,180,${0.85 * flicker})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,100,100,.8)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(120,0,120,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(140,0,140,${0.16 * flicker})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(160,0,160,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(180,0,180,${0.7 * flicker})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(200,0,200,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(240,180,240,${0.85 * flicker})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,150,255,.8)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const gp = 0.35 + 0.65 * Math.abs(Math.sin(tc * 1.6 + (r * 5 + c) * 0.65));
        ctx.save();
        ctx.globalAlpha = gp;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, CS * 0.1);
        ng.addColorStop(0, "rgba(220,0,0,.95)");
        ng.addColorStop(0.4, "rgba(150,0,0,.5)");
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.shadowColor = "rgba(200,0,0,1)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
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

function BurstCanvas({ burstRef, W, H }: { burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>; W: number; H: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);

  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [180, 0, 0] : [120, 0, 180];
    pts.current.push({ type: "ring", x, y, r: 0, maxR: W * 0.14, alpha: 0.8, col: c1, decay: 0.028, w: 3 });
    pts.current.push({ type: "ring", x, y, r: 0, maxR: W * 0.08, alpha: 0.5, col: [80, 0, 0], decay: 0.04, w: 1.5 });
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * 2 * Math.random(), s = 1.5 + Math.random() * 4;
      pts.current.push({ type: "drip", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, len: Math.random() * 7 + 2, alpha: 1, col: c1, decay: 0.025 + Math.random() * 0.02, trail: [] });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * Math.random(), s = 0.6 + Math.random() * 1.4;
      pts.current.push({ type: "mist", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.3, r: Math.random() * 9 + 5, alpha: 0.5, col: c1, decay: 0.018 + Math.random() * 0.015 });
    }
    if (!raf.current) loop();
  };

  const loop = () => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    pts.current = pts.current.filter((p) => p.alpha > 0.01);
    for (const p of pts.current) {
      if (p.type === "ring") {
        p.r += (p.maxR - p.r) * 0.15;
        p.alpha -= p.decay;
        ctx.save();
        ctx.strokeStyle = `rgba(${p.col},${p.alpha})`;
        ctx.lineWidth = (p.w || 2) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.7)`;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "drip") {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.9; p.vy *= 0.9; p.vy += 0.1;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = `rgb(${p.col})`;
        ctx.lineWidth = p.len * 0.35;
        ctx.lineCap = "round";
        ctx.shadowColor = `rgba(${p.col},.8)`;
        ctx.shadowBlur = 8;
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          p.trail.forEach((pt: any) => ctx.lineTo(pt.x, pt.y));
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.len * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === "mist") {
        p.x += p.vx; p.y += p.vy;
        p.r += 0.4;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.4;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.shadowColor = `rgba(${p.col},.5)`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function Pentagram({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #dc2626) drop-shadow(0 0 26px #dc2626) drop-shadow(0 0 55px rgba(220,38,38,.6))"
    : "drop-shadow(0 0 6px #dc2626) drop-shadow(0 0 16px rgba(220,38,38,.7))";
  const R = 20, cx2 = 24, cy2 = 24;
  const star = Array.from({ length: 5 }, (_, i) => {
    const a = i * 72 - 90;
    return `${cx2 + R * Math.cos(a * Math.PI / 180)},${cy2 + R * Math.sin(a * Math.PI / 180)}`;
  }).join(" ");
  const circ = 2 * Math.PI * R;

  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "penIn .5s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes penIn{0%{transform:scale(0) rotate(180deg);opacity:0}55%{transform:scale(1.22) rotate(-10deg);opacity:1}80%{transform:scale(.91) rotate(4deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <circle cx={cx2} cy={cy2} r={R} fill="none" stroke="#dc2626" strokeWidth="1.2" strokeDasharray={circ} strokeDashoffset={circ as any}>
        <animate attributeName="stroke-dashoffset" from={circ as any} to="0" dur=".28s" fill="freeze" />
      </circle>
      <circle cx={cx2} cy={cy2} r="9" fill="none" stroke="#dc2626" strokeWidth=".8" opacity="0">
        <animate attributeName="opacity" from="0" to=".5" dur=".06s" begin=".26s" fill="freeze" />
      </circle>
      <polygon points={star} fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinejoin="round" strokeDasharray="120" strokeDashoffset="120">
        <animate attributeName="stroke-dashoffset" from="120" to="0" dur=".32s" begin=".06s" fill="freeze" />
      </polygon>
      <polygon points={star} fill="#dc2626" opacity="0">
        <animate attributeName="opacity" from="0" to=".09" dur=".07s" begin=".38s" fill="freeze" />
      </polygon>
      <circle cx={cx2} cy={cy2} r="2.5" fill="#ff4444" opacity="0">
        <animate attributeName="opacity" values="0;.8;.2;.8;0" dur="2s" begin=".42s" repeatCount="indefinite" />
        <animate attributeName="r" values="2;4;2" dur="2s" begin=".42s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function EvilEye({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #7c3aed) drop-shadow(0 0 24px #7c3aed) drop-shadow(0 0 50px rgba(124,58,237,.6))"
    : "drop-shadow(0 0 6px #7c3aed) drop-shadow(0 0 16px rgba(124,58,237,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "eyeIn .5s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes eyeIn{0%{transform:scaleY(0) scale(.5);opacity:0}50%{transform:scaleY(1.2) scale(1.1);opacity:1}75%{transform:scaleY(.9) scale(.95)}100%{transform:scaleY(1) scale(1);opacity:1}}`}</style>
      <path d="M6,24 Q24,6 42,24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="48" strokeDashoffset="48">
        <animate attributeName="stroke-dashoffset" from="48" to="0" dur=".18s" fill="freeze" />
      </path>
      <path d="M6,24 Q24,42 42,24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="48" strokeDashoffset="48">
        <animate attributeName="stroke-dashoffset" from="48" to="0" dur=".18s" begin=".14s" fill="freeze" />
      </path>
      <circle cx="24" cy="24" r="9" fill="none" stroke="#9f67ff" strokeWidth="1.8" strokeDasharray="56" strokeDashoffset="56">
        <animate attributeName="stroke-dashoffset" from="56" to="0" dur=".16s" begin=".16s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="9" fill="#7c3aed" opacity="0">
        <animate attributeName="opacity" from="0" to=".17" dur=".07s" begin=".3s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="4.5" fill="#110020" stroke="#9f67ff" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".06s" begin=".32s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="2" fill="#cc44ff" opacity="0">
        <animate attributeName="opacity" values="0;.9;.2;.9;0" dur="1.6s" begin=".38s" repeatCount="indefinite" />
        <animate attributeName="r" values="1.5;3;1.5" dur="1.6s" begin=".38s" repeatCount="indefinite" />
      </circle>
      <circle cx="27" cy="20" r="1.5" fill="white" opacity="0">
        <animate attributeName="opacity" from="0" to=".6" dur=".06s" begin=".4s" fill="freeze" />
      </circle>
    </svg>
  );
}

function Cell({ CS, value, onClick, isWinCell, justPlaced, lastTurn }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O" }) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X", isP2 = value === "O";
  const wC = isP1 ? "rgba(220,38,38,.4)" : "rgba(124,58,237,.4)";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        width: CS,
        height: CS,
        position: "relative",
        cursor: "pointer",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isWinCell
          ? `radial-gradient(ellipse,${isP1 ? "rgba(180,0,0,.28)" : "rgba(100,0,180,.28)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(70,0,0,.2),transparent 70%)"
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "bmWinPulse 1.05s ease-in-out infinite" : "none",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "200,0,0" : "120,0,200"},.8),transparent 65%)`,
            animation: "hF .5s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <Pentagram size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <EvilEye size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes hF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.2)}}@keyframes bmWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}

export default function BloodMoonGrid({
  board,
  onCellClick,
  winCells = [],
  showLabels = true,
  cellSize,
}: {
  board?: (("X" | "O") | null)[][];
  onCellClick?: (r: number, c: number) => void;
  winCells?: [number, number][];
  showLabels?: boolean;
  cellSize?: number;
}) {
  const PAD = 8;
  const CS = cellSize ?? useCellSize(PAD);
  const [demo, setDemo] = useState<(("X" | "O") | null)[][]>(() => Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [last, setLast] = useState<string | null>(null);

  const active = board ?? demo;
  const winSet = new Set(winCells.map(([r, c]) => `${r}-${c}`));
  const burstRef = useRef<((x: number, y: number, isP1: boolean) => void) | null>(null);
  const BS = 5 * CS + 2 * PAD;

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
    setLast(`${r}-${c}`);
    setTimeout(() => setLast(null), 700);
    if (onCellClick) { onCellClick(r, c); return; }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(200,0,0,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".15em",
    textShadow: "0 0 12px rgba(200,0,0,.9),0 0 24px rgba(140,0,0,.6)",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {showLabels && (
        <div style={{ display: "flex", paddingLeft: PAD + CS * 0.3 }}>
          {COLS.map((c) => (
            <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>{c}</div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {showLabels && (
          <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>
            {ROWS.map((r) => (
              <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>{r}</div>
            ))}
          </div>
        )}
        <div
          style={{
            position: "relative",
            width: BS,
            height: BS,
            borderRadius: CS * 0.06,
            overflow: "hidden",
            border: "2px solid rgba(140,0,0,.7)",
            boxShadow: "0 0 0 1px rgba(100,0,100,.3),0 0 45px rgba(160,0,0,.45),0 0 100px rgba(80,0,0,.3),inset 0 0 80px rgba(0,0,0,.7)",
          }}
        >
          <BloodMoonBg W={BS} H={BS} />
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} />
          <BurstCanvas burstRef={burstRef} W={BS} H={BS} />
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => (
                  <Cell
                    key={`${r}-${c}`}
                    CS={CS}
                    value={active[r][c]}
                    onClick={() => click(r, c)}
                    isWinCell={winSet.has(`${r}-${c}`)}
                    justPlaced={last === `${r}-${c}`}
                    lastTurn={turn}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

