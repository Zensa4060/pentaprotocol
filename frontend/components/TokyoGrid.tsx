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

function TokyoBg({ W, H }: { W: number; H: number }) {
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

    const rain = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      len: Math.random() * 20 + 8,
      spd: 9 + Math.random() * 7,
      a: Math.random() * 0.5 + 0.2,
    }));
    const signs = [
      { x: W * 0.06, y: H * 0.12, w: W * 0.14, h: H * 0.07, col: "rgba(255,0,120,.8)", p: 0 },
      { x: W * 0.7, y: H * 0.08, w: W * 0.22, h: H * 0.09, col: "rgba(0,200,255,.8)", p: 1.4 },
      { x: W * 0.28, y: H * 0.04, w: W * 0.2, h: H * 0.06, col: "rgba(255,210,0,.7)", p: 0.7 },
      { x: W * 0.52, y: H * 0.16, w: W * 0.09, h: H * 0.14, col: "rgba(180,0,255,.7)", p: 2 },
      { x: W * 0.12, y: H * 0.32, w: W * 0.07, h: H * 0.22, col: "rgba(0,255,120,.6)", p: 1.1 },
      { x: W * 0.8, y: H * 0.25, w: W * 0.14, h: H * 0.06, col: "rgba(255,80,0,.65)", p: 0.4 },
    ];

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#040008");
      bg.addColorStop(0.5, "#070012");
      bg.addColorStop(1, "#030008");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(0,0,0,.75)";
      [
        [0, H * 0.38, W * 0.16, H],
        [W * 0.09, H * 0.48, W * 0.13, H],
        [W * 0.2, H * 0.32, W * 0.11, H],
        [W * 0.58, H * 0.42, W * 0.19, H],
        [W * 0.7, H * 0.35, W * 0.11, H],
        [W * 0.8, H * 0.5, W * 0.2, H],
      ].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));

      [
        [W * 0.02, H * 0.55],
        [W * 0.05, H * 0.6],
        [W * 0.03, H * 0.65],
        [W * 0.25, H * 0.45],
        [W * 0.27, H * 0.5],
        [W * 0.62, H * 0.52],
        [W * 0.65, H * 0.57],
        [W * 0.72, H * 0.45],
        [W * 0.85, H * 0.58],
        [W * 0.88, H * 0.62],
      ].forEach(([wx, wy]) => {
        const gd = ctx.createRadialGradient(wx as number, wy as number, 0, wx as number, wy as number, 4);
        gd.addColorStop(0, "rgba(255,255,100,.9)");
        gd.addColorStop(1, "transparent");
        ctx.fillStyle = gd;
        ctx.beginPath();
        ctx.arc(wx as number, wy as number, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      signs.forEach((s: any) => {
        const p = 0.5 + 0.5 * Math.sin(tc * 1.6 + s.p);
        const gg = ctx.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, 0, s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h) * 1.8);
        gg.addColorStop(0, s.col.replace(".8", String(0.4 * p)));
        gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg;
        ctx.fillRect(s.x - s.w * 0.5, s.y - s.h * 0.5, s.w * 2, s.h * 2);
        ctx.save();
        ctx.fillStyle = s.col;
        ctx.shadowColor = s.col;
        ctx.shadowBlur = 12 * p;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.restore();
      });

      ctx.save();
      ctx.globalAlpha = 0.12 + 0.06 * Math.sin(tc * 0.4);
      signs.forEach((s: any) => {
        const rg = ctx.createLinearGradient(s.x + s.w / 2, H * 0.72, s.x + s.w / 2, H);
        rg.addColorStop(0, "transparent");
        rg.addColorStop(0.4, s.col.replace(".8", "0.7"));
        rg.addColorStop(1, s.col.replace(".8", "0.1"));
        ctx.fillStyle = rg;
        ctx.fillRect(s.x, H * 0.72, s.w, H * 0.28);
      });
      ctx.restore();

      [
        [W * 0.2, H * 0.3, "rgba(200,0,80,.05)"],
        [W * 0.7, H * 0.2, "rgba(0,150,200,.04)"],
        [W * 0.5, H * 0.8, "rgba(120,0,200,.04)"],
      ].forEach(([gx, gy, col]) => {
        const gg = ctx.createRadialGradient(gx as number, gy as number, 0, gx as number, gy as number, W * 0.5);
        gg.addColorStop(0, col as string);
        gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, W, H);
      });

      rain.forEach((r: any) => {
        r.y += r.spd;
        if (r.y > H + r.len) {
          r.y = -r.len;
          r.x = Math.random() * W;
        }
        ctx.save();
        ctx.globalAlpha = r.a;
        const rg = ctx.createLinearGradient(r.x, r.y - r.len, r.x + r.len * 0.12, r.y);
        rg.addColorStop(0, "transparent");
        rg.addColorStop(1, "rgba(160,210,255,.85)");
        ctx.strokeStyle = rg;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - r.len);
        ctx.lineTo(r.x + r.len * 0.12, r.y);
        ctx.stroke();
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

    const vC = ["#ff0078", "#ff5500", "#ffe500", "#00ff80", "#00ccff", "#cc00ff"];
    const hC = ["#00bbff", "#9900ff", "#ff0055", "#0077ff", "#ff3300", "#00ffbb"];

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= 5; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const p = 0.6 + 0.4 * Math.sin(tc * 2.2 + i * 0.85);
        const vc = vC[i], hc = hC[i];

        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 18; ctx.globalAlpha = 0.05 * p;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 9; ctx.globalAlpha = 0.16 * p; ctx.shadowColor = vc; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.72 * p; ctx.shadowColor = vc; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.88)"; ctx.lineWidth = 1; ctx.globalAlpha = 0.82 * p; ctx.shadowColor = vc; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.restore();

        ctx.save(); ctx.strokeStyle = hc; ctx.lineWidth = 18; ctx.globalAlpha = 0.05 * p;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = hc; ctx.lineWidth = 9; ctx.globalAlpha = 0.16 * p; ctx.shadowColor = hc; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = hc; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.72 * p; ctx.shadowColor = hc; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.88)"; ctx.lineWidth = 1; ctx.globalAlpha = 0.82 * p; ctx.shadowColor = hc; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
      }

      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const fl = 0.5 + 0.5 * Math.abs(Math.sin(tc * 2.6 + (r * 6 + c)));
        const cc = vC[c % 6];
        ctx.save();
        ctx.fillStyle = cc;
        ctx.shadowColor = cc;
        ctx.shadowBlur = 18 * fl;
        ctx.globalAlpha = fl;
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = cc;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.5 * fl;
        ctx.shadowColor = cc;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nx, ny, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, PAD, CS]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

