"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boardSkinCanvasDpr } from "@/lib/boardSkinCanvasDpr";

const DEFAULT_SIZE = 5;
const GET_COLS = (s: number) => Array.from({ length: s }, (_, i) => String.fromCharCode(65 + i));
const GET_ROWS = (s: number) => Array.from({ length: s }, (_, i) => i + 1);

function useCellSize(size: number, pad = 8) {
  const [cs, setCs] = useState(110);
  useEffect(() => {
    const c = () => {
      const b = Math.min(
        Math.max(window.innerWidth - 560, 260),
        Math.max(window.innerHeight - 200, 260)
      );
      setCs(Math.max(50, (b - 2 * pad) / size));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad, size]);
  return cs;
}

function PixelBg({ W, H, gridSize = 5, isPaused = false }: { W: number; H: number; gridSize?: number; isPaused?: boolean }) {
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

    const T = 4;
    const pal = ["#0f0f1a", "#1a1a2e", "#16213e", "#0f3460", "#1b1b2f", "#2d132c", "#1c1c2e"];
    const bgTiles: { x: number; y: number; col: string }[] = [];
    for (let ty = 0; ty < Math.ceil(H / T) + 1; ty++) {
      for (let tx = 0; tx < Math.ceil(W / T) + 1; tx++) {
        const d = (tx + ty) % 2;
        bgTiles.push({ x: tx * T, y: ty * T, col: d === 0 ? "#0a0a18" : "#0e0e22" });
      }
    }

    const sprites = [
      { x: W * 0.15, y: H * 0.3, vx: 0.6, vy: 0.3, frame: 0, timer: 0, col: "#ff5555", shape: "star" as const },
      { x: W * 0.8, y: H * 0.6, vx: -0.5, vy: 0.4, frame: 0, timer: 0, col: "#55ff55", shape: "diamond" as const },
      { x: W * 0.5, y: H * 0.15, vx: 0.4, vy: -0.3, frame: 0, timer: 0, col: "#5555ff", shape: "plus" as const },
      { x: W * 0.25, y: H * 0.8, vx: 0.7, vy: -0.5, frame: 0, timer: 0, col: "#ffff55", shape: "block" as const },
      { x: W * 0.7, y: H * 0.2, vx: -0.6, vy: 0.6, frame: 0, timer: 0, col: "#ff55ff", shape: "star" as const },
    ];

    const drawBg = () => {
      ctx.clearRect(0, 0, W, H);
      bgTiles.forEach((b) => {
        ctx.fillStyle = b.col;
        ctx.fillRect(b.x, b.y, T, T);
      });
      for (let vy = 0; vy < Math.ceil(H / T); vy += 2) {
        for (let vx = 0; vx < Math.ceil(W / T); vx += 2) {
          const dx = vx * T - W / 2;
          const dy = vy * T - H / 2;
          const dist = Math.sqrt(dx * dx + dy * dy) / (W * 0.7);
          if (dist > 0.5) {
            const alpha = Math.min(1, (dist - 0.5) * 2);
            ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
            ctx.fillRect(vx * T, vy * T, T * 2, T * 2);
          }
        }
      }
    };

    const drawSprite = (s: (typeof sprites)[number]) => {
      const px = Math.round(s.x / T) * T;
      const py = Math.round(s.y / T) * T;
      const sz = T * 2;
      const c = s.col;
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 12;

      if (s.shape === "star") {
        [[0, 0, 1, 0, 0], [0, 1, 1, 1, 0], [1, 1, 1, 1, 1], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]].forEach((row, ry) =>
          row.forEach((on, rxc) => {
            if (on) ctx.fillRect(px + rxc * sz - sz * 2, py + ry * sz - sz * 2, sz, sz);
          })
        );
      } else if (s.shape === "diamond" || s.shape === "plus") {
        [[0, 1, 0], [1, 1, 1], [0, 1, 0]].forEach((row, ry) =>
          row.forEach((on, rxc) => {
            if (on) ctx.fillRect(px + rxc * sz - sz, py + ry * sz - sz, sz, sz);
          })
        );
      } else if (s.shape === "block") {
        ctx.fillRect(px - sz, py - sz, sz * 3, sz * 3);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px, py, sz, sz);
      }

      ctx.shadowBlur = 0;
    };

    const draw = (now: number) => {
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.016 * dt;
      const tc = t.current;
      drawBg();

      const cycle = Math.floor(tc * 4) % 8;
      [[W * 0.3, H * 0.25], [W * 0.6, H * 0.6], [W * 0.1, H * 0.7], [W * 0.85, H * 0.35], [W * 0.45, H * 0.85]].forEach(([gx, gy], i) => {
        const c2 = pal[(i + cycle) % pal.length];
        ctx.fillStyle = c2;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(Math.round(gx / T) * T, Math.round(gy / T) * T, T * 3, T * 3);
        ctx.globalAlpha = 1;
      });

      sprites.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -20) s.x = W + 20;
        if (s.x > W + 20) s.x = -20;
        if (s.y < -20) s.y = H + 20;
        if (s.y > H + 20) s.y = -20;
        s.timer += 0.016;
        if (s.timer > 0.15) {
          s.timer = 0;
          s.frame = (s.frame + 1) % 2;
        }
        ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(tc + s.x * 0.02));
        drawSprite(s);
        ctx.globalAlpha = 1;
      });

      for (let sy = 0; sy < H; sy += 2) {
        ctx.fillStyle = "rgba(0,0,0,.14)";
        ctx.fillRect(0, sy, W, 1);
      }

      ctx.fillStyle = `rgba(255,255,255,${0.015 + 0.008 * Math.sin(tc * 60)})`;
      ctx.fillRect(0, 0, W, 2);
      ctx.fillRect(0, H - 2, W, 2);
      ctx.fillRect(0, 0, 2, H);
      ctx.fillRect(W - 2, 0, 2, H);

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, gridSize, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", imageRendering: "pixelated" }} />;
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
    const T = 4;
    const vColors = ["#ff5555", "#ff9944", "#ffff44", "#44ff88", "#44aaff", "#aa44ff", "#ff44bb", "#55ffdd"];
    const hColors = ["#44aaff", "#55ffdd", "#ff44bb", "#ffaa44", "#44ffaa", "#ff4455", "#aa44ff", "#44ff88"];

    const draw = (now: number) => {
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 16.667, 3) : 1;
      lastTime.current = now;
      t.current += 0.016 * dt;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      const animOff = Math.floor(tc * 8) % T;
      for (let i = 0; i <= SIZE; i++) {
        const x = Math.round((PAD + i * CS) / T) * T;
        const y = Math.round((PAD + i * CS) / T) * T;
        const vc = vColors[i % vColors.length];
        const hc = hColors[i % hColors.length];
        const flash = (Math.floor(tc * 4 + i) % 8) < 6;
        if (!flash) continue;
        const lineW = T * 2;
        for (let py = animOff; py < H; py += T * 3) {
          const blockH = T * 2;
          ctx.fillStyle = vc;
          ctx.fillRect(x - lineW / 2, py, lineW, blockH);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - lineW / 2 + T / 2, py + T / 4, T / 2, T / 2);
        }
        for (let px = animOff; px < W; px += T * 3) {
          const blockW = T * 2;
          ctx.fillStyle = hc;
          ctx.fillRect(px, y - lineW / 2, blockW, lineW);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + T / 4, y - lineW / 2 + T / 2, T / 2, T / 2);
        }
      }

      for (let r = 0; r <= SIZE; r++) {
        for (let c = 0; c <= SIZE; c++) {
          const nx = Math.round((PAD + c * CS) / T) * T;
          const ny = Math.round((PAD + r * CS) / T) * T;
          const blink = (Math.floor(tc * 6 + (r * 6 + c) * 0.7) % 6) < 4;
          if (!blink) continue;
          const col = vColors[c % vColors.length];
          const pats: [number, number][] = [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 2], [4, 2]];
          pats.forEach(([px2, py2]) => {
            ctx.fillStyle = col;
            ctx.fillRect(nx - T * 2 + px2 * T, ny - T * 2 + py2 * T, T, T);
          });
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(nx - T / 2, ny - T / 2, T, T);
        }
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, PAD, CS, SIZE, isPaused]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", imageRendering: "pixelated" }} />;
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
  const T = 4;
  const palP1 = ["#ff5555", "#ffaa55", "#ffff55", "#ff55ff"];
  const palP2 = ["#55ffff", "#55ff55", "#5588ff", "#ffffff"];

  burstRef.current = (x, y, isP1) => {
    const pal2 = isP1 ? palP1 : palP2;
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * 2 * Math.random(), s = 3 + Math.random() * 6;
      pts.current.push({ type: "square", x: Math.round(x / T) * T, y: Math.round(y / T) * T, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: T * (Math.random() > 0.5 ? 2 : 1), col: pal2[Math.floor(Math.random() * pal2.length)], alpha: 1, decay: 0.028 + Math.random() * 0.025 });
    }
    for (let ring = 0; ring < 3; ring++) {
      const rpts = 8 + ring * 4;
      for (let j = 0; j < rpts; j++) {
        const a = Math.PI * 2 * j / rpts;
        const spd = (ring + 1) * 0.8 + Math.random() * 0.4;
        pts.current.push({ type: "ringDot", x, y, vx: Math.cos(a) * spd * (ring + 1), vy: Math.sin(a) * spd * (ring + 1), size: T, col: pal2[ring % pal2.length], alpha: 0.9 - ring * 0.2, decay: 0.022 + ring * 0.008 });
      }
    }
    [[-T, -T], [T, -T], [-T, T], [T, T], [0, -T * 2], [0, T * 2], [-T * 2, 0], [T * 2, 0]].forEach(([dx, dy]) => {
      pts.current.push({ type: "flash", x: Math.round(x / T) * T + dx, y: Math.round(y / T) * T + dy, size: T, col: pal2[0], alpha: 1, decay: 0.09 });
    });
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
      if (p.type === "square" || p.type === "ringDot") {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.type === "square" ? 0.89 : 0.94;
        p.vy *= p.type === "square" ? 0.89 : 0.94;
        p.alpha -= p.decay;
        const sx = Math.round(p.x / T) * T;
        const sy = Math.round(p.y / T) * T;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.alpha);
        ctx.fillStyle = p.col;
        ctx.fillRect(sx, sy, p.size, p.size);
        ctx.restore();
      } else if (p.type === "flash") {
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x, p.y, p.size, p.size);
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
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H, gridSize]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none", imageRendering: "pixelated" }} />;
}

