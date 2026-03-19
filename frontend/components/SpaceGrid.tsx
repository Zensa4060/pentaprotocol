"use client";
import React, { useEffect, useRef, useState } from "react";

const SIZE = 5;
const COLS = ["A", "B", "C", "D", "E"];
const ROWS = [1, 2, 3, 4, 5];

function useCellSize(pad = 8) {
  const [cs, setCs] = useState(110);
  useEffect(() => {
    const c = () => {
      const b = Math.min(
        Math.max(window.innerWidth - 560, 260),
        Math.max(window.innerHeight - 200, 260)
      );
      setCs(Math.max(50, (b - 2 * pad) / 5));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad]);
  return cs;
}

function SpaceExBg({ W, H }: { W: number; H: number }) {
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

    // Star field — 3 layers of depth
    const starsNear = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.8, phase: Math.random() * Math.PI * 2, spd: 0.025 + Math.random() * 0.015 }));
    const starsMid  = Array.from({ length: 100 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, phase: Math.random() * Math.PI * 2, spd: 0.01 + Math.random() * 0.01 }));
    const starsFar  = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 0.5 + 0.2, phase: Math.random() * Math.PI * 2, spd: 0.004 + Math.random() * 0.006 }));

    // Planets
    const planets = [
      { cx: W * 0.78, cy: H * 0.22, r: W * 0.09, col1: "#ff6b35", col2: "#cc3a00", ring: true,  ringTilt: 0.3, phase: 0,   spd: 0.003 },
      { cx: W * 0.12, cy: H * 0.72, r: W * 0.055, col1: "#4488ff", col2: "#0033bb", ring: false, ringTilt: 0,   phase: 1.2, spd: 0.005 },
    ];

    // Asteroids
    const asteroids = Array.from({ length: 10 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.random() * 0.3 - 0.15,
      vy: Math.random() * 0.2 - 0.1,
      r: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI * 2,
      rotSpd: Math.random() * 0.02 - 0.01,
      col: ["#8B7355", "#6B5B3E", "#9C8362", "#7A6245"][Math.floor(Math.random() * 4)],
    }));

    // Meteor streaks
    const meteors = Array.from({ length: 2 }, () => ({ x: -100, y: Math.random() * H, vx: 12 + Math.random() * 8, vy: 2 + Math.random() * 3, alpha: 0, timer: Math.random() * 250 }));

    // Nebula clouds
    const nebClouds = [
      { cx: W * 0.5, cy: H * 0.5, rx: W * 0.5, ry: H * 0.4, col: "rgba(20,40,120,0.3)" },
      { cx: W * 0.2, cy: H * 0.3, rx: W * 0.3, ry: H * 0.25, col: "rgba(60,0,80,0.25)" },
      { cx: W * 0.8, cy: H * 0.7, rx: W * 0.25, ry: H * 0.3, col: "rgba(0,60,100,0.2)" },
    ];

    // Solar wind particles
    const solarWind = Array.from({ length: 20 }, () => ({ x: Math.random() * W, y: Math.random() * H, len: Math.random() * 25 + 10, vx: 1.5 + Math.random() * 1, alpha: Math.random() * 0.3 + 0.1 }));

    const draw = () => {
      t.current += 0.013;
      const tc = t.current;
      ctx.clearRect(0, 0, W, H);

      // Deep space base
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.9);
      bg.addColorStop(0, "#050818");
      bg.addColorStop(0.4, "#020510");
      bg.addColorStop(1, "#010208");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula
      nebClouds.forEach((n) => {
        ctx.save();
        ctx.scale(1, n.ry / n.rx);
        const ng = ctx.createRadialGradient(n.cx, n.cy * (n.rx / n.ry), 0, n.cx, n.cy * (n.rx / n.ry), n.rx);
        ng.addColorStop(0, n.col);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(n.cx, n.cy * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Far stars
      starsFar.forEach((s) => {
        s.phase += s.spd;
        const b = 0.25 + 0.75 * Math.abs(Math.sin(s.phase));
        ctx.save();
        ctx.globalAlpha = b * 0.5;
        ctx.fillStyle = "#aabbcc";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Mid stars
      starsMid.forEach((s) => {
        s.phase += s.spd;
        const b = 0.4 + 0.6 * Math.abs(Math.sin(s.phase));
        ctx.save();
        ctx.globalAlpha = b * 0.7;
        ctx.fillStyle = "#ccdde8";
        ctx.shadowColor = "#ccdde8";
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Near stars (twinkling with color)
      starsNear.forEach((s) => {
        s.phase += s.spd;
        const b = 0.5 + 0.5 * Math.abs(Math.sin(s.phase));
        const col = ["#ffffff", "#aaddff", "#ffddaa", "#ddaaff"][Math.floor(s.phase * 3) % 4];
        ctx.save();
        ctx.globalAlpha = b;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Planets
      planets.forEach((p) => {
        p.phase += p.spd;
        const pl = 0.8 + 0.2 * Math.sin(p.phase);

        // Glow halo
        for (let g = 5; g >= 1; g--) {
          const gR = p.r * (1 + g * 0.25);
          const gg = ctx.createRadialGradient(p.cx, p.cy, p.r * 0.5, p.cx, p.cy, gR);
          const glowCol = p.ring ? "rgba(255,100,50," : "rgba(60,120,255,";
          gg.addColorStop(0, `${glowCol}${0.1 * g * pl})`);
          gg.addColorStop(1, "transparent");
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(p.cx, p.cy, gR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Planet body
        const pd = ctx.createRadialGradient(p.cx - p.r * 0.25, p.cy - p.r * 0.25, 0, p.cx, p.cy, p.r);
        pd.addColorStop(0, p.ring ? "rgba(255,200,150,1)" : "rgba(100,160,255,1)");
        pd.addColorStop(0.5, p.col1);
        pd.addColorStop(1, p.col2);
        ctx.fillStyle = pd;
        ctx.shadowColor = p.ring ? "rgba(255,100,50,.5)" : "rgba(60,100,255,.5)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Surface bands
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.clip();
        [-0.3, 0, 0.25, 0.5].forEach((oy) => {
          ctx.fillStyle = p.ring ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.06)";
          ctx.beginPath();
          ctx.ellipse(p.cx, p.cy + oy * p.r, p.r, p.r * 0.15, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        // Ring
        if (p.ring) {
          ctx.save();
          ctx.translate(p.cx, p.cy);
          ctx.scale(1, Math.sin(p.ringTilt));
          ctx.strokeStyle = "rgba(255,160,80,.5)";
          ctx.lineWidth = p.r * 0.25;
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 1.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,200,120,.3)";
          ctx.lineWidth = p.r * 0.12;
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 1.85, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });

      // Asteroids
      asteroids.forEach((a) => {
        a.x += a.vx;
        a.y += a.vy;
        a.rot += a.rotSpd;
        if (a.x < -20) a.x = W + 20;
        if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20;
        if (a.y > H + 20) a.y = -20;

        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.fillStyle = a.col;
        ctx.strokeStyle = "rgba(255,255,255,.1)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-a.r * 0.6, -a.r);
        ctx.lineTo(a.r * 0.7, -a.r * 0.7);
        ctx.lineTo(a.r, -a.r * 0.1);
        ctx.lineTo(a.r * 0.5, a.r * 0.8);
        ctx.lineTo(-a.r * 0.4, a.r);
        ctx.lineTo(-a.r, a.r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Solar wind streaks
      solarWind.forEach((s) => {
        s.x += s.vx;
        if (s.x > W + s.len) s.x = -s.len;
        ctx.save();
        ctx.globalAlpha = s.alpha * (0.5 + 0.5 * Math.sin(tc * 0.4 + s.y * 0.1));
        const sg = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
        sg.addColorStop(0, "transparent");
        sg.addColorStop(1, "rgba(100,200,255,.6)");
        ctx.strokeStyle = sg;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      });

      // Meteors
      meteors.forEach((m) => {
        m.timer--;
        if (m.timer < 0) {
          m.x = 0;
          m.y = Math.random() * H * 0.5;
          m.vx = 12 + Math.random() * 8;
          m.vy = 1.5 + Math.random() * 2.5;
          m.alpha = 1;
          m.timer = 150 + Math.random() * 200;
        }
        if (m.alpha > 0) {
          m.x += m.vx;
          m.y += m.vy;
          m.alpha = Math.max(0, m.alpha - 0.016);
          const len = 70 + m.vx * 3;
          ctx.save();
          ctx.globalAlpha = m.alpha;
          const mg = ctx.createLinearGradient(m.x - len, m.y - len * 0.12, m.x, m.y);
          mg.addColorStop(0, "transparent");
          mg.addColorStop(0.7, "rgba(200,220,255,.4)");
          mg.addColorStop(1, "rgba(255,255,255,.95)");
          ctx.strokeStyle = mg;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(m.x - len, m.y - len * 0.12);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.shadowColor = "rgba(180,200,255,1)";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (m.x > W + 100) m.alpha = 0;
        }
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
        const x = PAD + i * CS;
        const y = PAD + i * CS;
        const p = 0.65 + 0.35 * Math.sin(tc * 1.1 + i * 0.9);

        // VERTICAL — solar cyan
        ctx.save();
        ctx.strokeStyle = "rgba(0,200,255,.07)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(0,180,255,${0.2 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(0,200,255,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(0,220,255,${0.75 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,240,255,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(180,240,255,${0.92 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.restore();

        // HORIZONTAL — orbital orange
        ctx.save();
        ctx.strokeStyle = "rgba(255,120,0,.06)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(255,100,20,${0.18 * p})`;
        ctx.lineWidth = 9;
        ctx.shadowColor = "rgba(255,120,0,.8)";
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(255,130,30,${0.74 * p})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(255,150,0,1)";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(255,220,180,${0.92 * p})`;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(255,255,255,.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
      }

      // Intersection — targeting reticle crosshairs
      for (let r = 0; r <= 5; r++) {
        for (let c = 0; c <= 5; c++) {
          const nx = PAD + c * CS;
          const ny = PAD + r * CS;
          const fl = 0.45 + 0.55 * Math.abs(Math.sin(tc * 1.6 + (r * 6 + c) * 0.85));
          const isHud = (r + c) % 2 === 0;
          const col = isHud ? "rgba(0,220,255," : "rgba(255,130,30,";
          const sz = CS * 0.045;

          ctx.save();
          ctx.strokeStyle = `${col}${0.55 * fl})`;
          ctx.lineWidth = 1.2;
          ctx.shadowColor = `${col}0.8)`;
          ctx.shadowBlur = 12 * fl;
          ctx.beginPath();
          ctx.arc(nx, ny, sz * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          [[sz, 0], [-sz, 0], [0, sz], [0, -sz]].forEach(([dx, dy]) => {
            ctx.save();
            ctx.strokeStyle = `${col}${0.7 * fl})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = `${col}1)`;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(nx + dx * 0.5, ny + dy * 0.5);
            ctx.lineTo(nx + dx, ny + dy);
            ctx.stroke();
            ctx.restore();
          });

          ctx.save();
          ctx.fillStyle = `${col}${0.9 * fl})`;
          ctx.shadowColor = `${col}1)`;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(nx, ny, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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
    const c1 = isP1 ? [0, 220, 255] : [255, 140, 30];
    const c2 = isP1 ? [0, 100, 200] : [200, 80, 0];

    for (let i = 0; i < 3; i++) pts.current.push({ type: "ring", x, y, r: 0, maxR: W * (0.07 + i * 0.05), alpha: 0.85 - i * 0.2, col: c1, decay: 0.026 + i * 0.009, w: 3 - i * 0.4 });
    for (let i = 0; i < 28; i++) {
      const a = Math.PI * 2 * Math.random(), s = 2.5 + Math.random() * 5;
      pts.current.push({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2.5 + 0.8, alpha: 1, col: Math.random() > 0.4 ? c1 : c2, decay: 0.028 + Math.random() * 0.025 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * i / 8 + (Math.random() - 0.5) * 0.3;
      pts.current.push({ type: "ray", x, y, a, len: 0, maxLen: W * 0.13, alpha: 0.85, col: c1, decay: 0.04 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * Math.random(), s = 1.5 + Math.random() * 3;
      pts.current.push({ type: "debris", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: Math.random() * 3 + 2, rot: Math.random() * 360, rotSpd: Math.random() * 10 - 5, alpha: 1, col: c2, decay: 0.022 + Math.random() * 0.018 });
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
        ctx.lineWidth = (p.w || 2.5) * p.alpha;
        ctx.shadowColor = `rgba(${p.col},.8)`;
        ctx.shadowBlur = 18;
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
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "debris") {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
        p.rot += p.rotSpd;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.strokeStyle = `rgba(${p.col},.5)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.fill();
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
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [W, H]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }} />;
}

function Rocket({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.6;
  const glow = win
    ? "drop-shadow(0 0 10px #00eeff) drop-shadow(0 0 28px #00aaff) drop-shadow(0 0 56px rgba(0,200,255,.6))"
    : "drop-shadow(0 0 6px #00ddff) drop-shadow(0 0 18px rgba(0,180,255,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "rktIn .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes rktIn{0%{transform:translateY(-${size * 0.8}px) rotate(-15deg) scale(.3);opacity:0}55%{transform:translateY(${size * 0.05}px) rotate(5deg) scale(1.14);opacity:1}78%{transform:translateY(0) rotate(-2deg) scale(.93)}100%{transform:translateY(0) rotate(0) scale(1);opacity:1}}`}</style>
      <path d="M24,5 Q30,10 32,22 L32,36 L16,36 L16,22 Q18,10 24,5Z" fill="none" stroke="#00ddff" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="72" strokeDashoffset="72">
        <animate attributeName="stroke-dashoffset" from="72" to="0" dur=".24s" fill="freeze" />
      </path>
      <path d="M24,5 Q30,10 32,22 L32,36 L16,36 L16,22 Q18,10 24,5Z" fill="#00aacc" opacity="0">
        <animate attributeName="opacity" from="0" to=".15" dur=".07s" begin=".22s" fill="freeze" />
      </path>
      <path d="M24,5 Q27,10 28,16 L24,14 L20,16 Q21,10 24,5Z" fill="#80eeff" opacity="0">
        <animate attributeName="opacity" from="0" to=".5" dur=".06s" begin=".24s" fill="freeze" />
      </path>
      <circle cx="24" cy="22" r="4.5" fill="none" stroke="#80eeff" strokeWidth="1.5" opacity="0">
        <animate attributeName="opacity" from="0" to=".9" dur=".07s" begin=".26s" fill="freeze" />
      </circle>
      <circle cx="24" cy="22" r="2.5" fill="#00ffff" opacity="0">
        <animate attributeName="opacity" from="0" to=".7" dur=".06s" begin=".3s" fill="freeze" />
        <animate attributeName="r" values="2;3;2" dur="2s" begin=".5s" repeatCount="indefinite" />
      </circle>
      <path d="M16,32 L10,40 L16,38Z" fill="#00aacc" stroke="#00ddff" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".06s" begin=".28s" fill="freeze" />
      </path>
      <path d="M32,32 L38,40 L32,38Z" fill="#00aacc" stroke="#00ddff" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".06s" begin=".28s" fill="freeze" />
      </path>
      <path d="M20,36 Q22,42 24,44 Q26,42 28,36Z" fill="#ff8800" opacity="0">
        <animate attributeName="opacity" values="0;.8;.5;.8;.6" dur="1.5s" begin=".32s" repeatCount="indefinite" />
      </path>
      <path d="M22,36 Q23,40 24,41 Q25,40 26,36Z" fill="#ffff80" opacity="0">
        <animate attributeName="opacity" values="0;1;.7;1;.8" dur="1.5s" begin=".36s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function Satellite({ size, win, ak }: { size: number; win: boolean; ak: string }) {
  const s = size * 0.6;
  const glow = win
    ? "drop-shadow(0 0 10px #ff8c00) drop-shadow(0 0 26px #ff6600) drop-shadow(0 0 55px rgba(255,120,0,.6))"
    : "drop-shadow(0 0 6px #ff9922) drop-shadow(0 0 18px rgba(255,140,0,.7))";
  return (
    <svg key={ak} width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "satIn .48s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes satIn{0%{transform:scale(0) rotate(45deg);opacity:0}55%{transform:scale(1.22) rotate(-8deg);opacity:1}80%{transform:scale(.92) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <rect x="17" y="17" width="14" height="14" rx="2" fill="none" stroke="#ff9922" strokeWidth="2" strokeDasharray="52" strokeDashoffset="52">
        <animate attributeName="stroke-dashoffset" from="52" to="0" dur=".22s" fill="freeze" />
      </rect>
      <rect x="17" y="17" width="14" height="14" rx="2" fill="#cc5500" opacity="0">
        <animate attributeName="opacity" from="0" to=".2" dur=".07s" begin=".2s" fill="freeze" />
      </rect>
      <rect x="2" y="19" width="14" height="10" rx="1" fill="none" stroke="#ff9922" strokeWidth="1.5" strokeDasharray="48" strokeDashoffset="48">
        <animate attributeName="stroke-dashoffset" from="48" to="0" dur=".16s" begin=".18s" fill="freeze" />
      </rect>
      <rect x="2" y="19" width="14" height="10" rx="1" fill="#ff6600" opacity="0">
        <animate attributeName="opacity" from="0" to=".15" dur=".07s" begin=".32s" fill="freeze" />
      </rect>
      {[5, 9, 13].map((x, i) => (
        <line key={i} x1={x} y1={19} x2={x} y2={29} stroke="#ffbb44" strokeWidth=".9" opacity="0">
          <animate attributeName="opacity" from="0" to=".6" dur=".05s" begin={`.34+${i}*.04s`} fill="freeze" />
        </line>
      ))}
      <rect x="32" y="19" width="14" height="10" rx="1" fill="none" stroke="#ff9922" strokeWidth="1.5" strokeDasharray="48" strokeDashoffset="48">
        <animate attributeName="stroke-dashoffset" from="48" to="0" dur=".16s" begin=".18s" fill="freeze" />
      </rect>
      <rect x="32" y="19" width="14" height="10" rx="1" fill="#ff6600" opacity="0">
        <animate attributeName="opacity" from="0" to=".15" dur=".07s" begin=".32s" fill="freeze" />
      </rect>
      {[35, 39, 43].map((x, i) => (
        <line key={i} x1={x} y1={19} x2={x} y2={29} stroke="#ffbb44" strokeWidth=".9" opacity="0">
          <animate attributeName="opacity" from="0" to=".6" dur=".05s" begin={`.34+${i}*.04s`} fill="freeze" />
        </line>
      ))}
      <line x1="24" y1="17" x2="24" y2="9" stroke="#ffcc44" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="8" strokeDashoffset="8">
        <animate attributeName="stroke-dashoffset" from="8" to="0" dur=".1s" begin=".24s" fill="freeze" />
      </line>
      <circle cx="24" cy="8" r="2.5" fill="none" stroke="#ffcc44" strokeWidth="1.2" opacity="0">
        <animate attributeName="opacity" from="0" to=".8" dur=".06s" begin=".32s" fill="freeze" />
      </circle>
      <circle cx="24" cy="8" r="5" fill="none" stroke="#ffcc44" strokeWidth=".8" opacity="0">
        <animate attributeName="opacity" values="0;.5;0" dur="1.8s" begin=".5s" repeatCount="indefinite" />
        <animate attributeName="r" values="3;8;3" dur="1.8s" begin=".5s" repeatCount="indefinite" />
      </circle>
      <circle cx="24" cy="24" r="2" fill="#ffdd88" opacity="0">
        <animate attributeName="opacity" from="0" to=".9" dur=".06s" begin=".36s" fill="freeze" />
        <animate attributeName="r" values="1.5;3;1.5" dur="2.2s" begin=".5s" repeatCount="indefinite" />
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
  const isP1 = value === "X";
  const wC = isP1 ? "rgba(0,200,255,.4)" : "rgba(255,140,0,.4)";
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
          ? `radial-gradient(ellipse,${isP1 ? "rgba(0,180,220,.22)" : "rgba(200,100,0,.22)"},transparent 70%)`
          : hov && !value
            ? "radial-gradient(ellipse,rgba(0,80,120,.18),transparent 70%)"
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
            background: `radial-gradient(ellipse,rgba(${lastTurn === "X" ? "0,220,255" : "255,150,0"},.75),transparent 65%)`,
            animation: "spF .55s ease-out forwards",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}
      {value === "X" && <Rocket size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      {value === "O" && <Satellite size={CS} win={isWinCell} ak={`${value}${CS}`} />}
      <style>{`@keyframes spF{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}`}</style>
    </div>
  );
}

export default function SpaceGrid({
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
    color: "rgba(0,200,255,.88)",
    fontSize: fs(0.13),
    fontFamily: "'Courier New',monospace",
    fontWeight: "700",
    letterSpacing: ".15em",
    textShadow: "0 0 12px rgba(0,200,255,.9),0 0 24px rgba(0,120,200,.5)",
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
        <div style={{ position: "relative", width: BS, height: BS, borderRadius: CS * 0.07, overflow: "hidden", border: "2px solid rgba(0,160,220,.65)", boxShadow: "0 0 0 1px rgba(255,120,0,.2),0 0 45px rgba(0,160,220,.4),0 0 100px rgba(0,60,120,.25),inset 0 0 80px rgba(0,0,0,.6)" }}>
          <SpaceExBg W={BS} H={BS} />
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

