"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;

  // ── init ──────────────────────────────────────────────────────────────────
  if (!s.init) {
    s.init = true;
    // Blooms: large bioluminescent ink diffusion clouds
    s.blooms = Array.from({ length: 7 }, (_: any, i: number) => ({
      x: 0.1 + (i / 6) * 0.82,
      y: 0.15 + (i % 3) * 0.34,
      phase: i * 0.85,
      speed: 0.038 + i * 0.006,
      maxR: 0.12 + (i % 4) * 0.05,
      hue: [190, 260, 310, 175, 290, 220, 340][i],
      satBoost: 0.6 + Math.random() * 0.4,
      life: i * 0.15,
    }));
    // Tendrils: curling ink filaments
    s.tendrils = Array.from({ length: 22 }, (_: any, i: number) => ({
      ox: i / 21,
      oy: 0.08 + (i % 6) * 0.16,
      angle: Math.random() * Math.PI * 2,
      len: 0.06 + Math.random() * 0.14,
      speed: 0.02 + Math.random() * 0.025,
      hue: 180 + Math.random() * 150,
      ph: Math.random() * Math.PI * 2,
      width: 0.002 + Math.random() * 0.005,
      curlAmt: 0.3 + Math.random() * 0.8,
    }));
    // Motes: tiny glowing particles
    s.motes = Array.from({ length: 55 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -0.1 - Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      life: Math.random(),
      maxLife: 1.0,
      r: 0.5 + Math.random() * 1.8,
      hue: 180 + Math.random() * 160,
    }));
    // Deep background micro-dots
    s.bgDots = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.3 + Math.random() * 0.9,
      a: 0.02 + Math.random() * 0.07,
      ph: Math.random() * Math.PI * 2,
    }));
  }

  // ── deep ocean background ─────────────────────────────────────────────────
  const bgG = ctx.createLinearGradient(0, 0, W, H);
  bgG.addColorStop(0,   "#010408");
  bgG.addColorStop(0.35,"#020810");
  bgG.addColorStop(0.7, "#010512");
  bgG.addColorStop(1,   "#02030a");
  ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

  // ── background micro-dots (deep sea organisms) ────────────────────────────
  s.bgDots.forEach((d: any) => {
    const tw = 0.3 + Math.sin(t * 1.2 + d.ph) * 0.25;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,220,${d.a * tw})`; ctx.fill();
  });

  // ── tendrils: curling ink filaments ───────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.tendrils.forEach((ten: any) => {
    const tx = ten.ox * W, ty = ten.oy * H;
    const angle = ten.angle + Math.sin(t * ten.speed + ten.ph) * ten.curlAmt;
    const len = ten.len * Math.min(W, H * 2.5);
    // draw as a bezier curl
    const cp1x = tx + Math.cos(angle + 0.5) * len * 0.45;
    const cp1y = ty + Math.sin(angle + 0.5) * len * 0.45;
    const cp2x = tx + Math.cos(angle - 0.3) * len * 0.82;
    const cp2y = ty + Math.sin(angle - 0.3) * len * 0.82;
    const ex = tx + Math.cos(angle) * len;
    const ey = ty + Math.sin(angle) * len;
    const h = (ten.hue + t * 12) % 360;
    const tg = ctx.createLinearGradient(tx, ty, ex, ey);
    tg.addColorStop(0,    `hsla(${h},90%,65%,0.55)`);
    tg.addColorStop(0.45, `hsla(${h},85%,55%,0.28)`);
    tg.addColorStop(1,    `hsla(${h},80%,45%,0)`);
    ctx.strokeStyle = tg; ctx.lineWidth = ten.width * W;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
    ctx.stroke();
    // secondary thinner curl branching off
    const bAngle = angle + ten.curlAmt * 0.6;
    const bLen = len * 0.45;
    const btg = ctx.createLinearGradient(cp1x, cp1y, cp1x + Math.cos(bAngle) * bLen, cp1y + Math.sin(bAngle) * bLen);
    btg.addColorStop(0, `hsla(${(h + 30) % 360},90%,70%,0.22)`);
    btg.addColorStop(1, `hsla(${(h + 30) % 360},80%,50%,0)`);
    ctx.strokeStyle = btg; ctx.lineWidth = ten.width * W * 0.45;
    ctx.beginPath(); ctx.moveTo(cp1x, cp1y);
    ctx.lineTo(cp1x + Math.cos(bAngle) * bLen, cp1y + Math.sin(bAngle) * bLen);
    ctx.stroke();
  });
  ctx.restore();

  // ── blooms: expanding bioluminescent ink clouds ───────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.blooms.forEach((bl: any) => {
    bl.life = (bl.life + bl.speed * 0.016 * dt) % 1;
    const r = bl.maxR * Math.min(W, H * 2.2) * bl.life;
    const progress = bl.life;
    // alpha envelope: rise quickly, hold, fade out
    const alpha = progress < 0.2
      ? (progress / 0.2) * 0.85
      : (1 - (progress - 0.2) / 0.8) * 0.85;
    if (alpha < 0.01 || r < 1) return;
    const dx = bl.x * W, dy = bl.y * H;
    const h = (bl.hue + t * 18) % 360;

    // main bloom radial
    const bg = ctx.createRadialGradient(dx, dy, 0, dx, dy, r);
    bg.addColorStop(0,    `hsla(${h},100%,82%,${alpha * 0.9})`);
    bg.addColorStop(0.28, `hsla(${h},95%,60%,${alpha * 0.55})`);
    bg.addColorStop(0.65, `hsla(${h},85%,40%,${alpha * 0.18})`);
    bg.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();

    // inner bright core
    const cr = r * 0.18;
    const cg = ctx.createRadialGradient(dx, dy, 0, dx, dy, cr);
    cg.addColorStop(0, `rgba(255,255,255,${alpha * 0.7})`);
    cg.addColorStop(1, `hsla(${h},100%,75%,0)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(dx, dy, cr, 0, Math.PI * 2); ctx.fill();

    // ink spatter tendrils radiating out from bloom center
    for (let si = 0; si < 8; si++) {
      const sAngle = (si / 8) * Math.PI * 2 + t * 0.08 + bl.phase;
      const sLen = r * (0.45 + Math.sin(t * bl.speed * 4 + si) * 0.18);
      const stg = ctx.createLinearGradient(dx, dy, dx + Math.cos(sAngle) * sLen, dy + Math.sin(sAngle) * sLen);
      stg.addColorStop(0, `hsla(${h},100%,75%,${alpha * 0.55})`);
      stg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(sAngle) * sLen, dy + Math.sin(sAngle) * sLen);
      ctx.strokeStyle = stg; ctx.lineWidth = 2.5 - si * 0.25; ctx.stroke();
    }
  });
  ctx.restore();

  // ── rising motes ──────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.motes.forEach((m: any) => {
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.life -= dt / 380;
    if (m.life <= 0 || m.y < -8) {
      m.x = Math.random() * W; m.y = H + 5;
      m.life = 0.4 + Math.random() * 0.6;
      m.vy = -0.08 - Math.random() * 0.25;
      m.vx = (Math.random() - 0.5) * 0.18;
      m.r = 0.5 + Math.random() * 1.8;
      m.hue = 180 + Math.random() * 160;
    }
    const p = m.life;
    const h = (m.hue + t * 25) % 360;
    const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.5);
    mg.addColorStop(0,   `hsla(${h},100%,88%,${p * 0.9})`);
    mg.addColorStop(0.4, `hsla(${h},90%,60%,${p * 0.3})`);
    mg.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  // ── vignette (soft dark edges) ────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.22, W/2, H/2, Math.max(W,H)*0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,2,8,0.80)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

  // scanline texture
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.04)"; ctx.fillRect(0, y, W, 1);
  }
}

export default function InkDropBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#010408", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