function PixelCoin({ size, win, ak, lowFx }: { size: number; win: boolean; ak: string; lowFx: boolean }) {
  const s = size * 0.62;
  const glow = lowFx
    ? (win ? "drop-shadow(0 0 5px rgba(255,200,0,.45))" : "drop-shadow(0 0 3px rgba(255,180,0,.35))")
    : win
      ? "drop-shadow(0 0 8px #ffdd00) drop-shadow(0 0 20px #ffaa00) drop-shadow(0 0 40px rgba(255,200,0,.6))"
      : "drop-shadow(0 0 5px #ffdd00) drop-shadow(0 0 14px rgba(255,180,0,.7))";
  const coinMap = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
  ];
  const colMap: (string | 0)[][] = [
    [0, 0, "#ffd700", "#ffee44", "#ffee44", "#ffd700", 0, 0],
    [0, "#ffd700", "#ffee44", "#ffee44", "#ffee44", "#ffee44", "#ffd700", 0],
    ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
    ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
    ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
    ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
    [0, "#ffd700", "#ffee44", "#ffee44", "#ffee44", "#ffee44", "#ffd700", 0],
    [0, 0, "#ffd700", "#ffee44", "#ffee44", "#ffd700", 0, 0],
  ];
  const cells: React.ReactNode[] = [];
  coinMap.forEach((row, ry) =>
    row.forEach((on, rx) => {
      if (on) cells.push(<rect key={`${rx}-${ry}`} x={rx} y={ry} width="1" height="1" fill={(colMap[ry]?.[rx] as string) || "#ffd700"} />);
    })
  );
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 8 8" style={{ position: "absolute", zIndex: 6, filter: glow, imageRendering: "pixelated", shapeRendering: "crispEdges", animation: "coinIn .48s steps(4,end) forwards" }}>
      <style>{`@keyframes coinIn{0%{transform:scale(0);opacity:0}25%{transform:scale(1.5);opacity:1}50%{transform:scale(.8)}75%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}`}</style>
      {cells}
    </svg>
  );
}

