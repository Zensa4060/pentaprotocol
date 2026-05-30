"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;

  // ── init ──────────────────────────────────────────────────────────────────
  if (!s.init) {
    s.init = true;
    // Prismatic beam specs — each beam exits the prism at a different angle
    s.beams = Array.from({ length: 7 }, (_: any, i: number) => ({
      hue: i * (360 / 7),
      exitAngle: -0.42 + i * 0.14,   // fan out downward-right
      width: 0.018 + Math.random() * 0.012,
      pulse: Math.random() * Math.PI * 2,
      pulseSpd: 0.4 + Math.random() * 0.5,
    }));
    // Crystal particles drifting in the beams
    s.crystals = Array.from({ length: 55 }, () => ({
      x: 0.4 + Math.random() * 0.55,
      y: Math.random(),
      vx: 0.0002 + Math.random() * 0.0006,
      vy: (Math.random() - 0.5) * 0.0003,
      size: 1 + Math.random() * 3.5,
      hue: Math.random() * 360,
      ph: Math.random() * Math.PI * 2,
      a: 0.3 + Math.random() * 0.5,
    }));
    // Background micro-stars
    s.stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.3 + Math.random() * 1.2,
      ph: Math.random() * Math.PI * 2,
      a: 0.04 + Math.random() * 0.12,
    }));
    // Refraction rings
    s.rings = Array.from({ length: 4 }, (_: any, i: number) => ({
      phase: i * (Math.PI / 2),
      r: 0.08 + i * 0.06,
    }));
  }

  // ── background ────────────────────────────────────────────────────────────
  const bgG = ctx.createLinearGradient(0, 0, W, H);
  bgG.addColorStop(0,   "#03010e");
  bgG.addColorStop(0.45,"#06021a");
  bgG.addColorStop(1,   "#03010c");
  ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

  // Background stars
  s.stars.forEach((st: any) => {
    const tw = 0.4 + Math.sin(t * 1.4 + st.ph) * 0.3;
    ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,210,255,${st.a * tw})`; ctx.fill();
  });

  // ── prism shape (centred left-ish) ────────────────────────────────────────
  const prX = W * 0.28;
  const prY = H * 0.5 + Math.sin(t * 0.35) * H * 0.03;
  const prH = H * 0.42;
  const prW = prH * 0.55;

  // Prism glow aura
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const pgR = ctx.createRadialGradient(prX, prY, 0, prX, prY, prW * 1.8);
  pgR.addColorStop(0,   `rgba(180,140,255,${0.12 + Math.sin(t*0.8)*0.04})`);
  pgR.addColorStop(0.5, "rgba(100,60,200,0.05)");
  pgR.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = pgR; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Prism triangle
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const p1 = { x: prX,             y: prY - prH/2 };
  const p2 = { x: prX - prW/2,     y: prY + prH/2 };
  const p3 = { x: prX + prW/2,     y: prY + prH/2 };
  // Face fill (glass)
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
  const prFill = ctx.createLinearGradient(p2.x, p2.y, p1.x, p1.y);
  prFill.addColorStop(0,   "rgba(80,40,180,0.22)");
  prFill.addColorStop(0.5, "rgba(160,120,255,0.12)");
  prFill.addColorStop(1,   "rgba(200,180,255,0.08)");
  ctx.fillStyle = prFill; ctx.fill();
  // Edges
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
  const edgeG = ctx.createLinearGradient(p2.x, p1.y, p3.x, p3.y);
  edgeG.addColorStop(0, "rgba(180,160,255,0.7)");
  edgeG.addColorStop(0.5, "rgba(255,255,255,0.9)");
  edgeG.addColorStop(1, "rgba(140,120,255,0.6)");
  ctx.strokeStyle = edgeG; ctx.lineWidth = 1.5; ctx.stroke();
  // Internal refraction line
  ctx.beginPath();
  ctx.moveTo(prX - prW * 0.1, prY - prH * 0.12);
  ctx.lineTo(prX + prW * 0.38, prY + prH * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();

  // ── Input beam (white light entering left side of prism) ──────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const inX = prX - prW * 0.55; const inY = prY - prH * 0.08;
  const inLen = W * 0.22;
  const inG = ctx.createLinearGradient(inX - inLen, inY, inX, inY);
  inG.addColorStop(0, "rgba(255,255,255,0)");
  inG.addColorStop(0.5, "rgba(255,255,255,0.15)");
  inG.addColorStop(1, "rgba(255,255,255,0.45)");
  ctx.fillStyle = inG;
  ctx.fillRect(inX - inLen, inY - 2, inLen, 4);
  // glow at entry point
  const entG = ctx.createRadialGradient(inX, inY, 0, inX, inY, 12);
  entG.addColorStop(0, "rgba(255,255,255,0.6)");
  entG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = entG; ctx.fillRect(inX-14, inY-14, 28, 28);
  ctx.restore();

  // ── Spectral output beams from prism right face ───────────────────────────
  const exitX = prX + prW * 0.42;
  const exitY = prY + prH * 0.28;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.beams.forEach((b: any) => {
    const pulse = 0.72 + Math.sin(t * b.pulseSpd + b.pulse) * 0.22;
    const angle = b.exitAngle + Math.sin(t * 0.18 + b.pulse) * 0.025;
    const len = Math.hypot(W, H) * 0.85;
    const ex = exitX + Math.cos(angle) * len;
    const ey = exitY + Math.sin(angle) * len;
    const bw = b.width * Math.min(W, H*2) * pulse;
    const perp = { x: -Math.sin(angle), y: Math.cos(angle) };

    // Wide glow pass
    const bG1 = ctx.createLinearGradient(exitX, exitY, ex, ey);
    bG1.addColorStop(0,   `hsla(${b.hue},100%,65%,${pulse * 0.18})`);
    bG1.addColorStop(0.3, `hsla(${b.hue},95%,60%,${pulse * 0.10})`);
    bG1.addColorStop(1,   `hsla(${b.hue},90%,55%,0)`);
    ctx.fillStyle = bG1;
    ctx.beginPath();
    ctx.moveTo(exitX + perp.x * bw * 2.5, exitY + perp.y * bw * 2.5);
    ctx.lineTo(ex    + perp.x * bw * 4,   ey    + perp.y * bw * 4);
    ctx.lineTo(ex    - perp.x * bw * 4,   ey    - perp.y * bw * 4);
    ctx.lineTo(exitX - perp.x * bw * 2.5, exitY - perp.y * bw * 2.5);
    ctx.closePath(); ctx.fill();

    // Core bright beam
    const bG2 = ctx.createLinearGradient(exitX, exitY, ex, ey);
    bG2.addColorStop(0,   `hsla(${b.hue},100%,82%,${pulse * 0.65})`);
    bG2.addColorStop(0.4, `hsla(${b.hue},100%,72%,${pulse * 0.38})`);
    bG2.addColorStop(1,   `hsla(${b.hue},95%,65%,0)`);
    ctx.fillStyle = bG2;
    ctx.beginPath();
    ctx.moveTo(exitX + perp.x * bw, exitY + perp.y * bw);
    ctx.lineTo(ex    + perp.x * bw * 1.8, ey + perp.y * bw * 1.8);
    ctx.lineTo(ex    - perp.x * bw * 1.8, ey - perp.y * bw * 1.8);
    ctx.lineTo(exitX - perp.x * bw, exitY - perp.y * bw);
    ctx.closePath(); ctx.fill();

    // Thin brilliant edge
    ctx.beginPath(); ctx.moveTo(exitX, exitY); ctx.lineTo(ex, ey);
    ctx.strokeStyle = `hsla(${b.hue},100%,92%,${pulse * 0.55})`;
    ctx.lineWidth = 0.8; ctx.stroke();
  });
  ctx.restore();

  // Exit point glow (prism dispersion point)
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 7; i++) {
    const hue = i * (360 / 7);
    const eg = ctx.createRadialGradient(exitX, exitY, 0, exitX, exitY, 18);
    eg.addColorStop(0, `hsla(${hue},100%,85%,0.18)`);
    eg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = eg; ctx.fillRect(exitX-20, exitY-20, 40, 40);
  }
  ctx.restore();

  // ── Crystal particles drifting in beams ───────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.crystals.forEach((c: any) => {
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.x > 1.05) { c.x = 0.42; c.y = Math.random(); }
    if (c.y < 0 || c.y > 1) c.vy *= -1;
    const pulse = 0.5 + Math.sin(t * 2.2 + c.ph) * 0.35;
    const h = (c.hue + t * 30) % 360;
    const cg = ctx.createRadialGradient(c.x*W, c.y*H, 0, c.x*W, c.y*H, c.size * 3);
    cg.addColorStop(0, `hsla(${h},100%,90%,${c.a * pulse})`);
    cg.addColorStop(0.4, `hsla(${h},95%,70%,${c.a * pulse * 0.35})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(c.x*W, c.y*H, c.size*3, 0, Math.PI*2); ctx.fill();
    // diamond core
    ctx.save();
    ctx.translate(c.x*W, c.y*H); ctx.rotate(t * 0.5 + c.ph);
    ctx.beginPath();
    ctx.moveTo(0, -c.size); ctx.lineTo(c.size*0.6, 0); ctx.lineTo(0, c.size); ctx.lineTo(-c.size*0.6, 0);
    ctx.closePath();
    ctx.fillStyle = `hsla(${h},100%,88%,${c.a * pulse * 0.85})`; ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // ── Refraction rings at exit ───────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.rings.forEach((rg: any) => {
    const rPhase = ((t * 0.45 + rg.phase) % (Math.PI * 2));
    const rR = (rg.r + (rPhase / (Math.PI * 2)) * 0.15) * Math.min(W, H);
    const rA = Math.sin(rPhase) * 0.12;
    if (rA <= 0) return;
    ctx.beginPath(); ctx.arc(exitX, exitY, rR, 0, Math.PI * 2);
    const ringH = (rg.phase / (Math.PI * 2)) * 360;
    ctx.strokeStyle = `hsla(${ringH},100%,80%,${rA})`; ctx.lineWidth = 1; ctx.stroke();
  });
  ctx.restore();

  // ── Vignette ──────────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.18, W/2, H/2, Math.max(W,H)*0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(1,0,8,0.85)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

export default function PrismaticLightBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#03010e", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
