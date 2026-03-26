"use client";
import React, { useEffect, useRef, useState } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";

const DEFAULT_SIZE = 5;
type GraphicsQuality = "low" | "balanced" | "ultra";
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

function EgyptBg({ W, H, gridSize = 5, graphicsQuality = "balanced" }: { W: number; H: number; gridSize?: number; graphicsQuality?: GraphicsQuality }) {
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

    const hieroglyphs = ["𓀀", "𓁀", "𓂀", "𓃀", "𓄀", "𓅀", "𓆀", "𓇀", "𓈀", "𓉀", "𓊀", "𓋀", "𓌀", "𓍀", "𓎀", "𓏀"].filter(Boolean);
    const hGlyphs = Array.from({ length: 12 }, (_, i) => ({
      x: W * (0.04 + i * 0.085),
      y: H * (0.55 + Math.sin(i) * 0.05),
      char: hieroglyphs[i % hieroglyphs.length] || "☥",
      phase: Math.random() * Math.PI * 2,
      spd: 0.005 + Math.random() * 0.005,
    }));
    const grains = Array.from({ length: 22 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: 0.5 + Math.random() * 0.5,
      vy: Math.random() * 0.2 - 0.1,
      col: [[210, 170, 80], [190, 140, 60], [230, 190, 100], [170, 120, 40]][Math.floor(Math.random() * 4)],
    }));
    const dunes = [
      { pts: [{ x: 0, y: H }, { x: 0, y: H * 0.7 }, { x: W * 0.15, y: H * 0.5 }, { x: W * 0.3, y: H * 0.65 }, { x: W * 0.45, y: H * 0.45 }, { x: W * 0.6, y: H * 0.6 }, { x: W * 0.75, y: H * 0.4 }, { x: W * 0.9, y: H * 0.55 }, { x: W, y: H * 0.6 }, { x: W, y: H }] },
      { pts: [{ x: 0, y: H }, { x: 0, y: H * 0.85 }, { x: W * 0.2, y: H * 0.75 }, { x: W * 0.4, y: H * 0.88 }, { x: W * 0.6, y: H * 0.78 }, { x: W * 0.8, y: H * 0.9 }, { x: W, y: H * 0.8 }, { x: W, y: H }] },
    ];
    const pyramids = [{ x: W * 0.05, tip: H * 0.25, base: W * 0.22 }, { x: W * 0.6, tip: H * 0.15, base: W * 0.3 }];

    let frameSkip = 0;
    const draw = () => {
      if (graphicsQuality === "balanced") {
        frameSkip = (frameSkip + 1) % 2;
        if (frameSkip !== 0) {
          raf.current = requestAnimationFrame(draw);
          return;
        }
      }
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#04020a");
      bg.addColorStop(0.4, "#0a0500");
      bg.addColorStop(1, "#060300");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 40; i++) {
        const sx = W * (((i * 137.5 + 7) % 100) / 100);
        const sy = H * (((i * 97.3 + 13) % 60) / 100);
        const sb = 0.3 + 0.5 * Math.abs(Math.sin(tc * 0.8 + i));
        ctx.save();
        ctx.globalAlpha = sb * 0.8;
        ctx.fillStyle = "#ffeecc";
        ctx.shadowColor = "#ffeecc";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const mg = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, W * 0.08);
      mg.addColorStop(0, "rgba(255,240,200,.9)");
      mg.addColorStop(0.7, "rgba(220,200,140,.4)");
      mg.addColorStop(1, "transparent");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.1, W * 0.08, 0, Math.PI * 2);
      ctx.fill();

      pyramids.forEach((p) => {
        ctx.save();
        ctx.fillStyle = "rgba(20,12,2,.85)";
        ctx.shadowColor = "rgba(180,120,30,.15)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(p.x + p.base / 2, p.tip);
        ctx.lineTo(p.x + p.base, H * 0.65);
        ctx.lineTo(p.x, H * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(180,120,30,.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      });

      const hg = ctx.createRadialGradient(W * 0.5, H * 1.1, 0, W * 0.5, H * 1.1, H);
      hg.addColorStop(0, `rgba(180,100,10,${0.16 + 0.06 * Math.sin(tc * 0.6)})`);
      hg.addColorStop(0.5, "rgba(80,40,0,.05)");
      hg.addColorStop(1, "transparent");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);

      dunes.forEach((d, di) => {
        ctx.save();
        const sandG = ctx.createLinearGradient(0, H * 0.4, 0, H);
        sandG.addColorStop(0, "rgba(140,80,20,.7)");
        sandG.addColorStop(1, "rgba(80,40,5,.8)");
        ctx.fillStyle = sandG;
        ctx.globalAlpha = 0.8 - di * 0.3;
        ctx.beginPath();
        ctx.moveTo(d.pts[0].x, d.pts[0].y);
        d.pts.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(160,90,20,.2)";
      ctx.fillRect(0, H * 0.5, W, H * 0.08);
      ctx.restore();

      hGlyphs.forEach((g) => {
        g.phase += g.spd;
        const br = 0.2 + 0.3 * Math.abs(Math.sin(g.phase));
        ctx.save();
        ctx.globalAlpha = br;
        ctx.fillStyle = "rgba(200,150,50,.8)";
        ctx.font = `${W * 0.03}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(g.char, g.x, g.y);
        ctx.restore();
      });

      grains.forEach((g: any) => {
        g.x += g.vx;
        g.y += g.vy + Math.sin(tc * 0.5 + g.x * 0.03) * 0.2;
        if (g.x > W + 5) { g.x = -5; g.y = Math.random() * H; }
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = `rgb(${g.col})`;
        ctx.shadowColor = `rgba(${g.col},.4)`;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize, graphicsQuality]);

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
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i <= SIZE; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const hw = 0.6 + 0.4 * Math.sin(tc * 0.8 + i * 1.0);

        ctx.save();
        ctx.strokeStyle = "rgba(200,130,20,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        for (let py = 0; py <= H; py += 4) ctx.lineTo(x + Math.sin(tc * 1.2 + py * 0.05) * 2, py);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        for (let py = 0; py <= H; py += 3) ctx.lineTo(x + Math.sin(tc * 1.2 + py * 0.05) * 1.5, py);
        ctx.strokeStyle = `rgba(220,140,30,${0.2 * hw})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(240,160,0,.8)";
        ctx.shadowBlur = 26;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        for (let py = 0; py <= H; py += 3) ctx.lineTo(x + Math.sin(tc * 1.2 + py * 0.05) * 1.5, py);
        ctx.strokeStyle = `rgba(255,170,40,${0.74 * hw})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(255,180,0,1)";
        ctx.shadowBlur = 22;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,235,150,${0.9 * hw})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,200,.9)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(180,80,10,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        for (let px = 0; px <= W; px += 4) ctx.lineTo(px, y + Math.sin(tc * 1.0 + px * 0.05) * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        for (let px = 0; px <= W; px += 3) ctx.lineTo(px, y + Math.sin(tc * 1.0 + px * 0.05) * 1.5);
        ctx.strokeStyle = `rgba(200,100,20,${0.18 * hw})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(220,110,0,.8)";
        ctx.shadowBlur = 26;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        for (let px = 0; px <= W; px += 3) ctx.lineTo(px, y + Math.sin(tc * 1.0 + px * 0.05) * 1.5);
        ctx.strokeStyle = `rgba(230,120,30,${0.7 * hw})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(250,130,0,1)";
        ctx.shadowBlur = 22;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,220,160,${0.9 * hw})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,240,180,.9)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const fl = 0.4 + 0.6 * Math.abs(Math.sin(tc * 1.4 + (r * 6 + c) * 0.8));
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, CS * 0.1);
        ng.addColorStop(0, `rgba(255,180,30,${0.95 * fl})`);
        ng.addColorStop(0.4, `rgba(200,100,0,${0.5 * fl})`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.shadowColor = "rgba(255,160,0,1)";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(nx, ny, 4.5 * fl, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.strokeStyle = `rgba(255,220,100,${0.7 * fl})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nx, ny - 5 * fl);
        ctx.lineTo(nx, ny + 5 * fl);
        ctx.moveTo(nx - 3 * fl, ny - 1 * fl);
        ctx.lineTo(nx + 3 * fl, ny - 1 * fl);
        ctx.stroke();
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

  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [74, 222, 128] : [192, 132, 252];
    const sand = [210, 170, 80];
    pts.current.push({ type: "ring", x, y, r: 0, maxR: W * 0.08, alpha: 0.7, col: sand, decay: 0.028 });
    for (let i = 0; i < 3; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.05 + i * 0.04), alpha: 0.8 - i * 0.2, col: c1, decay: 0.03 + i * 0.01 });
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * 2 * i / 24 + Math.random() * 0.4, s = 1.6 + Math.random() * 4;
      pts.current.push({ type: "grain", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.2 + 0.6, alpha: 0.9, col: Math.random() > 0.5 ? sand : [190, 140, 60], decay: 0.025 + Math.random() * 0.02, rot: Math.random() * 360 });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2 + Math.random() * 3.5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.2 + 0.8, alpha: 1, col: c1, decay: 0.04 + Math.random() * 0.03 });
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
        ctx.lineWidth = 2 * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.6)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "grain") {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.93; p.vy *= 0.93; p.vy += 0.04;
        p.rot += 4;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
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

function AnkhSymbol({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 26px #f59e0b) drop-shadow(0 0 55px rgba(251,191,36,.6))"
    : "drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 18px rgba(251,191,36,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "ankhIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes ankhIn{0%{transform:translateY(-${size * 0.7}px) scale(.4);opacity:0}58%{transform:translateY(${size * 0.05}px) scale(1.14);opacity:1}80%{transform:translateY(0) scale(.93)}100%{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <line x1="24" y1="22" x2="24" y2="44" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="22" strokeDashoffset="22">
        <animate attributeName="stroke-dashoffset" from="22" to="0" dur=".14s" fill="freeze" />
      </line>
      <line x1="10" y1="28" x2="38" y2="28" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="28">
        <animate attributeName="stroke-dashoffset" from="28" to="0" dur=".16s" begin=".12s" fill="freeze" />
      </line>
      <ellipse cx="24" cy="16" rx="11" ry="9" fill="none" stroke="#fbbf24" strokeWidth="2.8" strokeDasharray="62" strokeDashoffset="62">
        <animate attributeName="stroke-dashoffset" from="62" to="0" dur=".22s" begin=".1s" fill="freeze" />
      </ellipse>
      <ellipse cx="24" cy="16" rx="11" ry="9" fill="#fbbf24" opacity="0">
        <animate attributeName="opacity" from="0" to=".1" dur=".07s" begin=".3s" fill="freeze" />
      </ellipse>
      <line x1="24" y1="22" x2="24" y2="44" stroke="rgba(255,255,200,.5)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function EyeOfRa({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #c084fc) drop-shadow(0 0 26px #a855f7) drop-shadow(0 0 55px rgba(192,132,252,.6))"
    : "drop-shadow(0 0 6px #c084fc) drop-shadow(0 0 18px rgba(192,132,252,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "eyeRaIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes eyeRaIn{0%{transform:scale(0) rotate(-20deg);opacity:0}55%{transform:scale(1.22) rotate(8deg);opacity:1}80%{transform:scale(.92) rotate(-3deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <path d="M4,24 Q24,6 44,24 Q24,42 4,24Z" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="80">
        <animate attributeName="stroke-dashoffset" from="80" to="0" dur=".26s" fill="freeze" />
      </path>
      <path d="M4,24 Q24,6 44,24 Q24,42 4,24Z" fill="#c084fc" opacity="0">
        <animate attributeName="opacity" from="0" to=".1" dur=".07s" begin=".24s" fill="freeze" />
      </path>
      <circle cx="24" cy="24" r="8" fill="none" stroke="#e9d5ff" strokeWidth="1.5" strokeDasharray="50" strokeDashoffset="50">
        <animate attributeName="stroke-dashoffset" from="50" to="0" dur=".18s" begin=".16s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="4.5" fill="#110020" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".06s" begin=".3s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="2.5" fill="#e9d5ff" opacity="0">
        <animate attributeName="opacity" from="0" to=".9" dur=".06s" begin=".32s" fill="freeze" />
        <animate attributeName="r" values="2;3.5;2" dur="2s" begin=".5s" repeatCount="indefinite" />
      </circle>
      <line x1="24" y1="4" x2="24" y2="10" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".06s" begin=".34s" fill="freeze" />
      </line>
      {([[-15, 8], [-18, 15], [-8, 22], [8, 22], [18, 15], [15, 8]] as const).map(([ex, ey], i) => (
        <line key={i} x1={24} y1={24} x2={24 + ex} y2={24 + ey} stroke="#c084fc" strokeWidth=".8" strokeLinecap="round" opacity="0">
          <animate attributeName="opacity" from="0" to=".5" dur=".04s" begin={`${0.36 + i * 0.03}s`} fill="freeze" />
        </line>
      ))}
    </svg>
  );
}

function Cell({ CS, value, onClick, isWinCell, justPlaced, lastTurn }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O" }) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X", isP2 = value === "O";
  const wC = isP1 ? "rgba(251,191,36,.4)" : "rgba(192,132,252,.4)";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        width: CS, height: CS, position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isWinCell ? `radial-gradient(ellipse,${isP1 ? "rgba(200,140,0,.22)" : "rgba(150,80,200,.22)"},transparent 70%)` : (hov && !value ? "radial-gradient(ellipse,rgba(80,50,5,.18),transparent 70%)" : "transparent"),
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "egWinPulse 1.05s ease-in-out infinite" : "none",
      }}
    >
      {justPlaced && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "220,160,0" : "180,100,240"},.75),transparent 65%)`, animation: "egF .6s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />}
      {isP1 && <AnkhSymbol size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <EyeOfRa size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes egF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.3)}}@keyframes egWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}

export default function EgyptGrid({ board, onCellClickAction, winCells = [], showLabels = true, graphicsQuality = "balanced" }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; graphicsQuality?: GraphicsQuality }) {
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
    if (graphicsQuality !== "low") {
      burstRef.current?.(PAD + c * CS + CS / 2, PAD + r * CS + CS / 2, turn === "X");
      setLast(`${r}-${c}`);
      setTimeout(() => setLast(null), 700);
    }
    if (onCellClickAction) { onCellClickAction?.(r, c); return; }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(220,160,40,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Palatino Linotype',Palatino,serif",
    fontWeight: "700",
    letterSpacing: ".13em",
    textShadow: "0 0 14px rgba(220,150,20,.9),0 0 28px rgba(180,100,0,.5)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.05, overflow: "hidden", border: "2px solid rgba(180,110,10,.7)", boxShadow: "0 0 0 1px rgba(120,60,0,.3),0 0 45px rgba(200,130,10,.4),0 0 100px rgba(120,60,0,.25),inset 0 0 80px rgba(0,0,0,.55)" }}>
          {graphicsQuality === "low" ? (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #090400 0%, #2a1704 60%, #140900 100%)" }} />
          ) : (
            <EgyptBg W={BS} H={BS} gridSize={SIZE} graphicsQuality={graphicsQuality} />
          )}
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} />
          {graphicsQuality !== "low" && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => (
                  <Cell key={`${r}-${c}`} CS={CS} value={active[r][c]} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={graphicsQuality !== "low" && last === `${r}-${c}`} lastTurn={turn} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

