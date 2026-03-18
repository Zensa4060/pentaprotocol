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

function ArcaneBg({ W, H }: { W: number; H: number }) {
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

    const runeStr = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
    const runes = Array.from({ length: 20 }, (_, i) => ({
      x: W * 0.08 + Math.random() * W * 0.84,
      y: H * 0.08 + Math.random() * H * 0.84,
      char: runeStr[i % runeStr.length],
      phase: Math.random() * Math.PI * 2,
      spd: 0.009 + Math.random() * 0.013,
      scale: 0.5 + Math.random() * 0.9,
      col: ["180,80,255", "100,160,255", "255,80,180", "200,255,100", "255,200,60"][Math.floor(Math.random() * 5)],
    }));
    const circles = [
      { r: W * 0.38, phase: 0, spd: 0.004, pts: 12, col: "100,60,200", dash: [8, 6] },
      { r: W * 0.28, phase: Math.PI / 6, spd: -0.007, pts: 8, col: "180,100,255", dash: [4, 4] },
      { r: W * 0.18, phase: Math.PI / 4, spd: 0.012, pts: 5, col: "255,120,200", dash: [3, 5] },
    ];
    const mist = Array.from({ length: 14 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * W * 0.06 + W * 0.025,
      phase: Math.random() * Math.PI * 2,
      spd: 0.004 + Math.random() * 0.004,
      col: ["80,0,160", "60,0,120", "120,0,200"][Math.floor(Math.random() * 3)],
    }));

    const draw = () => {
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.7);
      bg.addColorStop(0, "#0a0012");
      bg.addColorStop(0.5, "#060008");
      bg.addColorStop(1, "#030004");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let fy = 0; fy < H; fy += W * 0.1) for (let fx = 0; fx < W; fx += W * 0.12) {
        ctx.strokeStyle = "rgba(150,120,200,.5)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(fx + Math.sin(fy * 0.1) * 2, fy, W * 0.12, W * 0.1);
      }
      ctx.restore();

      mist.forEach((m: any) => {
        m.phase += m.spd;
        m.x += Math.sin(m.phase) * 0.25;
        m.y += Math.cos(m.phase * 0.7) * 0.18;
        if (m.x < -m.r) m.x = W + m.r;
        if (m.x > W + m.r) m.x = -m.r;
        if (m.y < -m.r) m.y = H + m.r;
        if (m.y > H + m.r) m.y = -m.r;
        const pl = 0.18 + 0.28 * Math.abs(Math.sin(m.phase * 2));
        const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        mg.addColorStop(0, `rgba(${m.col},${pl})`);
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      });

      circles.forEach((c: any) => {
        c.phase += c.spd;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(c.phase);
        ctx.strokeStyle = `rgba(${c.col},${0.48 + 0.3 * Math.sin(tc + c.r)})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = `rgb(${c.col})`;
        ctx.shadowBlur = 12;
        ctx.setLineDash(c.dash);
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${c.col},${0.32 + 0.22 * Math.cos(tc * 0.5 + c.r)})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let j = 0; j < c.pts; j++) {
          const a = j * Math.PI * 2 / c.pts, x = c.r * Math.cos(a), y = c.r * Math.sin(a);
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
      });

      runes.forEach((r: any) => {
        r.phase += r.spd;
        const br = 0.28 + 0.72 * Math.abs(Math.sin(r.phase));
        ctx.save();
        ctx.globalAlpha = br * 0.8;
        ctx.fillStyle = `rgb(${r.col})`;
        ctx.shadowColor = `rgb(${r.col})`;
        ctx.shadowBlur = 14 * br;
        ctx.font = `bold ${W * 0.04 * r.scale}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.translate(r.x, r.y);
        ctx.rotate(Math.sin(r.phase * 0.3) * 0.2);
        ctx.fillText(r.char, 0, 0);
        ctx.restore();
      });

      const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.15);
      cg.addColorStop(0, `rgba(140,60,255,${0.14 + 0.1 * Math.sin(tc * 1.5)})`);
      cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
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

    const glyphs = ["✦", "⊕", "⊗", "⊘", "✧", "⊛", "⊞", "⊠", "⊡"];
    const draw = () => {
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i <= 5; i++) {
        const x = PAD + i * CS, y = PAD + i * CS;
        const magic = 0.6 + 0.4 * Math.sin(tc * 1.1 + i * 1.0);

        ctx.save();
        ctx.strokeStyle = "rgba(180,80,255,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(160,80,255,${0.2 * magic})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(180,80,255,.8)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(200,120,255,${0.75 * magic})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(220,140,255,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(240,220,255,${0.92 * magic})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(200,140,0,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(200,140,30,${0.18 * magic})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(220,160,0,.8)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(240,180,50,${0.73 * magic})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(255,200,60,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,240,180,${0.92 * magic})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
        const nx = PAD + c * CS, ny = PAD + r * CS;
        const fl = 0.45 + 0.55 * Math.abs(Math.sin(tc * 1.6 + (r * 6 + c) * 0.9));
        const gold = (r + c) % 2 === 0;
        const col = gold ? "rgba(255,200,60," : "rgba(220,140,255,";
        ctx.save();
        ctx.strokeStyle = `${col}${0.7 * fl})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `${col}0.9)`;
        ctx.shadowBlur = 14 * fl;
        ctx.beginPath();
        ctx.arc(nx, ny, 8 * fl, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = `${col}${0.9 * fl})`;
        ctx.shadowColor = `${col}1)`;
        ctx.shadowBlur = 18 * fl;
        ctx.beginPath();
        ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(tc * 0.45 + (r + c) * 0.5);
        ctx.globalAlpha = 0.38 * fl;
        ctx.fillStyle = gold ? "#ffdd80" : "#cc88ff";
        ctx.font = `${CS * 0.18}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyphs[(r * 6 + c) % glyphs.length], 0, 0);
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
    const c1 = isP1 ? [200, 120, 255] : [255, 190, 60];
    const c2 = isP1 ? [140, 60, 200] : [200, 140, 20];
    for (let i = 0; i < 4; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.06 + i * 0.05), alpha: 1 - i * 0.2, col: i % 2 === 0 ? c1 : c2, decay: 0.024 + i * 0.008, w: 3 - i * 0.4 });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 2 * i / 6;
      pts.current.push({ type: "ray", x, y, a, len: 0, maxLen: W * 0.13, alpha: 1, col: c1, decay: 0.04 });
    }
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2.5 + Math.random() * 4.5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.5 + 0.8, alpha: 1, col: Math.random() > 0.5 ? c1 : c2, decay: 0.026 + Math.random() * 0.022 });
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
        p.vx *= 0.92; p.vy *= 0.92;
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
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [W, H]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function RunePortal({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #cc88ff) drop-shadow(0 0 28px #8800ff) drop-shadow(0 0 56px rgba(140,0,255,.6))"
    : "drop-shadow(0 0 6px #cc88ff) drop-shadow(0 0 18px rgba(140,0,255,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "rpIn .52s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes rpIn{0%{transform:scale(0) rotate(-180deg);opacity:0;filter:blur(12px)}45%{transform:scale(1.3) rotate(15deg);opacity:1;filter:blur(0)}75%{transform:scale(.9) rotate(-6deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <circle cx="24" cy="24" r="20" fill="none" stroke="#cc88ff" strokeWidth="2" strokeDasharray="126" strokeDashoffset="126">
        <animate attributeName="stroke-dashoffset" from="126" to="0" dur=".3s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="14" fill="none" stroke="#aa44ff" strokeWidth="1.2" strokeDasharray="88" strokeDashoffset="88">
        <animate attributeName="stroke-dashoffset" from="88" to="0" dur=".22s" begin=".08s" fill="freeze" />
      </circle>
      {Array.from({ length: 6 }, (_, i) => {
        const a = i * 60 * Math.PI / 180;
        return (
          <line key={i} x1={24 + 14 * Math.cos(a)} y1={24 + 14 * Math.sin(a)} x2={24 + 20 * Math.cos(a)} y2={24 + 20 * Math.sin(a)} stroke="#cc88ff" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="6" strokeDashoffset="6">
            <animate attributeName="stroke-dashoffset" from="6" to="0" dur=".08s" begin={`${0.24 + i * 0.04}s`} fill="freeze" />
          </line>
        );
      })}
      <circle cx="24" cy="24" r="5" fill="none" stroke="#ee88ff" strokeWidth="1.5" strokeDasharray="32" strokeDashoffset="32">
        <animate attributeName="stroke-dashoffset" from="32" to="0" dur=".14s" begin=".28s" fill="freeze" />
      </circle>
      <circle cx="24" cy="24" r="2.5" fill="#eebbff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".38s" fill="freeze" />
        <animate attributeName="r" values="2;4;2" dur="2s" begin=".5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function GoldSigil({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.58;
  const glow = win
    ? "drop-shadow(0 0 10px #ffdd60) drop-shadow(0 0 28px #ffaa00) drop-shadow(0 0 56px rgba(255,180,0,.6))"
    : "drop-shadow(0 0 6px #ffdd60) drop-shadow(0 0 18px rgba(255,180,0,.7))";
  const starPts = Array.from({ length: 5 }, (_, i) => {
    const a = i * 72 - 90;
    return `${24 + 18 * Math.cos(a * Math.PI / 180)},${24 + 18 * Math.sin(a * Math.PI / 180)}`;
  }).join(" ");
  const innerPts = Array.from({ length: 5 }, (_, i) => {
    const a = i * 72 - 90 + 36;
    return `${24 + 8 * Math.cos(a * Math.PI / 180)},${24 + 8 * Math.sin(a * Math.PI / 180)}`;
  }).join(" ");
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "gsIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes gsIn{0%{transform:scale(0) rotate(72deg);opacity:0}55%{transform:scale(1.28) rotate(-12deg);opacity:1}80%{transform:scale(.92) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <circle cx="24" cy="24" r="20" fill="none" stroke="#ffdd60" strokeWidth="1.5" strokeDasharray="126" strokeDashoffset="126">
        <animate attributeName="stroke-dashoffset" from="126" to="0" dur=".26s" fill="freeze" />
      </circle>
      <polygon points={starPts} fill="none" stroke="#ffaa00" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur=".28s" begin=".06s" fill="freeze" />
      </polygon>
      <polygon points={starPts} fill="#ffaa00" opacity="0">
        <animate attributeName="opacity" from="0" to=".1" dur=".07s" begin=".32s" fill="freeze" />
      </polygon>
      <polygon points={innerPts} fill="none" stroke="#ffee80" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".07s" begin=".3s" fill="freeze" />
      </polygon>
      <circle cx="24" cy="24" r="3.5" fill="#ffee80" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur=".07s" begin=".34s" fill="freeze" />
        <animate attributeName="r" values="3;5;3" dur="2.2s" begin=".5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Cell({ CS, value, onClick, isWinCell, justPlaced, lastTurn }: { CS: number; value: string | null; onClick: () => void; isWinCell: boolean; justPlaced: boolean; lastTurn: "X" | "O" }) {
  const [hov, setHov] = useState(false);
  const isP1 = value === "X", isP2 = value === "O";
  const wC = isP1 ? "rgba(180,100,255,.4)" : "rgba(255,200,60,.4)";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        width: CS, height: CS, position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isWinCell ? `radial-gradient(ellipse,${isP1 ? "rgba(150,80,200,.22)" : "rgba(200,160,0,.22)"},transparent 70%)` : (hov && !value ? "radial-gradient(ellipse,rgba(100,40,160,.15),transparent 70%)" : "transparent"),
        boxShadow: isWinCell ? `inset 0 0 ${CS * 0.3}px ${wC}` : "none",
        transition: "background .2s",
      }}
    >
      {justPlaced && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "180,100,255" : "255,200,60"},.75),transparent 65%)`, animation: "arcF .55s ease-out forwards", pointerEvents: "none", zIndex: 4 }} />}
      {isP1 && <RunePortal size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {isP2 && <GoldSigil size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes arcF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}`}</style>
    </div>
  );
}

