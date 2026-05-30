"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

interface Node { x: number; y: number; vx: number; vy: number; r: number; ph: number; hue: number; charge: number; chargeTimer: number; }
interface Pulse { nodeA: number; nodeB: number; t: number; speed: number; col: [number,number,number]; }

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;
  const AREA = W * H;
  const N = Math.min(72, Math.max(22, Math.floor(AREA / 3600)));
  const CONNECT = Math.min(W * 0.24, H * 1.3);

  // ── init ──────────────────────────────────────────────────────────────────
  if (!s.nodes || s.N !== N) {
    s.N = N;
    s.nodes = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.18,
      r: 1.4 + Math.random() * 2.8,
      ph: Math.random() * Math.PI * 2,
      hue: 160 + Math.random() * 100,
      charge: 0,
      chargeTimer: Math.random() * 180,
    })) as Node[];
    s.pulses = [] as Pulse[];
    s.bgStars = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      a: 0.03 + Math.random() * 0.09,
    }));
  }

  // ── background ────────────────────────────────────────────────────────────
  // Adaptive trail: clear with semi-transparent rect for motion blur/trail
  const trailA = Math.min(0.99, 1 - Math.pow(1 - 0.88, dt));
  ctx.fillStyle = `rgba(3,4,14,${trailA.toFixed(3)})`; ctx.fillRect(0, 0, W, H);

  // deep background stars
  s.bgStars.forEach((st: any) => {
    ctx.beginPath(); ctx.arc(st.x, st.y, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(140,160,220,${st.a})`; ctx.fill();
  });

  // ── update nodes ──────────────────────────────────────────────────────────
  const nodes: Node[] = s.nodes;
  nodes.forEach(n => {
    n.x += n.vx * dt + Math.sin(t * 0.14 + n.ph) * 0.06 * dt;
    n.y += n.vy * dt + Math.cos(t * 0.11 + n.ph) * 0.045 * dt;
    if (n.x < -8) n.x = W + 8; if (n.x > W + 8) n.x = -8;
    if (n.y < -8) n.y = H + 8; if (n.y > H + 8) n.y = -8;
    n.chargeTimer -= dt;
    if (n.chargeTimer <= 0) {
      n.charge = 1.0;
      n.chargeTimer = 120 + Math.random() * 240;
      // fire a pulse along a random nearby connection
      for (let j = 0; j < nodes.length; j++) {
        if (j === nodes.indexOf(n)) continue;
        const dx = nodes[j].x - n.x, dy = nodes[j].y - n.y;
        if (Math.sqrt(dx*dx + dy*dy) < CONNECT) {
          (s.pulses as Pulse[]).push({
            nodeA: nodes.indexOf(n),
            nodeB: j,
            t: 0,
            speed: 0.012 + Math.random() * 0.018,
            col: [
              Math.round(80 + Math.random() * 120),
              Math.round(180 + Math.random() * 75),
              255,
            ] as [number,number,number],
          });
          break;
        }
      }
    }
    n.charge = Math.max(0, n.charge - 0.018 * dt);
  });

  // ── connections ───────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist >= CONNECT) continue;
      const fade = 1 - dist / CONNECT;
      const chargeBoost = (a.charge + b.charge) * 0.4;
      const alpha = fade * (0.10 + chargeBoost * 0.18);
      const hMix = (a.hue + b.hue) / 2;
      const cg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      cg.addColorStop(0, `hsla(${a.hue},90%,62%,${alpha})`);
      cg.addColorStop(0.5, `hsla(${hMix},95%,68%,${alpha * 1.3})`);
      cg.addColorStop(1, `hsla(${b.hue},90%,62%,${alpha})`);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = cg; ctx.lineWidth = fade * (1.2 + chargeBoost * 1.2); ctx.stroke();
    }
  }
  ctx.restore();

  // ── signal pulses traveling along edges ───────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.pulses = (s.pulses as Pulse[]).filter(p => p.t <= 1.0);
  (s.pulses as Pulse[]).forEach(p => {
    p.t += p.speed * dt;
    if (p.t > 1) return;
    const a = nodes[p.nodeA], b = nodes[p.nodeB];
    if (!a || !b) return;
    const px = a.x + (b.x - a.x) * p.t;
    const py = a.y + (b.y - a.y) * p.t;
    // pulse glow
    const r = p.col[0], g2 = p.col[1], bl = p.col[2];
    const pulseG = ctx.createRadialGradient(px, py, 0, px, py, 8);
    pulseG.addColorStop(0,   `rgba(${r},${g2},${bl},0.95)`);
    pulseG.addColorStop(0.35, `rgba(${r},${g2},${bl},0.35)`);
    pulseG.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = pulseG; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
    // bright core
    ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,0.95)`; ctx.fill();
    // wake trail back along edge
    const tBack = Math.max(0, p.t - 0.12);
    const tx = a.x + (b.x - a.x) * tBack, ty = a.y + (b.y - a.y) * tBack;
    const trailG = ctx.createLinearGradient(tx, ty, px, py);
    trailG.addColorStop(0, `rgba(${r},${g2},${bl},0)`);
    trailG.addColorStop(1, `rgba(${r},${g2},${bl},0.55)`);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py);
    ctx.strokeStyle = trailG; ctx.lineWidth = 2.2; ctx.stroke();
  });
  ctx.restore();

  // ── nodes ─────────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  nodes.forEach(n => {
    const pulse = Math.sin(t * 2.6 + n.ph) * 0.5 + 0.5;
    const chargeGlow = n.charge * 0.8;
    const gR = n.r * (5 + chargeGlow * 8);
    const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gR);
    const baseA = 0.45 + pulse * 0.30 + chargeGlow * 0.3;
    ng.addColorStop(0,    `hsla(${n.hue},100%,92%,${baseA})`);
    ng.addColorStop(0.25, `hsla(${n.hue},95%,68%,${baseA * 0.45})`);
    ng.addColorStop(0.6,  `hsla(${n.hue},85%,48%,${0.08 + chargeGlow * 0.12})`);
    ng.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(n.x, n.y, gR, 0, Math.PI * 2); ctx.fill();
    // core dot
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (1 + chargeGlow * 1.5), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${n.hue},100%,${85 + chargeGlow * 15}%,${0.8 + chargeGlow * 0.2})`; ctx.fill();
  });
  ctx.restore();

  // ── center nebula glow ────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const nb = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H) * 0.55);
  nb.addColorStop(0, `rgba(40,80,160,${0.06 + Math.sin(t*0.8)*0.02})`);
  nb.addColorStop(0.5, `rgba(20,50,120,0.03)`);
  nb.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = nb; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ── vignette ──────────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.28, W/2, H/2, Math.max(W,H)*0.82);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(1,2,10,0.72)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

export default function ParticleWebBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#03040e", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
