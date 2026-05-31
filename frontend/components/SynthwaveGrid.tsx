"use client";
import React, { useEffect, useRef, useState } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";

const DEFAULT_SIZE = 5;
type GraphicsQuality = "performance" | "quality";
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

function SynthBg({ W, H, gridSize = 5, graphicsQuality = "quality", isPaused = false }: { W: number; H: number; gridSize?: number; graphicsQuality?: GraphicsQuality; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const dpr = boardSkinCanvasDpr(gridSize);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.55,
      r: Math.random() * 1.6 + 0.3,
      phase: Math.random() * Math.PI * 2,
      spd: 0.02 + Math.random() * 0.02,
      col: ["#ffffff", "#ffccff", "#ccccff", "#ffddcc"][Math.floor(Math.random() * 4)],
    }));
    const neonCities = [
      { x: W * 0.05, y: H * 0.42, w: W * 0.08, h: H * 0.1 },
      { x: W * 0.12, y: H * 0.38, w: W * 0.05, h: H * 0.14 },
      { x: W * 0.18, y: H * 0.44, w: W * 0.04, h: H * 0.08 },
      { x: W * 0.78, y: H * 0.4, w: W * 0.07, h: H * 0.12 },
      { x: W * 0.84, y: H * 0.36, w: W * 0.05, h: H * 0.16 },
      { x: W * 0.9, y: H * 0.43, w: W * 0.09, h: H * 0.09 },
    ];
    const sun = { cx: W * 0.5, cy: H * 0.35, r: W * 0.1 };

    let frameSkip = 0;
    const draw = (now: number) => {
      if (graphicsQuality === "performance") return;
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.016 * dt;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, "#0a002a");
      sky.addColorStop(0.3, "#1a004a");
      sky.addColorStop(0.6, "#3a0060");
      sky.addColorStop(0.85, "#8b0050");
      sky.addColorStop(1, "#cc2060");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.55);

      const floor = ctx.createLinearGradient(0, H * 0.55, 0, H);
      floor.addColorStop(0, "#1a001a");
      floor.addColorStop(0.5, "#0a000f");
      floor.addColorStop(1, "#050008");
      ctx.fillStyle = floor;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);

      stars.forEach((s) => {
        s.phase += s.spd;
        const br = 0.3 + 0.7 * Math.abs(Math.sin(s.phase));
        ctx.save();
        ctx.globalAlpha = br * 0.9;
        ctx.fillStyle = s.col;
        ctx.shadowColor = s.col;
        ctx.shadowBlur = s.r > 1 ? 6 : 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const hg = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.65);
      hg.addColorStop(0, "transparent");
      hg.addColorStop(0.4, `rgba(255,80,160,${0.35 + 0.1 * Math.sin(tc * 0.5)})`);
      hg.addColorStop(0.6, `rgba(180,0,80,${0.2 + 0.08 * Math.sin(tc * 0.5)})`);
      hg.addColorStop(1, "transparent");
      ctx.fillStyle = hg;
      ctx.fillRect(0, H * 0.45, W, H * 0.2);

      const pulse = 0.92 + 0.08 * Math.sin(tc * 1.2);
      for (let ring = 8; ring >= 1; ring--) {
        const rr = sun.r * (ring * 0.22) * pulse;
        const sg = ctx.createRadialGradient(sun.cx, sun.cy, 0, sun.cx, sun.cy, rr);
        sg.addColorStop(0, `rgba(255,120,0,${0.12 * ring})`);
        sg.addColorStop(0.5, `rgba(255,60,80,${0.06 * ring})`);
        sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sun.cx, sun.cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      const sd = ctx.createRadialGradient(sun.cx, sun.cy, 0, sun.cx, sun.cy, sun.r * pulse);
      sd.addColorStop(0, "rgba(255,200,80,1)");
      sd.addColorStop(0.4, "rgba(255,100,60,.95)");
      sd.addColorStop(0.7, "rgba(255,40,80,.9)");
      sd.addColorStop(1, "rgba(220,0,60,.7)");
      ctx.fillStyle = sd;
      ctx.shadowColor = "rgba(255,80,100,.8)";
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(sun.cx, sun.cy, sun.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (let sl = 0; sl < 8; sl++) {
        const sy = sun.cy - sun.r * 0.75 + sl * sun.r * 0.22 + Math.sin(tc * 0.4) * 3;
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.fillRect(sun.cx - sun.r, sy, sun.r * 2, sun.r * 0.1);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,.9)";
      neonCities.forEach((c) => ctx.fillRect(c.x, c.y, c.w, c.h));

      neonCities.forEach((c) => {
        for (let wy = c.y + 4; wy < c.y + c.h - 4; wy += 8) {
          for (let wx = c.x + 3; wx < c.x + c.w - 3; wx += 7) {
            const wbr = 0.3 + 0.7 * Math.abs(Math.sin(tc * 2 + (wx + wy) * 0.1));
            ctx.save();
            ctx.globalAlpha = wbr * 0.8;
            ctx.fillStyle = Math.random() > 0.5 ? "#ff44cc" : "#44aaff";
            ctx.fillRect(wx, wy, 3, 3);
            ctx.restore();
          }
        }
      });

      const hor = H * 0.55;
      const vp = { x: W / 2, y: hor };
      const maxLines = 12;
      ctx.save();
      ctx.strokeStyle = "rgba(255,0,160,.28)";
      ctx.lineWidth = 1;
      for (let i = -maxLines; i <= maxLines; i++) {
        const sx = W / 2 + i * (W * 0.06), sy = H;
        const ex = vp.x + (sx - vp.x) * 0.02, ey = vp.y;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      for (let j = 1; j <= 10; j++) {
        const prog = j / 10;
        const alpha = 0.06 + 0.22 * (1 - prog);
        const yy = hor + ((H - hor) * (1 - Math.pow(1 - prog, 0.7)));
        ctx.strokeStyle = `rgba(255,0,200,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      ctx.restore();

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize, graphicsQuality, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

function GridLines({ W, H, PAD, CS, SIZE, isPaused = false }: { W: number; H: number; PAD: number; CS: number; SIZE: number; isPaused?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const t = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (isPaused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const dpr = boardSkinCanvasDpr(SIZE);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = (now: number) => {
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.016 * dt;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= SIZE; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const p = 0.65 + 0.35 * Math.sin(tc * 1.8 + i * 0.85);

        ctx.save();
        ctx.strokeStyle = "rgba(255,0,180,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,20,180,${0.2 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(255,0,200,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,40,200,${0.76 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(255,0,220,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,200,240,${0.92 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(0,220,255,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,200,255,${0.18 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,220,255,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(0,230,255,${0.74 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,240,255,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(200,250,255,${0.92 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, PAD, CS, SIZE, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }} />;
}

function BurstCanvas({ burstRef, W, H, gridSize = 5 }: { burstRef: React.MutableRefObject<((x: number, y: number, isP1: boolean) => void) | null>; W: number; H: number; gridSize?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);

  burstRef.current = (x, y, isP1) => {
    const c1 = isP1 ? [255, 20, 180] : [0, 220, 255];
    const c2 = isP1 ? [255, 100, 0] : [180, 0, 255];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.05), alpha: 1 - i * 0.2, col: i % 2 === 0 ? c1 : c2, decay: 0.024 + i * 0.009, w: 3 - i * 0.4 });
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * i / 8;
      pts.current.push({ type: "ray", x, y, a, len: 0, maxLen: W * 0.13, alpha: 0.9, col: c1, decay: 0.042 });
    }
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2.5 + Math.random() * 5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.5 + 0.8, alpha: 1, col: Math.random() > 0.5 ? c1 : c2, decay: 0.028 + Math.random() * 0.025 });
    }
    if (!raf.current) loop();
  };

  const loop = () => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    pts.current = pts.current.filter((p) => p.alpha > 0.01);
    for (const p of pts.current) {
      if (p.type === "ring") {
        p.r += (p.maxR - p.r) * 0.16;
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
      } else if (p.type === "spark") {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.91; p.vy *= 0.91;
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
    const dpr = boardSkinCanvasDpr(gridSize);
    const tw = Math.round(W * dpr), th = Math.round(H * dpr);
    if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function RetroSun({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #ff4466) drop-shadow(0 0 28px #ff0066) drop-shadow(0 0 55px rgba(255,0,100,.6))"
    : "drop-shadow(0 0 6px #ff6688) drop-shadow(0 0 18px rgba(255,0,100,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "rsIn .5s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes rsIn{0%{transform:scale(0);opacity:0;filter:blur(10px)}40%{transform:scale(1.2);opacity:.8;filter:blur(3px)}70%{transform:scale(.95);opacity:1;filter:blur(0)}100%{transform:scale(1);opacity:1}}`}</style>
      <circle cx="24" cy="24" r="17" fill="none" strokeDasharray="107" strokeDashoffset="107">
        <animate attributeName="stroke" values="#ff8800;#ff0066;#ff8800" dur="3s" repeatCount="indefinite" />
        <animate attributeName="stroke-width" values="2;2.5;2" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-dashoffset" from="107" to="0" dur=".28s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="17">
        <animate attributeName="fill" values="rgba(255,120,0,.95);rgba(255,60,80,.9);rgba(255,120,0,.95)" dur="3s" repeatCount="indefinite" />
        <animate attributeName="fill" from="transparent" to="rgba(255,120,0,.95)" dur=".05s" begin=".26s" fill="freeze" />
      </circle>
      {[14, 17, 20, 23, 26, 29, 32].map((y, i) => (
        <rect key={i} x="5" y={y} width="38" height="2.5" fill="#1a002a" opacity="0">
          <animate attributeName="opacity" from="0" to=".85" dur=".03s" begin={`${0.28 + i * 0.03}s`} fill="freeze" />
        </rect>
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 * Math.PI / 180, r1 = 17, r2 = 21;
        return (
          <line key={i} x1={24 + r1 * Math.cos(a)} y1={24 + r1 * Math.sin(a)} x2={24 + r2 * Math.cos(a)} y2={24 + r2 * Math.sin(a)} stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" from="0" to=".9" dur=".04s" begin={`${0.32 + i * 0.02}s`} fill="freeze" />
          </line>
        );
      })}
    </svg>
  );
}

function NeonPalm({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #00ffff) drop-shadow(0 0 26px #00aaff) drop-shadow(0 0 55px rgba(0,200,255,.6))"
    : "drop-shadow(0 0 6px #00eeff) drop-shadow(0 0 18px rgba(0,200,255,.7))";
  const fronds = [[-14, -12], [-10, -8], [-8, -14], [10, -8], [14, -12]] as const;
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "npIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes npIn{0%{transform:translateY(${size * 0.7}px) scale(.4);opacity:0}58%{transform:translateY(-${size * 0.05}px) scale(1.14);opacity:1}80%{transform:translateY(${size * 0.01}px) scale(.93)}100%{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <path d="M22,10 Q21,20 20,34 Q22,36 24,36 Q26,36 28,34 Q27,20 26,10 Z" fill="none" stroke="#00eeff" strokeWidth="2" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60">
        <animate attributeName="stroke-dashoffset" from="60" to="0" dur=".2s" fill="freeze" />
      </path>
      <path d="M22,10 Q21,20 20,34 Q22,36 24,36 Q26,36 28,34 Q27,20 26,10 Z" fill="#00ccff" opacity="0">
        <animate attributeName="opacity" from="0" to=".12" dur=".07s" begin=".18s" fill="freeze" />
      </path>
      {fronds.map(([ex, ey], i) => {
        const ax = 24, ay = 10 + (i > 2 ? 4 : 0);
        const len = Math.sqrt(ex * ex + ey * ey) + 14;
        return (
          <path key={i} d={`M${ax},${ay} Q${ax + ex * 0.4},${ay + ey * 0.5} ${ax + ex},${ay + ey}`} fill="none" stroke="#00eeff" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len as any}>
            <animate attributeName="stroke-dashoffset" from={len as any} to="0" dur=".14s" begin={`${0.16 + i * 0.04}s`} fill="freeze" />
          </path>
        );
      })}
      {fronds.map(([ex, ey], i) => {
        const ax = 24, ay = 10 + (i > 2 ? 4 : 0);
        return Array.from({ length: 3 }, (_, j) => {
          const t2 = (j + 1) * 0.25;
          const bx = ax + ex * t2, by = ay + ey * t2;
          const perp = Math.atan2(ey, ex) + Math.PI / 2;
          const leafLen = 5 - t2 * 2;
          return (
            <line key={`${i}-${j}`} x1={bx + Math.cos(perp) * leafLen} y1={by + Math.sin(perp) * leafLen} x2={bx - Math.cos(perp) * leafLen} y2={by - Math.sin(perp) * leafLen} stroke="#80ffff" strokeWidth=".9" strokeLinecap="round" opacity="0">
              <animate attributeName="opacity" from="0" to=".6" dur=".04s" begin={`${0.28 + i * 0.03 + j * 0.02}s`} fill="freeze" />
            </line>
          );
        });
      })}
      <ellipse cx="24" cy="36" rx="4" ry="6" fill="#006688" opacity="0">
        <animate attributeName="opacity" from="0" to=".4" dur=".07s" begin=".3s" fill="freeze" />
      </ellipse>
    </svg>
  );
}

function SynthwaveCell({ CS, value, onClick, isWinCell, justPlaced, lastTurn, isP1, isP2 }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O"; isP1: boolean; isP2: boolean }) {
  const [hov, setHov] = useState(false);
  const wC = isP1 ? "rgba(255,0,180,.4)" : "rgba(0,220,255,.4)";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        width: CS, height: CS, position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isWinCell ? `radial-gradient(ellipse,${isP1 ? "rgba(200,0,120,.25)" : "rgba(0,180,220,.25)"},transparent 70%)` : (hov && !value ? "radial-gradient(ellipse,rgba(80,0,60,.2),transparent 70%)" : "transparent"),
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s, box-shadow .2s",
        animation: isWinCell ? "swWinPulse 1.05s ease-in-out infinite" : "none",
        contain: "layout style",
      }}
    >
      {justPlaced && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "255,0,180" : "0,220,255"},.75),transparent 65%)`, animation: "swF .55s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />}
      {isP1 && <RetroSun size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <NeonPalm size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes swF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}@keyframes swWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
    </div>
  );
}
const MemoizedSynthwaveCell = React.memo(SynthwaveCell);

export default React.memo(function SynthwaveGrid({ board, onCellClickAction, winCells = [], showLabels = true, graphicsQuality = "quality", isPaused = false }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; graphicsQuality?: GraphicsQuality; isPaused?: boolean }) {
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
    if (graphicsQuality !== "performance") {
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
    color: "rgba(255,80,200,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".18em",
    textShadow: "0 0 12px rgba(255,0,200,.85),0 0 24px rgba(200,0,160,.5)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.07, overflow: "hidden", border: "2px solid rgba(255,0,180,.65)", boxShadow: "0 0 0 1px rgba(0,180,255,.25),0 0 50px rgba(200,0,160,.45),0 0 120px rgba(100,0,80,.3),inset 0 0 80px rgba(0,0,10,.6)", willChange: "transform", contain: "layout size style" }}>
          {graphicsQuality === "performance" ? (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #120024 0%, #2f0040 45%, #130018 100%)" }} />
          ) : (
            <SynthBg W={BS} H={BS} gridSize={SIZE} graphicsQuality={graphicsQuality} isPaused={isPaused} />
          )}
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} isPaused={isPaused} />
          {graphicsQuality !== "performance" && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => {
                  const val = active[r][c];
                  return (
                    <MemoizedSynthwaveCell key={`${r}-${c}`} CS={CS} value={val} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={graphicsQuality !== "performance" && last === `${r}-${c}`} lastTurn={turn} isP1={val === "X"} isP2={val === "O"} />
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