function PixelHeart({ size, win, ak, lowFx }: { size: number; win: boolean; ak: string; lowFx: boolean }) {
  const s = size * 0.62;
  const glow = lowFx
    ? (win ? "drop-shadow(0 0 5px rgba(255,80,100,.45))" : "drop-shadow(0 0 3px rgba(255,0,40,.35))")
    : win
      ? "drop-shadow(0 0 8px #ff4455) drop-shadow(0 0 20px #ff0022) drop-shadow(0 0 40px rgba(255,0,40,.6))"
      : "drop-shadow(0 0 5px #ff4455) drop-shadow(0 0 14px rgba(255,0,40,.7))";
  const hRows = [
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const hCol: (string | 0)[][] = [
    [0, "#ff6677", 0, 0, 0, "#ff6677", 0, 0],
    ["#ff4455", "#ff9999", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff9999", "#ff4455"],
    ["#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455"],
    ["#cc1122", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#cc1122"],
    [0, "#cc1122", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#cc1122", 0],
    [0, 0, "#cc1122", "#ff4455", "#ff4455", "#cc1122", 0, 0],
    [0, 0, 0, "#cc1122", "#cc1122", 0, 0, 0],
  ];
  const cells: React.ReactNode[] = [];
  hRows.forEach((row, ry) =>
    row.forEach((on, rx) => {
      if (on) cells.push(<rect key={`${rx}-${ry}`} x={rx} y={ry} width="1" height="1" fill={(hCol[ry]?.[rx] as string) || "#ff4455"} />);
    })
  );
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 8 8" style={{ position: "absolute", zIndex: 6, filter: glow, imageRendering: "pixelated", shapeRendering: "crispEdges", animation: "heartIn .48s steps(4,end) forwards" }}>
      <style>{`@keyframes heartIn{0%{transform:scale(0);opacity:0}30%{transform:scale(1.6);opacity:1}60%{transform:scale(.85)}80%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}`}</style>
      {cells}
      <rect x="0" y="0" width="8" height="8" fill="rgba(255,100,120,0)" opacity="0">
        <animate attributeName="fill" values="rgba(255,180,180,.4);rgba(255,100,120,0);rgba(255,180,180,.4)" dur="1.6s" begin=".5s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function PixelCell({ CS, value, row, col, onCellClickAction, isWinCell, justPlaced, lastTurn, isP1, isP2, lowFx }: { CS: number; value: "X" | "O" | null; row: number; col: number; onCellClickAction: (r: number, c: number) => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O"; isP1: boolean; isP2: boolean; lowFx: boolean }) {
  const [hov, setHov] = useState(false);
  const hovBg = "repeating-conic-gradient(rgba(255,220,0,.08) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px";
  const winC = isP1 ? "rgba(255,220,0,.4)" : "rgba(255,100,120,.4)";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onCellClickAction(row, col)}
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
        imageRendering: "pixelated",
        background: isWinCell
          ? `repeating-conic-gradient(${isP1 ? "rgba(255,200,0,.12)" : "rgba(255,80,100,.12)"} 0% 25%, transparent 0% 50%) 0 0 / 8px 8px`
          : hov && !value
            ? hovBg
            : "transparent",
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${winC}` : "inset 0 0 0 1px rgba(255,140,0,0.38)",
        transition: "background .15s",
        contain: "layout style",
      }}
    >
      {justPlaced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(${lastTurn === "X" ? "255,220,0" : "255,80,100"},.55)`,
            animation: "pfF .4s steps(3,end) forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {isP1 && <PixelCoin size={CS} win={isWinCell} ak={`${value}${CS}`} lowFx={lowFx} />}
      {isP2 && <PixelHeart size={CS} win={isWinCell} ak={`${value}${CS}`} lowFx={lowFx} />}
      <style>{`@keyframes pfF{0%{opacity:1}33%{opacity:.7}66%{opacity:.4}100%{opacity:0}}`}</style>
    </div>
  );
}
const MemoizedPixelCell = React.memo(PixelCell);

export default React.memo(function PixelGrid({ board, onCellClickAction, winCells = [], showLabels = true, isPaused = false, graphicsQuality = "quality", showShowcaseFx = false }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean; isPaused?: boolean; graphicsQuality?: "performance" | "quality"; showShowcaseFx?: boolean }) {
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
  useEffect(() => {
    setDemo(Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)));
    setTurn("X");
    setLast(null);
  }, [SIZE]);
  const winSet = useMemo(() => new Set(winCells.map(([r, c]) => `${r}-${c}`)), [winCells]);
  const burstRef = useRef<((x: number, y: number, isP1: boolean) => void) | null>(null);
  const lowFx = graphicsQuality === "performance";

  const click = useCallback((r: number, c: number) => {
    if (active[r][c]) return;
    setLast(`${r}-${c}`);
    setTimeout(() => setLast(null), 600);
    if (onCellClickAction) {
      onCellClickAction?.(r, c);
      return;
    }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  }, [active, demo, onCellClickAction, turn]);

  const fs = (n: number) => Math.max(9, Math.round((CS * n) / 4) * 4);
  const lbl = {
    color: "#ffdd00",
    fontSize: fs(0.14),
    fontFamily: "'Courier New',monospace",
    fontWeight: 900,
    letterSpacing: ".1em",
    imageRendering: "pixelated",
    textShadow: "3px 3px 0 #994400, -1px -1px 0 #000, 2px 0 0 #000, 0 2px 0 #000",
  } as const;

  const frameBorder = "3px solid #ff9900";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, imageRendering: "pixelated" }}>
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
            overflow: "hidden",
            outline: frameBorder,
            outlineOffset: "3px",
            border: frameBorder,
            background: "linear-gradient(180deg, #140700, #0b0300)",
            boxShadow: "0 0 0 4px #220000, 0 0 0 7px #ff5500, inset 0 0 0 2px #440000",
            imageRendering: "pixelated",
            contain: "layout size style",
          }}
        >
          {showShowcaseFx && !lowFx && <PixelBg W={BS} H={BS} gridSize={SIZE} isPaused={isPaused} />}
          {!lowFx && <GridLines W={BS} H={BS} PAD={PAD} CS={CS} SIZE={SIZE} isPaused={isPaused} />}
          {!lowFx && <BurstCanvas burstRef={burstRef} W={BS} H={BS} gridSize={SIZE} />}
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => {
                  const val = active[r][c] as "X" | "O" | null;
                  return (
                    <MemoizedPixelCell key={`${r}-${c}`} CS={CS} value={val} row={r} col={c} onCellClickAction={click} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={!lowFx && last === `${r}-${c}`} lastTurn={turn} isP1={val === "X"} isP2={val === "O"} lowFx={lowFx} />
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
