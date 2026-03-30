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

function SpaceBackground({ W, H, gridSize = 5, isPaused = false }: { W: number; H: number; gridSize?: number; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const dpr = boardSkinCanvasDpr(gridSize);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
      spd: 0.01 + Math.random() * 0.02,
      col: ["#ffffff", "#aaccff", "#ffeecc", "#ccaaff"][Math.floor(Math.random() * 4)],
    }));
    const shoots = Array.from({ length: 3 }, () => ({
      x: -100,
      y: Math.random() * H,
      vx: 9 + Math.random() * 6,
      vy: 1 + Math.random() * 2,
      alpha: 0,
      timer: Math.random() * 200,
    }));
    const nebs = [
      { cx: W * 0.2, cy: H * 0.3, rx: W * 0.35, ry: H * 0.28, c: "rgba(60,0,120,0.45)" },
      { cx: W * 0.75, cy: H * 0.65, rx: W * 0.4, ry: H * 0.35, c: "rgba(0,40,120,0.35)" },
      { cx: W * 0.5, cy: H * 0.15, rx: W * 0.3, ry: H * 0.2, c: "rgba(100,0,80,0.3)" },
    ];
    const wh = { cx: W * 0.62, cy: H * 0.38, r: W * 0.08 };

    const draw = () => {
      t.current += 0.014;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.8);
      bg.addColorStop(0, "#04011a");
      bg.addColorStop(0.5, "#020110");
      bg.addColorStop(1, "#000008");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      nebs.forEach((n: any) => {
        const g = ctx.createRadialGradient(n.cx + Math.sin(tc * 0.2) * 20, n.cy + Math.cos(tc * 0.15) * 15, 0, n.cx, n.cy, Math.max(n.rx, n.ry));
        g.addColorStop(0, n.c);
        g.addColorStop(1, "transparent");
        ctx.save();
        ctx.scale(1, n.ry / n.rx);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.cx, n.cy * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const pulse = 0.6 + 0.4 * Math.sin(tc * 1.2);
      for (let ring = 5; ring >= 1; ring--) {
        const rr = wh.r * (ring / 5) * pulse;
        const g2 = ctx.createRadialGradient(wh.cx, wh.cy, 0, wh.cx, wh.cy, rr);
        g2.addColorStop(0, `rgba(180,100,255,${0.12 * ring})`);
        g2.addColorStop(0.6, `rgba(80,20,180,${0.06 * ring})`);
        g2.addColorStop(1, "transparent");
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(wh.cx, wh.cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.strokeStyle = `rgba(200,120,255,${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(200,120,255,.8)";
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(wh.cx, wh.cy, wh.r * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      stars.forEach((s: any) => {
        s.phase += s.spd;
        const b = 0.4 + 0.6 * Math.abs(Math.sin(s.phase));
        ctx.save();
        ctx.globalAlpha = b;
        ctx.fillStyle = s.col;
        ctx.shadowColor = s.col;
        ctx.shadowBlur = s.r > 1.2 ? 8 : 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      shoots.forEach((s: any) => {
        s.timer--;
        if (s.timer < 0) {
          s.x = 0;
          s.y = Math.random() * H * 0.6;
          s.vx = 9 + Math.random() * 7;
          s.vy = 0.5 + Math.random() * 1.5;
          s.alpha = 1;
          s.timer = 120 + Math.random() * 180;
        }
        if (s.alpha > 0) {
          s.x += s.vx;
          s.y += s.vy;
          s.alpha = Math.max(0, s.alpha - 0.015);
          const len = 60;
          ctx.save();
          ctx.globalAlpha = s.alpha;
          const sg = ctx.createLinearGradient(s.x - len, s.y, s.x, s.y);
          sg.addColorStop(0, "transparent");
          sg.addColorStop(1, "rgba(220,200,255,.9)");
          ctx.strokeStyle = sg;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x - len, s.y);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          ctx.restore();
        }
      });

      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, gridSize, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

function GridLines({ W, H, PAD, CS, SIZE, isPaused = false }: { W: number; H: number; PAD: number; CS: number; SIZE: number; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const dpr = boardSkinCanvasDpr(SIZE);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= SIZE; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const p = 0.7 + 0.3 * Math.sin(tc * 1.4 + i * 0.7);

        ctx.save();
        ctx.strokeStyle = `rgba(140,80,255,${0.25 * p})`;
        ctx.lineWidth = 10;
        ctx.shadowColor = "rgba(160,80,255,.6)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(180,110,255,${0.55 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(200,120,255,.9)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(230,200,255,${0.9 * p})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(255,255,255,1)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(80,140,255,${0.25 * p})`;
        ctx.lineWidth = 10;
        ctx.shadowColor = "rgba(80,160,255,.6)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(100,170,255,${0.55 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(120,200,255,.9)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(200,230,255,${0.9 * p})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(255,255,255,1)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const fl = 0.5 + 0.5 * Math.abs(Math.sin(tc * 2.2 + (r * 6 + c) * 0.9));
        ctx.save();
        ctx.strokeStyle = `rgba(200,160,255,${0.6 * fl})`;
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(200,160,255,.8)";
        ctx.shadowBlur = 14 * fl;
        ctx.beginPath();
        ctx.arc(nx, ny, 7 * fl, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,240,255,${0.9 * fl})`;
        ctx.shadowColor = "rgba(255,255,255,1)";
        ctx.shadowBlur = 12 * fl;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, PAD, CS, SIZE, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

function BurstCanvas({
  burstRef,
  W,
  H,
  gridSize = 5,
}: {
  burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>;
  W: number;
  H: number;
  gridSize?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);

  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [180, 100, 255] : [80, 180, 255];
    const c2 = isP1 ? [255, 80, 200] : [80, 255, 220];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.05 + i * 0.05), alpha: 1 - i * 0.18, col: i % 2 === 0 ? c1 : c2, decay: 0.022 + i * 0.008, w: 3 - i * 0.4 });
    for (let i = 0; i < 32; i++) {
      const a = Math.PI * 2 * i / 32 + (Math.random() - 0.5) * 0.3, spd = 3 + Math.random() * 5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: Math.random() * 2.5 + 0.8, alpha: 1, col: Math.random() > 0.5 ? c1 : c2, decay: 0.03 + Math.random() * 0.025 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * i / 8;
      pts.current.push({ type: "ray", x, y, a, len: 0, maxLen: W * 0.14, alpha: 1, col: c1, decay: 0.04 });
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
        ctx.shadowColor = `rgba(${p.col},.8)`;
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
      } else if (p.type === "ray") {
        p.len += (p.maxLen - p.len) * 0.22;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = `rgb(${p.col})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (pts.current.length > 0) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = boardSkinCanvasDpr(gridSize);
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
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function Pulsar({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const w = win
    ? "drop-shadow(0 0 10px #b464ff) drop-shadow(0 0 28px #8020ff) drop-shadow(0 0 55px rgba(140,40,255,.6))"
    : "drop-shadow(0 0 6px #b464ff) drop-shadow(0 0 18px rgba(140,60,255,.7))";
  const pts8 = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 * Math.PI / 180;
    const r = i % 2 === 0 ? 20 : 9;
    return `${24 + r * Math.cos(a)},${24 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: w, animation: "pIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes pIn{0%{transform:scale(0) rotate(-90deg);opacity:0}55%{transform:scale(1.3) rotate(15deg);opacity:1}80%{transform:scale(.9) rotate(-5deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <polygon points={pts8} fill="none" stroke="#b464ff" strokeWidth="2" strokeDasharray="100" strokeDashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur=".28s" fill="freeze" />
      </polygon>
      <polygon points={pts8} fill="#8020cc" opacity="0">
        <animate attributeName="opacity" from="0" to=".25" dur=".08s" begin=".26s" fill="freeze" />
      </polygon>
      <circle cx="24" cy="24" r="5" fill="#e0b4ff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".28s" fill="freeze" />
        <animate attributeName="r" values="4;6;4" dur="2s" begin=".5s" repeatCount="indefinite" />
      </circle>
      {Array.from({ length: 4 }, (_, i) => {
        const a = i * 90 * Math.PI / 180;
        return (
          <line key={i} x1={24} y1={24} x2={24 + 24 * Math.cos(a)} y2={24 + 24 * Math.sin(a)} stroke="#d090ff" strokeWidth=".8" opacity="0" strokeDasharray="24" strokeDashoffset="24">
            <animate attributeName="stroke-dashoffset" from="24" to="0" dur=".1s" begin={`${0.28 + i * 0.05}s`} fill="freeze" />
            <animate attributeName="opacity" from="0" to=".6" dur=".05s" begin={`${0.28 + i * 0.05}s`} fill="freeze" />
          </line>
        );
      })}
    </svg>
  );
}

function Quasar({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const w = win
    ? "drop-shadow(0 0 10px #40d0ff) drop-shadow(0 0 28px #0080ff) drop-shadow(0 0 55px rgba(0,160,255,.6))"
    : "drop-shadow(0 0 6px #40c0ff) drop-shadow(0 0 18px rgba(0,160,255,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: w, animation: "qIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes qIn{0%{transform:scale(0) rotate(60deg);opacity:0}55%{transform:scale(1.25) rotate(-8deg);opacity:1}80%{transform:scale(.92) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <ellipse cx="24" cy="24" rx="20" ry="7" fill="none" stroke="#40c0ff" strokeWidth="2" strokeDasharray="82" strokeDashoffset="82">
        <animate attributeName="stroke-dashoffset" from="82" to="0" dur=".22s" fill="freeze" />
      </ellipse>
      <ellipse cx="24" cy="24" rx="7" ry="20" fill="none" stroke="#40c0ff" strokeWidth="2" strokeDasharray="82" strokeDashoffset="82">
        <animate attributeName="stroke-dashoffset" from="82" to="0" dur=".22s" begin=".08s" fill="freeze" />
      </ellipse>
      <circle cx="24" cy="24" r="13" fill="none" stroke="rgba(80,200,255,.5)" strokeWidth="1.2" strokeDasharray="82" strokeDashoffset="82">
        <animate attributeName="stroke-dashoffset" from="82" to="0" dur=".2s" begin=".14s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="5" fill="#80e0ff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".3s" fill="freeze" />
        <animate attributeName="r" values="4;7;4" dur="2.4s" begin=".5s" repeatCount="indefinite" />
      </circle>
      <circle cx="24" cy="24" r="2" fill="white" opacity="0">
        <animate attributeName="opacity" from="0" to=".9" dur=".05s" begin=".34s" fill="freeze" />
      </circle>
    </svg>
  );
}

function VoidCell({ CS, value, onClick, isWinCell, justPlaced, lastTurn, isP1, isP2 }: { CS: number; value: "X" | "O" | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O"; isP1: boolean; isP2: boolean }) {
  const [hov, setHov] = useState(false);
  const wC = isP1 ? "rgba(180,100,255,.5)" : "rgba(80,180,255,.5)";
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
          ? `radial-gradient(ellipse,${isP1 ? "rgba(150,80,255,.3)" : "rgba(60,160,255,.3)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(100,60,200,.2),transparent 70%)"
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "vdWinPulse 1.05s ease-in-out infinite" : "none",
        contain: "layout style",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "180,100,255" : "80,200,255"},.7),transparent 65%)`,
            animation: "cF .55s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <Pulsar size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <Quasar size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes cF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}@keyframes vdWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}
const MemoizedVoidCell = React.memo(VoidCell);

export default React.memo(function VoidGrid({ board, onCellClickAction, winCells = [], showLabels = true, isPaused = false }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; isPaused?: boolean }) {
  const active = board ?? Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(null));
  const SIZE = active.length;
  const COLS = GET_COLS(SIZE);
  const ROWS = GET_ROWS(SIZE);
  const PAD = 8;
  const CS = useCellSize(SIZE, PAD);
  const BS = SIZE * CS + 2 * PAD;

  const [demo, setDemo] = useState<(("X" | "O") | null)[][]>(() => Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [last, setLast] = useState<string | null>(null);
  const winSet = new Set(winCells.map(([r, c]) => `${r}-${c}`));
  const burstRef = useRef<((x: number, y: number, isP1: boolean) => void) | null>(null);

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
    setLast(`${r}-${c}`);
    setTimeout(() => setLast(null), 700);
    if (onCellClickAction) {
      onCellClickAction?.(r, c);
      return;
    }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(180,140,255,.85)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".18em",
    textShadow: "0 0 12px rgba(160,100,255,.9),0 0 24px rgba(120,60,220,.5)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.06, overflow: "hidden", border: "2px solid rgba(140,80,255,.7)", boxShadow: "0 0 0 1px rgba(80,40,160,.4),0 0 40px rgba(120,60,220,.5),0 0 100px rgba(60,20,120,.3),inset 0 0 80px rgba(0,0,0,.85)", willChange: "transform", contain: "layout size style" }}>
          <SpaceBackground W={BS} H={BS} gridSize={SIZE} isPaused={isPaused} />
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} isPaused={isPaused} />
          <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => {
                  const val = active[r][c] as "X" | "O" | null;
                  return (
                    <MemoizedVoidCell
                      key={`${r}-${c}`}
                      CS={CS}
                      value={val}
                      onClick={() => click(r, c)}
                      isWinCell={winSet.has(`${r}-${c}`)}
                      justPlaced={last === `${r}-${c}`}
                      lastTurn={turn}
                      isP1={val === "X"}
                      isP2={val === "O"}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