function BurstCanvas({
  burstRef,
  W,
  H,
}: {
  burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>;
  W: number;
  H: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);

  burstRef.current = (x, y, isP1) => {
    const n = isP1 ? [[255, 0, 120], [255, 200, 0], [0, 200, 255]] : [[0, 200, 255], [180, 0, 255], [0, 255, 120]];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.04), alpha: 1 - i * 0.2, col: n[i % 3], decay: 0.025 + i * 0.009, w: 2.5 - i * 0.4 });
    for (let i = 0; i < 28; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2.5 + Math.random() * 5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.5 + 0.8, alpha: 1, col: n[Math.floor(Math.random() * 3)], decay: 0.03 + Math.random() * 0.025 });
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
        p.r += (p.maxR - p.r) * 0.16;
        p.alpha -= p.decay;
        ctx.save();
        ctx.strokeStyle = `rgba(${p.col},${p.alpha})`;
        ctx.lineWidth = (p.w || 2) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.9)`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "spark") {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.91;
        p.vy *= 0.91;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * Math.max(0.2, p.alpha), 0, Math.PI * 2);
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
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function DragonSeal({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #ff0066) drop-shadow(0 0 26px #ff0066) drop-shadow(0 0 55px rgba(255,0,100,.6))"
    : "drop-shadow(0 0 6px #ff0066) drop-shadow(0 0 16px rgba(255,0,100,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "drIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes drIn{0%{transform:scale(0) rotate(-45deg);opacity:0;filter:blur(8px)}50%{transform:scale(1.3) rotate(10deg);opacity:1;filter:blur(0)}80%{transform:scale(.9) rotate(-4deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <polygon points="24,4 28,20 44,24 28,28 24,44 20,28 4,24 20,20" fill="none" stroke="#ff0066" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="110" strokeDashoffset="110">
        <animate attributeName="stroke-dashoffset" from="110" to="0" dur=".28s" fill="freeze" />
      </polygon>
      <polygon points="24,4 28,20 44,24 28,28 24,44 20,28 4,24 20,20" fill="#ff0066" opacity="0">
        <animate attributeName="opacity" from="0" to=".12" dur=".07s" begin=".26s" fill="freeze" />
      </polygon>
      <polygon points="24,12 27,21 36,24 27,27 24,36 21,27 12,24 21,21" fill="none" stroke="#ff88aa" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".7" dur=".06s" begin=".28s" fill="freeze" />
      </polygon>
      <circle cx="24" cy="24" r="4" fill="#ff88aa" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".06s" begin=".3s" fill="freeze" />
        <animate attributeName="r" values="3;5;3" dur="1.8s" begin=".5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Katana({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #00ccff) drop-shadow(0 0 26px #0088ff) drop-shadow(0 0 55px rgba(0,180,255,.6))"
    : "drop-shadow(0 0 6px #00ccff) drop-shadow(0 0 16px rgba(0,180,255,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "katIn .44s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes katIn{0%{transform:translateY(-${size * 0.7}px) rotate(-20deg) scale(.4);opacity:0}60%{transform:translateY(${size * 0.04}px) rotate(6deg) scale(1.12);opacity:1}80%{transform:rotate(-2deg) scale(.95)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <line x1="24" y1="5" x2="24" y2="40" stroke="#00ccff" strokeWidth="3" strokeLinecap="round" strokeDasharray="35" strokeDashoffset="35">
        <animate attributeName="stroke-dashoffset" from="35" to="0" dur=".2s" fill="freeze" />
      </line>
      <line x1="24" y1="5" x2="24" y2="40" stroke="rgba(255,255,255,.7)" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="28" x2="34" y2="28" stroke="#00ccff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="20" strokeDashoffset="20">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur=".1s" begin=".18s" fill="freeze" />
      </line>
      <path d="M24,40 Q20,42 18,45 L30,45 Q28,42 24,40Z" fill="#00ccff" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".07s" begin=".24s" fill="freeze" />
      </path>
      <circle cx="24" cy="5" r="2.5" fill="#80eeff" opacity="0">
        <animate attributeName="opacity" values="0;1;.4;1;0" dur="2s" begin=".3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Cell({
  CS,
  value,
  onClick,
  isWinCell,
  justPlaced,
  lastTurn,
}: {
  CS: number;
  value: "X" | "O" | null;
  onClick: () => void;
  isWinCell: boolean;
  justPlaced: boolean;
  lastTurn: "X" | "O";
}) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X", isP2 = value === "O";
  const wC = isP1 ? "rgba(255,0,100,.4)" : "rgba(0,200,255,.4)";
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
          ? `radial-gradient(ellipse,${isP1 ? "rgba(255,0,80,.25)" : "rgba(0,180,255,.25)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(200,0,80,.12),transparent 70%)"
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "255,0,100" : "0,200,255"},.7),transparent 65%)`,
            animation: "cF .55s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <DragonSeal size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <Katana size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes cF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}`}</style>
    </div>
  );
}

export default function TokyoGrid({
  board,
  onCellClick,
  winCells = [],
  showLabels = true,
}: {
  board?: (("X" | "O") | null)[][];
  onCellClick?: (r: number, c: number) => void;
  winCells?: [number, number][];
  showLabels?: boolean;
}) {
  const PAD = 8;
  const CS = useCellSize(PAD);
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
    if (onCellClick) {
      onCellClick(r, c);
      return;
    }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(255,80,140,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".2em",
    textShadow: "0 0 12px rgba(255,0,100,.9),0 0 24px rgba(200,0,80,.5)",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {showLabels && (
        <div style={{ display: "flex", paddingLeft: PAD + CS * 0.3 }}>
          {COLS.map((c) => (
            <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>
              {c}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {showLabels && (
          <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>
            {ROWS.map((r) => (
              <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>
                {r}
              </div>
            ))}
          </div>
        )}
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.06, overflow: "hidden", border: "2px solid rgba(255,0,100,.7)", boxShadow: "0 0 0 1px rgba(0,150,200,.3),0 0 40px rgba(200,0,80,.4),0 0 100px rgba(100,0,60,.3),inset 0 0 80px rgba(0,0,15,.5)" }}>
          <TokyoBg W={BS} H={BS} />
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

