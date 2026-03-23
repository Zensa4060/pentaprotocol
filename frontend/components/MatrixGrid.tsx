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

function MatrixBg({ W, H, gridSize = 5 }: { W: number; H: number; gridSize?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);

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

    const matChars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01アカサタナ10".split("");
    const numStreams = Math.floor(W / 10) + 4;
    const streams = Array.from({ length: numStreams }, (_, i) => ({
      x: 8 + i * (W - 16) / numStreams + Math.random() * 4 - 2,
      y: Math.random() * H * 2 - H,
      spd: 0.8 + Math.random() * 1.2,
      chars: Array.from({ length: 14 }, () => matChars[Math.floor(Math.random() * matChars.length)]),
      spacing: 11 + Math.random() * 4,
      bright: Math.random() > 0.85,
      glitch: Math.random() * 3,
    }));
    const glitchBlocks = Array.from({ length: 3 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      w: Math.random() * W * 0.22 + 20,
      h: Math.random() * 3 + 1,
      timer: Math.random() * 5,
      interval: 3 + Math.random() * 4,
      alpha: 0,
    }));

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000300");
      bg.addColorStop(0.5, "#000800");
      bg.addColorStop(1, "#000400");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const fg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.7);
      fg.addColorStop(0, "rgba(0,80,20,.12)");
      fg.addColorStop(0.5, "rgba(0,40,10,.06)");
      fg.addColorStop(1, "transparent");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);

      streams.forEach((s) => {
        s.y += s.spd;
        if (s.y > H + s.chars.length * s.spacing) {
          s.y = -s.chars.length * s.spacing;
          s.x = 8 + Math.random() * (W - 16);
          s.chars = Array.from({ length: s.chars.length }, () => matChars[Math.floor(Math.random() * matChars.length)]);
        }
        s.glitch -= 0.016;
        if (s.glitch < 0) {
          s.glitch = 1 + Math.random() * 3;
          s.chars[Math.floor(Math.random() * s.chars.length)] = matChars[Math.floor(Math.random() * matChars.length)];
        }
        s.chars.forEach((ch, j) => {
          const cy = s.y - j * s.spacing;
          if (cy < -s.spacing || cy > H + s.spacing) return;
          const isHead = j === 0;
          const fade = Math.max(0, 1 - j * 0.09);
          ctx.save();
          ctx.font = `${isHead ? 10 : 9}px 'Courier New',monospace`;
          if (isHead) {
            ctx.fillStyle = "rgba(200,255,200,.95)";
            ctx.shadowColor = "rgba(150,255,150,1)";
            ctx.shadowBlur = 16;
          } else if (j < 2) {
            ctx.fillStyle = `rgba(100,255,120,${fade * 0.9})`;
            ctx.shadowColor = "rgba(0,255,50,.8)";
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = s.bright ? `rgba(0,220,60,${fade * 0.7})` : `rgba(0,160,40,${fade * 0.5})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(ch, s.x - 4, cy);
          ctx.restore();
        });
      });

      glitchBlocks.forEach((g) => {
        g.timer -= 0.016;
        if (g.timer < 0) {
          g.timer = g.interval + Math.random() * 2;
          g.x = Math.random() * W;
          g.y = Math.random() * H;
          g.alpha = 0.8;
        } else if (g.alpha > 0) {
          g.alpha = Math.max(0, g.alpha - 0.05);
        }
        if (g.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = g.alpha;
          ctx.fillStyle = "rgba(0,220,60,.4)";
          ctx.fillRect(g.x, g.y, g.w, g.h);
          ctx.restore();
        }
      });

      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = "rgba(0,0,0,.08)";
        ctx.fillRect(0, y, W, 1.5);
      }

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

function GridLines({ W, H, PAD, CS, SIZE }: { W: number; H: number; PAD: number; CS: number; SIZE: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
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
        const p = 0.6 + 0.4 * Math.sin(tc * 1.6 + i * 0.85);

        ctx.save();
        ctx.strokeStyle = "rgba(0,255,65,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,220,50,${0.2 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,255,65,.7)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,255,65,${0.75 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,255,65,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(180,255,180,${0.92 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.8)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(0,200,40,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,190,40,${0.18 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,230,50,.7)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,240,55,${0.72 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,255,65,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(160,255,170,${0.9 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.8)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      const nP = 4;
      for (let p2 = 0; p2 < nP; p2++) {
        const pos = (tc * 0.4 + p2 / nP) % 1;
        const isV = p2 % 2 === 0;
        const li = Math.floor(p2 / 2) % 6;
        const lx = PAD + li * CS, ly = PAD + li * CS;
        const px2 = isV ? lx : PAD + (W - 2 * PAD) * pos;
        const py2 = isV ? PAD + (H - 2 * PAD) * pos : ly;
        const pg = ctx.createRadialGradient(px2, py2, 0, px2, py2, CS * 0.12);
        pg.addColorStop(0, "rgba(200,255,200,.95)");
        pg.addColorStop(0.4, "rgba(0,255,65,.5)");
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.shadowColor = "rgba(0,255,65,1)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(px2, py2, CS * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const gp = 0.35 + 0.65 * Math.abs(Math.sin(tc * 1.9 + (r * 5 + c) * 0.7));
        ctx.save();
        ctx.globalAlpha = gp;
        ctx.fillStyle = "rgba(0,255,65,.9)";
        ctx.shadowColor = "rgba(0,255,65,1)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,200,50,.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(nx - 5, ny - 5, 10, 10);
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, PAD, CS, SIZE]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

function BurstCanvas({ burstRef, W, H, gridSize = 5 }: { burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>; W: number; H: number; gridSize?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);
  const matChars = "01アイウカキサシタチ".split("");

  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [0, 255, 65] : [74, 222, 128];
    const c2 = isP1 ? [0, 180, 40] : [0, 200, 80];
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 2 * i / 12 + (Math.random() - 0.5) * 0.4;
      const s = 2.5 + Math.random() * 4;
      pts.current.push({
        type: "codeStream",
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        chars: Array.from({ length: Math.floor(Math.random() * 4 + 2) }, () => matChars[Math.floor(Math.random() * matChars.length)]),
        alpha: 1,
        col: c1,
        decay: 0.028 + Math.random() * 0.02,
        fontSize: 8 + Math.random() * 4,
      });
    }
    for (let i = 0; i < 3; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.07 + i * 0.05), alpha: 0.85 - i * 0.2, col: c1, decay: 0.03 + i * 0.01, w: 2.5 - i * 0.4 });
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2 + Math.random() * 4.5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2 + 0.8, alpha: 1, col: Math.random() > 0.5 ? c1 : c2, decay: 0.04 + Math.random() * 0.03 });
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
      if (p.type === "codeStream") {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.9; p.vy *= 0.9;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.font = `bold ${p.fontSize}px 'Courier New',monospace`;
        ctx.shadowColor = `rgba(${p.col},.8)`;
        ctx.shadowBlur = 8;
        p.chars.forEach((ch: string, j: number) => {
          const br = Math.max(0, (j === 0 ? 1 : 0.7 - j * 0.12) * p.alpha);
          ctx.fillStyle = `rgba(${p.col},${br})`;
          ctx.fillText(ch, p.x, p.y + j * p.fontSize * 1.1);
        });
        ctx.restore();
      } else if (p.type === "ring") {
        p.r += (p.maxR - p.r) * 0.15;
        p.alpha -= p.decay;
        ctx.save();
        ctx.strokeStyle = `rgba(${p.col},${p.alpha})`;
        ctx.lineWidth = (p.w || 2.5) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.7)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "spark") {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.91; p.vy *= 0.91;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.shadowBlur = 12;
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
    const dpr = boardSkinCanvasDpr(gridSize);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function MatrixBracket({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #00ff41) drop-shadow(0 0 28px #00ff41) drop-shadow(0 0 55px rgba(0,255,65,.6))"
    : "drop-shadow(0 0 6px #00ff41) drop-shadow(0 0 18px rgba(0,255,65,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "mxIn .45s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes mxIn{0%{transform:scale(.3);opacity:0;filter:blur(8px)}40%{transform:scale(1.18);opacity:.8;filter:blur(2px)}70%{transform:scale(.93);opacity:1;filter:blur(0)}100%{transform:scale(1);opacity:1}}`}</style>
      <path d="M22,6 L16,6 L16,42 L22,42" fill="none" stroke="#00ff41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="58" strokeDashoffset="58">
        <animate attributeName="stroke-dashoffset" from="58" to="0" dur=".2s" fill="freeze" />
      </path>
      <path d="M26,6 L32,6 L32,42 L26,42" fill="none" stroke="#00ff41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="58" strokeDashoffset="58">
        <animate attributeName="stroke-dashoffset" from="58" to="0" dur=".2s" begin=".08s" fill="freeze" />
      </path>
      {[14, 19, 24, 29, 34].map((y, i) => (
        <line key={i} x1={19} y1={y} x2={29} y2={y} stroke="#00cc33" strokeWidth="1.2" opacity="0">
          <animate attributeName="opacity" from="0" to={`${0.4 + i * 0.05}`} dur=".05s" begin={`${0.2 + i * 0.04}s`} fill="freeze" />
        </line>
      ))}
      <rect x="21" y="22" width="6" height="3" fill="#00ff41" opacity="0">
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.1;0.5;0.6;1" dur="1.2s" begin=".38s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function BinaryPill({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #4ade80) drop-shadow(0 0 26px #4ade80) drop-shadow(0 0 55px rgba(74,222,128,.6))"
    : "drop-shadow(0 0 6px #4ade80) drop-shadow(0 0 18px rgba(74,222,128,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "bpIn .42s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes bpIn{0%{transform:scaleX(0) scaleY(.3);opacity:0;filter:blur(6px)}50%{transform:scaleX(1.12) scaleY(1.1);opacity:1;filter:blur(0)}80%{transform:scaleX(.94) scaleY(.96)}100%{transform:scale(1);opacity:1}}`}</style>
      <rect x="6" y="10" width="36" height="28" rx="14" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeDasharray="92" strokeDashoffset="92">
        <animate attributeName="stroke-dashoffset" from="92" to="0" dur=".26s" fill="freeze" />
      </rect>
      <rect x="6" y="10" width="36" height="28" rx="14" fill="#4ade80" opacity="0">
        <animate attributeName="opacity" from="0" to=".08" dur=".07s" begin=".24s" fill="freeze" />
      </rect>
      <line x1="24" y1="10" x2="24" y2="38" stroke="#4ade80" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".4" dur=".06s" begin=".26s" fill="freeze" />
      </line>
      <text x="10" y="28" fontSize="10" fontFamily="'Courier New',monospace" fontWeight="bold" fill="#4ade80" opacity="0">01
        <animate attributeName="opacity" from="0" to=".9" dur=".05s" begin=".28s" fill="freeze" />
      </text>
      <text x="26" y="28" fontSize="10" fontFamily="'Courier New',monospace" fontWeight="bold" fill="#86efac" opacity="0">10
        <animate attributeName="opacity" from="0" to=".85" dur=".05s" begin=".32s" fill="freeze" />
      </text>
      <line x1="6" y1="24" x2="42" y2="24" stroke="#4ade80" strokeWidth="1" opacity="0">
        <animate attributeName="opacity" values="0;.5;0" dur="1.8s" begin=".38s" repeatCount="indefinite" />
        <animate attributeName="y1" values="10;38;10" dur="1.8s" begin=".38s" repeatCount="indefinite" />
        <animate attributeName="y2" values="10;38;10" dur="1.8s" begin=".38s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

function Cell({ CS, value, onClick, isWinCell, justPlaced }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean }) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X", isP2 = value === "O";
  const wC = isP1 ? "rgba(0,255,65,.4)" : "rgba(74,222,128,.4)";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        width: CS, height: CS, position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isWinCell ? "radial-gradient(ellipse,rgba(0,200,50,.2),transparent 70%)" : (hov && !value ? "radial-gradient(ellipse,rgba(0,60,15,.2),transparent 70%)" : "transparent"),
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "mxWinPulse 1.05s ease-in-out infinite" : "none",
      }}
    >
      {justPlaced && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse,rgba(0,255,80,.65),transparent 70%)", animation: "mF .55s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />}
      {isP1 && <MatrixBracket size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <BinaryPill size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes mF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.3)}}@keyframes mxWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}

export default function MatrixGrid({ board, onCellClickAction, winCells = [], showLabels = true }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean }) {
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
    if (onCellClickAction) { onCellClickAction?.(r, c); return; }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(0,220,50,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".16em",
    textShadow: "0 0 12px rgba(0,220,50,.8),0 0 24px rgba(0,160,30,.5)",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {showLabels && (
        <div style={{ display: "flex", paddingLeft: PAD + CS * 0.3 }}>
          {COLS.map((c) => <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>{c}</div>)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {showLabels && (
          <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>
            {ROWS.map((r) => <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>{r}</div>)}
          </div>
        )}
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.07, overflow: "hidden", border: "2px solid rgba(0,180,40,.65)", boxShadow: "0 0 0 1px rgba(0,100,20,.3),0 0 45px rgba(0,200,50,.4),0 0 100px rgba(0,80,20,.25),inset 0 0 80px rgba(0,0,0,.65)" }}>
          <MatrixBg W={BS} H={BS} gridSize={SIZE} />
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} />
          <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => (
                  <Cell key={`${r}-${c}`} CS={CS} value={active[r][c]} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={last === `${r}-${c}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

