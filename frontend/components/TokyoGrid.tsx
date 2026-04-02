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
      setCs(Math.max(40, (b - 2 * pad) / size));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad, size]);
  return cs;
}

function TokyoBg({ W, H, gridSize = 5, isPaused = false }: { W: number; H: number; gridSize?: number; isPaused?: boolean }) {
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

    const vC = ["#ff0078", "#ff5500", "#ffe500", "#00ff80", "#00ccff", "#cc00ff", "#ff00ff"];
    const hC = ["#00bbff", "#9900ff", "#ff0055", "#0077ff", "#ff3300", "#00ffbb", "#00ffff"];

    const draw = () => {
      t.current += 0.016;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= SIZE; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const p = 0.6 + 0.4 * Math.sin(tc * 2.2 + i * 0.85);
        const vc = vC[i % vC.length], hc = hC[i % hC.length];

        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 18; ctx.globalAlpha = 0.05 * p;
        if (x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 9; ctx.globalAlpha = 0.16 * p; ctx.shadowColor = vc; ctx.shadowBlur = 22;
        if (x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.strokeStyle = vc; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.72 * p; ctx.shadowColor = vc; ctx.shadowBlur = 18;
        if (x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        ctx.restore();

        ctx.save(); ctx.strokeStyle = hc; ctx.lineWidth = 18; ctx.globalAlpha = 0.05 * p;
        if (y <= H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.strokeStyle = hc; ctx.lineWidth = 9; ctx.globalAlpha = 0.16 * p; ctx.shadowColor = hc; ctx.shadowBlur = 22;
        if (y <= H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore();
      }

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS + CS / 2, ny = PAD + r * CS + CS / 2;
        const fl = 0.5 + 0.5 * Math.abs(Math.sin(tc * 2.6 + (r * SIZE + c)));
        const cc = vC[c % vC.length];
        ctx.save();
        ctx.fillStyle = cc;
        ctx.shadowColor = cc;
        ctx.shadowBlur = 18 * fl;
        ctx.globalAlpha = fl * 0.3;
        ctx.beginPath();
        ctx.arc(nx, ny, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, PAD, CS, SIZE, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

function BurstCanvas({ burstRef, W, H, gridSize = 5 }: { burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>; W: number; H: number; gridSize?: number }) {
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
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (p.type === "spark") {
        p.x += p.vx; p.y += p.vy; p.vx *= 0.91; p.vy *= 0.91; p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.max(0.2, p.alpha), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    if (pts.current.length > 0) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  };

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = boardSkinCanvasDpr(gridSize);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function DragonSeal({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win ? "drop-shadow(0 0 10px #ff0066) drop-shadow(0 0 26px #ff0066)" : "drop-shadow(0 0 6px #ff0066)";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "drIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes drIn{0%{transform:scale(0) rotate(-45deg);opacity:0;filter:blur(8px)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <polygon points="24,4 28,20 44,24 28,28 24,44 20,28 4,24 20,20" fill="#ff0066" opacity="0.12" stroke="#ff0066" strokeWidth="2.2" />
      <circle cx="24" cy="24" r="4" fill="#ff88aa" />
    </svg>
  );
}

function Katana({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win ? "drop-shadow(0 0 10px #00ccff) drop-shadow(0 0 26px #0088ff)" : "drop-shadow(0 0 6px #00ccff)";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "katIn .44s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes katIn{0%{transform:translateY(-20px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>
      <line x1="24" y1="5" x2="24" y2="40" stroke="#00ccff" strokeWidth="3" strokeLinecap="round" />
      <line x1="14" y1="28" x2="34" y2="28" stroke="#00ccff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function TokyoCell({ CS, value, onClick, isWinCell, isP1, isP2 }: { CS: number; value: "X" | "O" | null; onClick: () => void; isWinCell: boolean; isP1: boolean; isP2: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{ width: CS, height: CS, position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: isWinCell ? "rgba(255,0,80,.2)" : hov && !value ? "rgba(255,0,80,.05)" : "transparent", contain: "layout style" }}>
      {isP1 && <DragonSeal size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <Katana size={CS} win={isWinCell} ak={`${value}${CS}`} />}
    </div>
  );
}
const MemoizedTokyoCell = React.memo(TokyoCell);

export default React.memo(function TokyoGrid({ board, onCellClickAction, winCells = [], showLabels = true, cellSize, isPaused = false, graphicsQuality = "quality" }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; cellSize?: number; isPaused?: boolean; graphicsQuality?: "performance" | "quality" }) {
  const active = board ?? Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(null));
  const SIZE = active.length;
  const COLS = GET_COLS(SIZE);
  const ROWS = GET_ROWS(SIZE);
  const PAD = 8;
  const CS = cellSize ?? useCellSize(SIZE, PAD);
  const BS = SIZE * CS + 2 * PAD;
  const [last, setLast] = useState<string | null>(null);
  const winSet = new Set(winCells.map(([r, c]) => `${r}-${c}`));
  const burstRef = useRef<((x: number, y: number, isP1: boolean) => void) | null>(null);
  const lowFx = graphicsQuality === "performance";

  const click = (r: number, c: number) => {
    if (active[r][c]) return;
    if (!lowFx) {
      burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, true);
      setLast(`${r}-${c}`); setTimeout(() => setLast(null), 700);
    }
    onCellClickAction?.(r, c);
  };

  const lbl = { color: "rgba(255,80,140,.9)", fontSize: Math.max(10, CS * 0.13), fontFamily: "'Courier New',monospace", fontWeight: "700" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {showLabels && <div style={{ display: "flex", paddingLeft: PAD + 24 }}>{COLS.map((c) => <div key={c} style={{ width: CS, textAlign: "center", ...lbl }}>{c}</div>)}</div>}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {showLabels && <div style={{ display: "flex", flexDirection: "column", paddingTop: PAD }}>{ROWS.map((r) => <div key={r} style={{ height: CS, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 24, ...lbl }}>{r}</div>)}</div>}
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(255,0,100,.7)", willChange: "transform", contain: "layout size style" }}>
          {lowFx ? (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,2,12,0.98), rgba(8,2,10,0.98))" }} />
          ) : (
            <TokyoBg W={BS} H={BS} gridSize={SIZE} isPaused={isPaused} />
          )}
          <BioStaticGridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} />
          {!lowFx && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {active.map((row, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {row.map((cell, c) => (
                  <MemoizedTokyoCell key={`${r}-${c}`} CS={CS} value={cell} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} isP1={cell === "X"} isP2={cell === "O"} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
