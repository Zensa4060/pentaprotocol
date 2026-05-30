"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;

  // ── init ──────────────────────────────────────────────────────────────────
  if (!s.init) {
    s.init = true;
    s.grains = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: 0.3 + Math.random() * 0.7,
      spd: 0.0008 + Math.random() * 0.0022,
      size: 0.4 + Math.random() * 1.4,
      a: 0.04 + Math.random() * 0.22,
      wAmp: 0.005 + Math.random() * 0.018,
      wFq: 0.6 + Math.random() * 1.2,
      wPh: Math.random() * Math.PI * 2,
      yDrift: (Math.random() - 0.5) * 0.0003,
    }));
    s.streaks = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: 0.35 + Math.random() * 0.55,
      spd: 0.003 + Math.random() * 0.006,
      len: 0.02 + Math.random() * 0.06,
      a: 0.03 + Math.random() * 0.10,
      wPh: Math.random() * Math.PI * 2,
    }));
    s.heatLines = Array.from({ length: 8 }, (_: any, i: number) => ({
      y: 0.48 + i * 0.012,
      ph: i * 0.6,
    }));
    s.stars = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.22,
      r: 0.3 + Math.random() * 1.0,
      ph: Math.random() * Math.PI * 2,
    }));
  }

  // ── sky gradient (sunset → dusk) ──────────────────────────────────────────
  const skyG = ctx.createLinearGradient(0, 0, 0, H);
  skyG.addColorStop(0,    "#0a0408"); // deep night indigo at top
  skyG.addColorStop(0.18, "#1a0610"); // dark purple
  skyG.addColorStop(0.38, "#3d0e08"); // deep crimson
  skyG.addColorStop(0.52, "#8c2208"); // burnt orange band
  skyG.addColorStop(0.62, "#c44010"); // horizon fire
  skyG.addColorStop(0.70, "#b83a14"); // dune crest top
  skyG.addColorStop(1,    "#3a1206"); // dune shadow
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

  // ── stars (upper sky, fading near horizon) ────────────────────────────────
  s.stars.forEach((st: any) => {
    const twinkle = 0.35 + Math.sin(t * 1.8 + st.ph) * 0.22;
    const horizFade = Math.max(0, 1 - st.y / 0.2);
    ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,235,200,${twinkle * horizFade * 0.6})`; ctx.fill();
  });

  // ── sun (half-sunk below horizon, heavy corona) ───────────────────────────
  const sunX = W * 0.72; const sunY = H * 0.605;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  // wide corona haze
  for (let g = 0; g < 5; g++) {
    const cr = H * (0.22 + g * 0.14);
    const cg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, cr);
    const a = (0.18 - g * 0.03);
    cg.addColorStop(0,   `rgba(255,180,60,${a})`);
    cg.addColorStop(0.4, `rgba(255,80,10,${a * 0.4})`);
    cg.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  }
  // sun disc (clipped to above horizon)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, sunY); ctx.clip();
  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.055);
  disc.addColorStop(0,   "rgba(255,255,200,0.98)");
  disc.addColorStop(0.4, "rgba(255,210,80,0.6)");
  disc.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = disc; ctx.fillRect(sunX - H*0.06, sunY - H*0.06, H*0.12, H*0.12);
  ctx.restore();
  ctx.restore();

  // ── atmospheric dust/haze near horizon ───────────────────────────────────
  const hazeG = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.68);
  hazeG.addColorStop(0,   "rgba(180,80,20,0)");
  hazeG.addColorStop(0.5, `rgba(200,100,30,${0.12 + Math.sin(t*0.4)*0.04})`);
  hazeG.addColorStop(1,   "rgba(140,60,10,0)");
  ctx.fillStyle = hazeG; ctx.fillRect(0, H * 0.55, W, H * 0.13);

  // ── dune layers (back to front) ───────────────────────────────────────────
  const layers = [
    { base: 0.60, a1: 0.07, a2: 0.03, f1: 0.007, f2: 0.018, s: 0.004, top: "#6e2008", bot: "#200600", crest: "rgba(220,120,40,0.18)" },
    { base: 0.68, a1: 0.08, a2: 0.035, f1: 0.009, f2: 0.022, s: 0.007, top: "#7a2a0a", bot: "#180400", crest: "rgba(240,140,50,0.22)" },
    { base: 0.76, a1: 0.09, a2: 0.04, f1: 0.011, f2: 0.026, s: 0.010, top: "#903010", bot: "#100200", crest: "rgba(255,160,60,0.28)" },
    { base: 0.85, a1: 0.06, a2: 0.025, f1: 0.014, f2: 0.032, s: 0.014, top: "#a03818", bot: "#080100", crest: "rgba(255,180,80,0.30)" },
  ];

  layers.forEach(l => {
    // dune body
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) {
      const y = l.base * H
        + Math.sin(x * l.f1 + t * l.s) * l.a1 * H
        + Math.sin(x * l.f2 + t * l.s * 1.5 + 1.3) * l.a2 * H
        + Math.sin(x * l.f1 * 2.5 + t * l.s * 0.7 + 0.8) * l.a2 * H * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath();
    const dg = ctx.createLinearGradient(0, l.base * H * 0.9, 0, H);
    dg.addColorStop(0,   l.top);
    dg.addColorStop(0.45, l.bot);
    dg.addColorStop(1,   "#030100");
    ctx.fillStyle = dg; ctx.fill();

    // crest highlight line
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = l.base * H
        + Math.sin(x * l.f1 + t * l.s) * l.a1 * H
        + Math.sin(x * l.f2 + t * l.s * 1.5 + 1.3) * l.a2 * H
        + Math.sin(x * l.f1 * 2.5 + t * l.s * 0.7 + 0.8) * l.a2 * H * 0.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = l.crest; ctx.lineWidth = 1.2; ctx.stroke();
  });

  // ── heat shimmer lines near horizon ──────────────────────────────────────
  s.heatLines.forEach((hl: any) => {
    const shimmerAlpha = 0.025 + Math.sin(t * 4.5 + hl.ph) * 0.015;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = hl.y * H + Math.sin(x * 0.05 + t * 3.2 + hl.ph) * 2.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255,180,80,${shimmerAlpha})`; ctx.lineWidth = 0.7; ctx.stroke();
  });

  // ── windblown sand streaks ─────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.streaks.forEach((sk: any) => {
    sk.x += sk.spd * dt;
    if (sk.x > 1 + sk.len) { sk.x = -sk.len; sk.y = 0.35 + Math.random() * 0.55; }
    const x1 = (sk.x - sk.len) * W;
    const x2 = sk.x * W;
    const wy = sk.y * H + Math.sin(t * 1.2 + sk.wPh) * H * 0.008;
    const sg = ctx.createLinearGradient(x1, wy, x2, wy);
    sg.addColorStop(0,   `rgba(220,150,60,0)`);
    sg.addColorStop(0.3, `rgba(220,150,60,${sk.a})`);
    sg.addColorStop(0.8, `rgba(200,120,40,${sk.a * 0.6})`);
    sg.addColorStop(1,   `rgba(180,100,20,0)`);
    ctx.fillStyle = sg;
    ctx.fillRect(x1, wy - 0.6, x2 - x1, 1.2);
  });
  ctx.restore();

  // ── individual sand grains (flying particles) ────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.grains.forEach((g: any) => {
    g.x += g.spd * dt;
    g.y += g.yDrift * dt + Math.sin(t * g.wFq + g.wPh) * g.wAmp * 0.01;
    if (g.x > 1.05) { g.x = -0.02; g.y = 0.35 + Math.random() * 0.60; }
    if (g.y < 0.28 || g.y > 0.95) g.yDrift *= -1;
    ctx.beginPath(); ctx.arc(g.x * W, g.y * H, g.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(230,160,70,${g.a})`; ctx.fill();
  });
  ctx.restore();

  // ── dust veil over upper dunes ────────────────────────────────────────────
  const dustG = ctx.createLinearGradient(0, H * 0.58, 0, H * 0.72);
  dustG.addColorStop(0, `rgba(160,80,20,${0.06 + Math.sin(t * 0.55) * 0.02})`);
  dustG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = dustG; ctx.fillRect(0, H * 0.58, W, H * 0.14);

  // ── top vignette ──────────────────────────────────────────────────────────
  const topV = ctx.createLinearGradient(0, 0, 0, H * 0.12);
  topV.addColorStop(0, "rgba(2,0,4,0.65)"); topV.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topV; ctx.fillRect(0, 0, W, H * 0.12);

  // side vignette
  const lv = ctx.createLinearGradient(0, 0, W * 0.12, 0);
  lv.addColorStop(0, "rgba(2,0,4,0.4)"); lv.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lv; ctx.fillRect(0, 0, W * 0.12, H);
  const rv = ctx.createLinearGradient(W * 0.88, 0, W, 0);
  rv.addColorStop(0, "rgba(0,0,0,0)"); rv.addColorStop(1, "rgba(2,0,4,0.4)");
  ctx.fillStyle = rv; ctx.fillRect(W * 0.88, 0, W * 0.12, H);
}

export default function SandDunesBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#0a0408", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