export default function ArcaneGrid({
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
    if (onCellClick) { onCellClick(r, c); return; }
    const n = demo.map((row) => [...row]);
    n[r][c] = turn;
    setDemo(n);
    setTurn((t2) => (t2 === "X" ? "O" : "X"));
  };

  const fs = (n: number) => Math.max(10, CS * n);
  const lbl = {
    color: "rgba(200,140,255,.9)",
    fontSize: fs(0.13),
    fontFamily: "'Palatino Linotype',Palatino,serif",
    fontStyle: "italic",
    fontWeight: "700",
    letterSpacing: ".16em",
    textShadow: "0 0 14px rgba(180,100,255,.9),0 0 28px rgba(120,60,200,.5)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.06, overflow: "hidden", border: "2px solid rgba(160,80,255,.75)", boxShadow: "0 0 0 1px rgba(200,140,0,.25),0 0 50px rgba(140,60,220,.55),0 0 120px rgba(80,20,160,.4),inset 0 0 80px rgba(0,0,10,.6)" }}>
          <ArcaneBg W={BS} H={BS} />
          <GridLines W={BS} H={BS} PAD={PAD} CS={CS} />
          <BurstCanvas burstRef={burstRef} W={BS} H={BS} />
          <div style={{ position: "absolute", inset: PAD, zIndex: 4, display: "flex", flexDirection: "column" }}>
            {ROWS.map((_, r) => (
              <div key={r} style={{ display: "flex", flex: 1 }}>
                {COLS.map((_, c) => (
                  <Cell key={`${r}-${c}`} CS={CS} value={active[r][c]} onClick={() => click(r, c)} isWinCell={winSet.has(`${r}-${c}`)} justPlaced={last === `${r}-${c}`} lastTurn={turn} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

