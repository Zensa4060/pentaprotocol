"use client";
import React, { useEffect, useRef, useState } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";
import BioStaticGridLines from "./BioStaticGridLines";

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

function ForgeBg({ W, H, gridSize = 5, isPaused = false }: { W: number; H: number; gridSize?: number; isPaused?: boolean }) {
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

    const embers = Array.from({ length: 35 }, () => ({
      x: Math.random() * W,
      y: H + Math.random() * 50,
      vx: Math.random() * 0.6 - 0.3,
      vy: -(1.5 + Math.random() * 2),
      r: Math.random() * 3 + 0.8,
      col: [255, Math.floor(50 + Math.random() * 130), 0],
      a: 0.9,
    }));

    const veins = Array.from({ length: 18 }, () => {
      const pts: { x: number; y: number }[] = [];
      let cx = Math.random() * W;
      let cy = Math.random() * H;
      for (let i = 0; i < 6; i++) {
        pts.push({ x: cx, y: cy });
        cx += Math.random() * W * 0.2 - W * 0.1;
        cy += Math.random() * H * 0.2 - H * 0.1;
      }
      return {
        pts,
        col: ["#ff4500", "#ff6600", "#ff8c00", "#ffaa00"][Math.floor(Math.random() * 4)],
        phase: Math.random() * Math.PI * 2,
        w: Math.random() * 2.5 + 1,
      };
    });

    const pools = [
      { cx: W * 0.22, cy: H * 0.78, rx: W * 0.2, ry: H * 0.1 },
      { cx: W * 0.68, cy: H * 0.84, rx: W * 0.24, ry: H * 0.1 },
      { cx: W * 0.88, cy: H * 0.62, rx: W * 0.1, ry: H * 0.16 },
    ];

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0200");
      bg.addColorStop(0.5, "#150400");
      bg.addColorStop(1, "#080100");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      pools.forEach((p) => {
        const pl = 0.6 + 0.4 * Math.sin(tc * 0.7 + p.cx);
        ctx.save();
        ctx.scale(1, p.ry / p.rx);
        const pg = ctx.createRadialGradient(p.cx, p.cy * (p.rx / p.ry), 0, p.cx, p.cy * (p.rx / p.ry), p.rx);
        pg.addColorStop(0, `rgba(255,200,0,${0.9 * pl})`);
        pg.addColorStop(0.3, `rgba(255,80,0,${0.7 * pl})`);
        pg.addColorStop(0.7, `rgba(180,20,0,${0.35 * pl})`);
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy * (p.rx / p.ry), p.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const hg = ctx.createLinearGradient(0, H, 0, H * 0.3);
      hg.addColorStop(0, `rgba(180,40,0,${0.22 + 0.08 * Math.sin(tc * 0.8)})`);
      hg.addColorStop(0.5, "rgba(80,10,0,.08)");
      hg.addColorStop(1, "transparent");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);

      [
        [0, H * 0.4],
        [W, H * 0.5],
      ].forEach(([gx, gy], i) => {
        const gg = ctx.createRadialGradient(gx as number, gy as number, 0, gx as number, gy as number, W * 0.45);
        gg.addColorStop(0, `rgba(255,${80 + 40 * Math.sin(tc + i)},0,${0.12 + 0.05 * Math.sin(tc * 0.7 + i)})`);
        gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, W, H);
      });

      veins.forEach((v: any) => {
        const pl = 0.35 + 0.65 * Math.abs(Math.sin(tc * 0.45 + v.phase));
        ctx.save();
        ctx.strokeStyle = v.col;
        ctx.lineWidth = v.w;
        ctx.globalAlpha = pl * 0.55;
        ctx.shadowColor = v.col;
        ctx.shadowBlur = 8 * pl;
        ctx.beginPath();
        ctx.moveTo(v.pts[0].x, v.pts[0].y);
        for (let j = 1; j < v.pts.length - 1; j++) {
          const mx = (v.pts[j].x + v.pts[j + 1].x) / 2;
          const my = (v.pts[j].y + v.pts[j + 1].y) / 2;
          ctx.quadraticCurveTo(v.pts[j].x, v.pts[j].y, mx, my);
        }
        ctx.stroke();
        ctx.restore();
      });

      embers.forEach((e: any) => {
        e.x += e.vx;
        e.y += e.vy;
        e.vy += 0.02;
        e.a -= 0.007;
        if (e.y < -10 || e.a < 0) {
          e.y = H + 5;
          e.x = Math.random() * W;
          e.vy = -(1.5 + Math.random() * 2);
          e.a = 0.9;
        }
        ctx.save();
        ctx.globalAlpha = e.a;
        ctx.fillStyle = `rgb(${e.col})`;
        ctx.shadowColor = `rgba(${e.col},.9)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        const heat = 0.6 + 0.4 * Math.abs(Math.sin(tc * 1.9 + i * 1.15 + Math.sin(tc * 5 + i) * 0.15));
        const tempCol = heat > 0.82 ? "#ffcc00" : heat > 0.66 ? "#ff6600" : "#ff3300";

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 18;
        ctx.globalAlpha = 0.06 * heat;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 9;
        ctx.globalAlpha = 0.16 * heat;
        ctx.shadowColor = tempCol;
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.76 * heat;
        ctx.shadowColor = tempCol;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(255,240,200,.92)";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.88 * heat;
        ctx.shadowColor = "#ffcc00";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 18;
        ctx.globalAlpha = 0.06 * heat;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 9;
        ctx.globalAlpha = 0.16 * heat;
        ctx.shadowColor = tempCol;
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = tempCol;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.76 * heat;
        ctx.shadowColor = tempCol;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(255,240,200,.92)";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.88 * heat;
        ctx.shadowColor = "#ffcc00";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const fl = 0.4 + 0.6 * Math.abs(Math.sin(tc * 2.3 + (r * 6 + c) * 0.8));
        ctx.save();
        ctx.fillStyle = "#ffcc00";
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 18 * fl;
        ctx.globalAlpha = fl;
        ctx.beginPath();
        ctx.moveTo(nx, ny - 5 * fl);
        ctx.lineTo(nx + 5 * fl, ny);
        ctx.lineTo(nx, ny + 5 * fl);
        ctx.lineTo(nx - 5 * fl, ny);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "rgba(255,255,200,.9)";
        ctx.beginPath();
        ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
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
    const hot = isP1 ? [255, 100, 0] : [255, 200, 0];
    for (let i = 0; i < 3; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.08 + i * 0.05), alpha: 1 - i * 0.25, col: hot, decay: 0.03 + i * 0.01, w: 4 - i });
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * 2 * Math.random(), s = 3 + Math.random() * 6;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 3 + 1, alpha: 1, col: [255, Math.floor(60 + Math.random() * 150), 0], decay: 0.025 + Math.random() * 0.025 });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 2 * i / 6;
      pts.current.push({ type: "ray", x, y, a, len: 0, maxLen: W * 0.12, alpha: 1, col: [255, 160, 0], decay: 0.045 });
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
        ctx.lineWidth = (p.w || 3) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.9)`;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "spark") {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.vy += 0.08;
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
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.shadowBlur = 14;
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

function Hammer({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #ff6600) drop-shadow(0 0 26px #ff4400) drop-shadow(0 0 55px rgba(255,80,0,.6))"
    : "drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 18px rgba(255,80,0,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "hamIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes hamIn{0%{transform:translateY(-${size * 0.8}px) rotate(-30deg) scale(.4);opacity:0}58%{transform:translateY(${size * 0.06}px) rotate(8deg) scale(1.15);opacity:1}78%{transform:rotate(-3deg) scale(.93)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <rect x="16" y="6" width="22" height="14" rx="3" fill="none" stroke="#ff6600" strokeWidth="2.2" strokeDasharray="72" strokeDashoffset="72">
        <animate attributeName="stroke-dashoffset" from="72" to="0" dur=".24s" fill="freeze" />
      </rect>
      <rect x="16" y="6" width="22" height="14" rx="3" fill="#ff4400" opacity="0">
        <animate attributeName="opacity" from="0" to=".2" dur=".07s" begin=".22s" fill="freeze" />
      </rect>
      <rect x="21" y="20" width="6" height="22" rx="2" fill="none" stroke="#cc4400" strokeWidth="2" strokeDasharray="56" strokeDashoffset="56">
        <animate attributeName="stroke-dashoffset" from="56" to="0" dur=".18s" begin=".2s" fill="freeze" />
      </rect>
      <rect x="21" y="20" width="6" height="22" rx="2" fill="#aa3300" opacity="0">
        <animate attributeName="opacity" from="0" to=".6" dur=".07s" begin=".36s" fill="freeze" />
      </rect>
      {[
        [14, 8],
        [38, 8],
        [14, 19],
        [38, 19],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.5" fill="#ffcc00" opacity="0">
          <animate attributeName="opacity" values="0;1;.3;1;0" dur="1.5s" begin={`${0.3 + i * 0.1}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function MoltenSigil({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #ffaa00) drop-shadow(0 0 26px #ff8800) drop-shadow(0 0 55px rgba(255,160,0,.6))"
    : "drop-shadow(0 0 6px #ffaa00) drop-shadow(0 0 18px rgba(255,160,0,.7))";
  const arms = Array.from({ length: 6 }, (_, i) => i * 60 * Math.PI / 180);
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "sigilIn .5s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes sigilIn{0%{transform:scale(0) rotate(120deg);opacity:0}55%{transform:scale(1.3) rotate(-10deg);opacity:1}80%{transform:scale(.92) rotate(4deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <circle cx="24" cy="24" r="19" fill="none" stroke="#ffaa00" strokeWidth="1.8" strokeDasharray="120" strokeDashoffset="120">
        <animate attributeName="stroke-dashoffset" from="120" to="0" dur=".26s" fill="freeze" />
      </circle>
      {arms.map((a, i) => (
        <line key={i} x1={24} y1={24} x2={24 + 19 * Math.cos(a)} y2={24 + 19 * Math.sin(a)} stroke="#ff8800" strokeWidth="2" strokeDasharray="19" strokeDashoffset="19">
          <animate attributeName="stroke-dashoffset" from="19" to="0" dur=".12s" begin={`${0.1 + i * 0.04}s`} fill="freeze" />
        </line>
      ))}
      <circle cx="24" cy="24" r="7" fill="none" stroke="#ffcc00" strokeWidth="1.5" strokeDasharray="44" strokeDashoffset="44">
        <animate attributeName="stroke-dashoffset" from="44" to="0" dur=".14s" begin=".22s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="3.5" fill="#ffee80" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".34s" fill="freeze" />
        <animate attributeName="r" values="3;5;3" dur="2s" begin=".5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function ForgeCell({ CS, value, onClick, isWinCell, justPlaced, lastTurn, isP1, isP2 }: { CS: number; value: "X" | "O" | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O"; isP1: boolean; isP2: boolean }) {
  const [hov, setHov] = useState(false);
  const wC = isP1 ? "rgba(255,80,0,.4)" : "rgba(255,180,0,.4)";
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
          ? `radial-gradient(ellipse,${isP1 ? "rgba(255,60,0,.22)" : "rgba(255,160,0,.22)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(180,40,0,.14),transparent 70%)"
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "fgWinPulse 1.05s ease-in-out infinite" : "none",
        contain: "layout style",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "255,80,0" : "255,200,0"},.75),transparent 65%)`,
            animation: "fF .55s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <Hammer size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <MoltenSigil size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes fF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}@keyframes fgWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}
const MemoizedForgeCell = React.memo(ForgeCell);

export default React.memo(function ForgeGrid({ board, onCellClickAction, winCells = [], showLabels = true, isPaused = false, graphicsQuality = "quality" }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; isPaused?: boolean; graphicsQuality?: "performance" | "quality" }) {
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
  const lowFx = graphicsQuality === "performance";

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    if (!lowFx) {
      burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
      setLast(`${r}-${c}`);
      setTimeout(() => setLast(null), 700);
    }
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
    color: "rgba(255,140,0,.95)",
    fontSize: fs(0.13),
    fontFamily: "'Georgia',serif",
    fontWeight: "700",
    letterSpacing: ".14em",
    textShadow: "0 0 14px rgba(255,100,0,1),0 0 28px rgba(200,60,0,.6)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.05, overflow: "hidden", border: "3px solid rgba(200,60,0,.8)", boxShadow: "0 0 0 1px rgba(255,120,0,.3),0 0 50px rgba(200,60,0,.6),0 0 120px rgba(80,20,160,.4),inset 0 0 80px rgba(0,0,0,.65)", willChange: "transform", contain: "layout size style" }}>
          {lowFx ? (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(28,8,2,0.98), rgba(12,4,1,0.98))" }} />
          ) : (
            <ForgeBg W={BS} H={BS} gridSize={SIZE} isPaused={isPaused} />
          )}
          <BioStaticGridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} />
          {!lowFx && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => {
                  const val = active[r][c] as "X" | "O" | null;
                  return (
                    <MemoizedForgeCell
                      key={`${r}-${c}`}
                      CS={CS}
                      value={val}
                      onClick={() => click(r, c)}
                      isWinCell={winSet.has(`${r}-${c}`)}
                      justPlaced={!lowFx && last === `${r}-${c}`}
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
