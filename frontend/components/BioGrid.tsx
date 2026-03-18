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

function BioBg({ W, H }: { W: number; H: number }) {
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

    const creatures = Array.from({ length: 14 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * W * 0.06 + W * 0.025,
      phase: Math.random() * Math.PI * 2,
      spd: 0.007 + Math.random() * 0.007,
      col: ["0,255,180", "0,200,255", "120,255,80", "200,80,255", "0,255,120"][Math.floor(Math.random() * 5)],
      vx: Math.random() * 0.25 - 0.125,
      vy: Math.random() * 0.25 - 0.125,
    }));
    const tendrils = Array.from({ length: 10 }, (_, i) => ({
      x: W * (0.08 + i * 0.085),
      y: H,
      col: ["0,220,200", "0,180,255", "80,255,160", "180,0,255", "0,255,180"][Math.floor(Math.random() * 5)],
      phase: Math.random() * Math.PI * 2,
      amp: W * 0.04 + Math.random() * W * 0.03,
      len: H * (0.3 + Math.random() * 0.55),
      segs: 12,
    }));
    const spores = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vy: -(Math.random() * 0.3 + 0.2),
      phase: Math.random() * Math.PI * 2,
      col: ["0,255,180", "0,220,255", "120,255,100"][Math.floor(Math.random() * 3)],
    }));

    const draw = () => {
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.8);
      bg.addColorStop(0, "#000a0f");
      bg.addColorStop(0.5, "#000608");
      bg.addColorStop(1, "#000304");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      tendrils.forEach((td: any) => {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = `rgb(${td.col})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = `rgb(${td.col})`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(td.x, H);
        for (let j = 1; j <= td.segs; j++) {
          const pg = j / td.segs;
          const wy = H - td.len * pg;
          const wx = td.x + td.amp * Math.sin(tc * 0.6 + td.phase + pg * 3.5);
          ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.restore();
      });

      creatures.forEach((c: any) => {
        c.x += c.vx;
        c.y += c.vy;
        if (c.x < -c.r) c.x = W + c.r;
        if (c.x > W + c.r) c.x = -c.r;
        if (c.y < -c.r) c.y = H + c.r;
        if (c.y > H + c.r) c.y = -c.r;
        c.phase += c.spd;
        const pl = 0.3 + 0.7 * Math.abs(Math.sin(c.phase));
        for (let ring = 5; ring >= 1; ring--) {
          const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * ring * 0.38 * pl);
          rg.addColorStop(0, `rgba(${c.col},${0.14 * ring * pl})`);
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * ring * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.fillStyle = `rgba(${c.col},${0.85 * pl})`;
        ctx.shadowColor = `rgb(${c.col})`;
        ctx.shadowBlur = 18 * pl;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      spores.forEach((s: any) => {
        s.y += s.vy;
        s.x += Math.sin(s.phase + tc * 0.5) * 0.35;
        s.phase += 0.018;
        if (s.y < -5) {
          s.y = H + 5;
          s.x = Math.random() * W;
        }
        const br = 0.4 + 0.6 * Math.abs(Math.sin(tc * 2 + s.phase));
        ctx.save();
        ctx.globalAlpha = 0.7 * br;
        ctx.fillStyle = `rgb(${s.col})`;
        ctx.shadowColor = `rgb(${s.col})`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      [
        [W * 0.2, H * 0.6, "rgba(0,200,150,.06)"],
        [W * 0.8, H * 0.3, "rgba(0,100,200,.05)"],
        [W * 0.5, H * 0.9, "rgba(80,0,180,.04)"],
      ].forEach(([gx, gy, col]) => {
        const gg = ctx.createRadialGradient(gx as number, gy as number, 0, gx as number, gy as number, W * 0.4);
        gg.addColorStop(0, col as string);
        gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, W, H);
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
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= 5; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const bio = 0.6 + 0.4 * Math.sin(tc * 0.9 + i * 1.3);

        ctx.save();
        ctx.strokeStyle = "rgba(0,255,200,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,240,180,${0.2 * bio})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,255,180,.7)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,255,200,${0.72 * bio})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,255,200,1)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(180,255,240,${0.92 * bio})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.8)";
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(120,0,255,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(140,80,255,${0.18 * bio})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(160,80,255,.7)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(180,100,255,${0.72 * bio})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(200,100,255,1)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(220,200,255,${0.92 * bio})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.8)";
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const pl = 0.4 + 0.6 * Math.abs(Math.sin(tc * 1.8 + (r * 6 + c) * 1.1));
        const cc = (r + c) % 2 === 0 ? "0,255,200" : "180,100,255";
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12 * pl);
        ng.addColorStop(0, `rgba(${cc},${0.4 * pl})`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, 12 * pl, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = `rgba(${cc},${0.9 * pl})`;
        ctx.shadowColor = `rgb(${cc})`;
        ctx.shadowBlur = 16 * pl;
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fill();
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
    const c1 = isP1 ? [0, 255, 200] : [180, 100, 255];
    const c2 = isP1 ? [0, 180, 255] : [0, 255, 140];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.05), alpha: 1 - i * 0.2, col: i % 2 === 0 ? c1 : c2, decay: 0.022 + i * 0.007, w: 3.5 - i * 0.5 });
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2 + Math.random() * 4.5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: Math.random() * 2.5 + 0.8, alpha: 1, col: Math.random() > 0.5 ? c1 : c2, decay: 0.025 + Math.random() * 0.02 });
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
        ctx.lineWidth = (p.w || 2.5) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.9)`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "spark") {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vy += 0.03;
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

function Jellyfish({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #00ffcc) drop-shadow(0 0 26px #00ffaa) drop-shadow(0 0 55px rgba(0,255,180,.6))"
    : "drop-shadow(0 0 6px #00ffcc) drop-shadow(0 0 18px rgba(0,255,180,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "jelIn .52s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes jelIn{0%{transform:translateY(${size * 0.7}px) scale(.4);opacity:0}58%{transform:translateY(-${size * 0.05}px) scale(1.15);opacity:1}80%{transform:translateY(${size * 0.01}px) scale(.93)}100%{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <path d="M7,22 Q7,4 24,4 Q41,4 41,22 Z" fill="none" stroke="#00ffcc" strokeWidth="2.2" strokeDasharray="62" strokeDashoffset="62">
        <animate attributeName="stroke-dashoffset" from="62" to="0" dur=".22s" fill="freeze" />
      </path>
      <path d="M7,22 Q7,4 24,4 Q41,4 41,22 Z" fill="rgba(0,255,200,.1)" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".2s" fill="freeze" />
      </path>
      {[
        [12, 22, 10, 46],
        [16, 22, 14, 44],
        [20, 22, 20, 48],
        [24, 22, 24, 46],
        [28, 22, 28, 44],
        [32, 22, 34, 48],
        [36, 22, 38, 44],
      ].map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1},${y1} Q${(x1 + x2) / 2 + Math.sin(i) * 3},${(y1 + y2) * 0.55} ${x2},${y2}`} fill="none" stroke="#00ffcc" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="28">
          <animate attributeName="stroke-dashoffset" from="28" to="0" dur=".14s" begin={`${0.2 + i * 0.04}s`} fill="freeze" />
        </path>
      ))}
      {[
        [14, 13],
        [24, 9],
        [34, 13],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.8" fill="#80ffee" opacity="0">
          <animate attributeName="opacity" values="0;.9;.3;.9;0" dur="2s" begin={`${0.32 + i * 0.15}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function AnglerFish({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #b464ff) drop-shadow(0 0 26px #8000ff) drop-shadow(0 0 55px rgba(140,0,255,.6))"
    : "drop-shadow(0 0 6px #b464ff) drop-shadow(0 0 18px rgba(140,0,255,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "angIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes angIn{0%{transform:scale(0) rotate(-25deg);opacity:0}55%{transform:scale(1.22) rotate(8deg);opacity:1}80%{transform:scale(.92) rotate(-3deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <path d="M6,28 Q4,18 12,14 Q10,10 18,10 Q18,6 24,6 Q30,6 30,10 Q38,10 36,14 Q44,18 42,28 Q40,36 24,38 Q8,36 6,28Z" fill="none" stroke="#b464ff" strokeWidth="2" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur=".3s" fill="freeze" />
      </path>
      <path d="M6,28 Q4,18 12,14 Q10,10 18,10 Q18,6 24,6 Q30,6 30,10 Q38,10 36,14 Q44,18 42,28 Q40,36 24,38 Q8,36 6,28Z" fill="#6000aa" opacity="0">
        <animate attributeName="opacity" from="0" to=".15" dur=".07s" begin=".28s" fill="freeze" />
      </path>
      {[
        [16, 22, 6, 18],
        [18, 22, 5, 25],
        [32, 22, 42, 18],
        [30, 22, 43, 25],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d090ff" strokeWidth="1.5" strokeLinecap="round" opacity="0">
          <animate attributeName="opacity" from="0" to=".7" dur=".06s" begin={`${0.28 + i * 0.04}s`} fill="freeze" />
        </line>
      ))}
      <ellipse cx="17" cy="20" rx="4" ry="4.5" fill="#110020" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".05s" begin=".32s" fill="freeze" />
      </ellipse>
      <circle cx="17" cy="20" r="2" fill="#d090ff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".05s" begin=".33s" fill="freeze" />
      </circle>
      <ellipse cx="31" cy="20" rx="4" ry="4.5" fill="#110020" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".05s" begin=".32s" fill="freeze" />
      </ellipse>
      <circle cx="31" cy="20" r="2" fill="#d090ff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".05s" begin=".34s" fill="freeze" />
        <animate attributeName="r" values="1.5;3;1.5" dur="1.6s" begin=".5s" repeatCount="indefinite" />
      </circle>
      <path d="M24,6 L24,2" stroke="#e0b0ff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="0" r="3" fill="#e0b0ff">
        <animate attributeName="r" values="2;4;2" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="fill" values="#e0b0ff;#ffffff;#e0b0ff" dur="1.4s" repeatCount="indefinite" />
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
  const wC = isP1 ? "rgba(0,255,200,.4)" : "rgba(180,100,255,.4)";
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
          ? `radial-gradient(ellipse,${isP1 ? "rgba(0,200,160,.22)" : "rgba(140,80,200,.22)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(0,150,120,.15),transparent 70%)"
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "bioWinPulse 1.05s ease-in-out infinite" : "none",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "0,255,200" : "180,100,255"},.75),transparent 65%)`,
            animation: "bF .55s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <Jellyfish size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <AnglerFish size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes bF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}@keyframes bioWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}

export default function BioGrid({
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
    color: "rgba(0,230,190,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Trebuchet MS',sans-serif",
    fontWeight: "700",
    letterSpacing: ".15em",
    textShadow: "0 0 14px rgba(0,255,190,.9),0 0 28px rgba(0,200,150,.5)",
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
        <div
          style={{
            position: "relative",
            width: BS,
            height: BS,
            borderRadius: CS * 0.06,
            overflow: "hidden",
            border: "2px solid rgba(0,200,160,.65)",
            boxShadow: "0 0 0 1px rgba(80,0,180,.3),0 0 45px rgba(0,180,140,.45),0 0 100px rgba(0,80,60,.3),inset 0 0 80px rgba(0,5,15,.6)",
          }}
        >
          <BioBg W={BS} H={BS} />
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

