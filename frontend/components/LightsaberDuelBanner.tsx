"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

// ── Neon City Rain — cyberpunk cityscape banner ───────────────────────────────
// Layered building silhouettes, heavy rain with neon reflections, animated
// neon signs, flying vehicles, holographic billboard, atmospheric fog.

interface RainDrop { x: number; y: number; len: number; spd: number; a: number; col: [number,number,number]; }
interface Vehicle  { x: number; y: number; vx: number; col: [number,number,number]; size: number; trail: number; }
interface Drone    { x: number; y: number; vx: number; vy: number; ph: number; col: [number,number,number]; }
interface NeonSign { x: number; y: number; w: number; h: number; hue: number; ph: number; flickerSpd: number; label: string; }

const SIGN_LABELS = ["UPLOAD", "NOODLES", "CYBER", "NEXUS", "GHOST", "DATA", "RUN", "JACK IN", "SYNTHWAVE", "PROTOCOL"];

function buildLayer(ctx: CanvasRenderingContext2D, W: number, H: number,
  skylineY: number, bW: number, bH: number, cols: number, seed: number,
  fillColor: string, windowColor: string, t: number
) {
  for (let i = 0; i < cols; i++) {
    const s = seed + i * 7.3;
    const bx = i * bW - (bW * 0.15);
    const bh = bH * (0.4 + ((Math.sin(s) * 0.5 + 0.5)) * 0.6);
    const by = skylineY - bh;
    const bww = bW * (0.55 + (Math.sin(s * 1.7) * 0.5 + 0.5) * 0.35);
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, bww, bh);
    // windows
    const wCols = Math.max(1, Math.floor(bww / 7));
    const wRows = Math.max(1, Math.floor(bh / 10));
    for (let wc = 0; wc < wCols; wc++) {
      for (let wr = 0; wr < wRows; wr++) {
        const wSeed = s + wc * 3.1 + wr * 1.7;
        const lit = Math.sin(wSeed * 12.9 + t * 0.08) > 0.05;
        if (!lit) continue;
        const wx = bx + wc * 7 + 2;
        const wy = by + wr * 10 + 3;
        ctx.fillStyle = windowColor;
        ctx.fillRect(wx, wy, 3, 4);
      }
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;

  // ── init ──────────────────────────────────────────────────────────────────
  if (!s.init) {
    s.init = true;
    const nRain = Math.min(600, Math.max(200, Math.floor(W * H / 600)));
    s.rain = Array.from({ length: nRain }, (): RainDrop => ({
      x: Math.random(), y: Math.random(),
      len: 0.018 + Math.random() * 0.028,
      spd: 0.006 + Math.random() * 0.010,
      a: 0.06 + Math.random() * 0.20,
      col: Math.random() > 0.85
        ? [Math.floor(80+Math.random()*80), Math.floor(180+Math.random()*75), 255]
        : [160, 200, 255],
    }));
    s.vehicles = Array.from({ length: 8 }, (): Vehicle => ({
      x: Math.random(),
      y: 0.78 + Math.random() * 0.08,
      vx: (0.003 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
      col: [[255,60,120],[60,220,255],[255,180,20],[200,80,255]][Math.floor(Math.random()*4)] as [number,number,number],
      size: 2 + Math.random() * 2,
      trail: 0.04 + Math.random() * 0.08,
    }));
    s.drones = Array.from({ length: 6 }, (): Drone => ({
      x: Math.random(), y: 0.18 + Math.random() * 0.38,
      vx: (0.0005 + Math.random() * 0.001) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() - 0.5) * 0.0003,
      ph: Math.random() * Math.PI * 2,
      col: [[0,255,200],[255,80,180],[80,200,255]][Math.floor(Math.random()*3)] as [number,number,number],
    }));
    const nSigns = Math.max(3, Math.ceil(W / 180));
    s.signs = Array.from({ length: nSigns }, (_: any, i: number): NeonSign => ({
      x: 0.05 + (i / nSigns) * 0.88,
      y: 0.42 + Math.random() * 0.22,
      w: 0.06 + Math.random() * 0.06,
      h: 0.03 + Math.random() * 0.02,
      hue: (i * 55 + Math.random() * 40) % 360,
      ph: Math.random() * Math.PI * 2,
      flickerSpd: 1.5 + Math.random() * 3.5,
      label: SIGN_LABELS[i % SIGN_LABELS.length],
    }));
    s.billboard = { hue: 180, timer: 0, textIdx: 0 };
    s.lightningTimer = 80 + Math.random() * 160;
    s.lightningFlash = 0;
    s.fogOffset = 0;
    s.puddles = Array.from({ length: 12 }, () => ({
      x: Math.random(), r: 0.02 + Math.random() * 0.06, a: 0.12 + Math.random() * 0.18,
    }));
  }

  // ── sky gradient ──────────────────────────────────────────────────────────
  const lf = s.lightningFlash;
  const skyG = ctx.createLinearGradient(0, 0, 0, H);
  skyG.addColorStop(0,   `rgb(${2+lf*20},${4+lf*12},${18+lf*35})`);
  skyG.addColorStop(0.35,`rgb(${5+lf*15},${4+lf*10},${24+lf*28})`);
  skyG.addColorStop(0.7, `rgb(${8+lf*12},${5+lf*8}, ${20+lf*22})`);
  skyG.addColorStop(1,   `rgb(${4+lf*8}, ${3+lf*5}, ${12+lf*15})`);
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

  // ── distant city glow (ambient neon light pollution) ─────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const glows = [
    { x: 0.25, hue: 300, a: 0.08 + lf*0.05 },
    { x: 0.55, hue: 195, a: 0.07 + lf*0.04 },
    { x: 0.80, hue: 340, a: 0.09 + lf*0.06 },
  ];
  glows.forEach(g => {
    const gg = ctx.createRadialGradient(g.x*W, H*0.65, 0, g.x*W, H*0.65, W*0.3);
    gg.addColorStop(0, `hsla(${g.hue},100%,65%,${g.a})`);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();

  // ── building layers (back to front) ──────────────────────────────────────
  const streetY = H * 0.82;
  const layers = [
    { skyY: 0.58, bW: W/6,  bH: H*0.32, fill: "rgba(4,4,16,0.95)",   win: "rgba(255,230,160,0.22)", seed: 11 },
    { skyY: 0.62, bW: W/8,  bH: H*0.38, fill: "rgba(6,4,20,0.97)",   win: "rgba(200,220,255,0.18)", seed: 23 },
    { skyY: 0.68, bW: W/11, bH: H*0.46, fill: "rgba(8,5,22,0.98)",   win: "rgba(255,200,255,0.15)", seed: 37 },
    { skyY: 0.74, bW: W/14, bH: H*0.55, fill: "rgba(3,3,10,1.00)",   win: "rgba(160,220,255,0.20)", seed: 53 },
    { skyY: 0.79, bW: W/18, bH: H*0.65, fill: "rgba(2,2,8,1.00)",    win: "rgba(255,180,255,0.14)", seed: 71 },
  ];
  layers.forEach(l => {
    const cols = Math.ceil(W / l.bW) + 2;
    buildLayer(ctx, W, H, l.skyY * H, l.bW, l.bH, cols, l.seed, l.fill, l.win, t);
  });

  // ── neon signs ────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.signs.forEach((sg: NeonSign) => {
    const flicker = Math.sin(t * sg.flickerSpd + sg.ph);
    const on = flicker > -0.65;
    if (!on) return;
    const intensity = 0.55 + Math.max(0, flicker) * 0.38;
    const sx = sg.x * W, sy = sg.y * H;
    const sw = sg.w * W, sh = sg.h * H;
    // sign glow box
    const sbg = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    sbg.addColorStop(0, `hsla(${sg.hue},100%,65%,${intensity * 0.22})`);
    sbg.addColorStop(1, `hsla(${(sg.hue+30)%360},100%,70%,${intensity * 0.14})`);
    ctx.fillStyle = sbg; ctx.fillRect(sx - sw*0.3, sy - sh*0.5, sw*1.6, sh*2);
    // sign border
    ctx.strokeStyle = `hsla(${sg.hue},100%,72%,${intensity * 0.85})`;
    ctx.lineWidth = 1; ctx.strokeRect(sx, sy, sw, sh);
    // sign text
    const fontSize = Math.max(6, sh * 0.7);
    ctx.font = `900 ${fontSize}px monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = `hsla(${sg.hue},100%,85%,${intensity * 0.9})`;
    ctx.fillText(sg.label, sx + sw/2, sy + sh/2);
    // halo
    const hg = ctx.createRadialGradient(sx+sw/2, sy+sh/2, 0, sx+sw/2, sy+sh/2, sw*0.9);
    hg.addColorStop(0, `hsla(${sg.hue},100%,70%,${intensity * 0.12})`);
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg; ctx.fillRect(sx - sw, sy - sh*2, sw*3, sh*5);
  });
  ctx.restore();

  // ── holographic billboard ─────────────────────────────────────────────────
  s.billboard.timer += dt;
  if (s.billboard.timer > 180) { s.billboard.timer = 0; s.billboard.textIdx = (s.billboard.textIdx + 1) % 4; s.billboard.hue = (s.billboard.hue + 90) % 360; }
  const bLines = [["ENTER THE", "PROTOCOL"], ["JOIN THE", "NETWORK"], ["ACCESS", "GRANTED"], ["PENTA", "PROTOCOL"]];
  const bX = W * 0.52, bY = H * 0.38, bW2 = W * 0.26, bH2 = H * 0.16;
  const bHue = s.billboard.hue;
  const bPulse = 0.7 + Math.sin(t * 2.2) * 0.25;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  // billboard frame
  const bfg = ctx.createLinearGradient(bX, bY, bX+bW2, bY+bH2);
  bfg.addColorStop(0, `hsla(${bHue},100%,60%,${bPulse * 0.3})`);
  bfg.addColorStop(1, `hsla(${(bHue+60)%360},100%,65%,${bPulse * 0.2})`);
  ctx.fillStyle = bfg; ctx.fillRect(bX, bY, bW2, bH2);
  ctx.strokeStyle = `hsla(${bHue},100%,75%,${bPulse * 0.7})`;
  ctx.lineWidth = 1.2; ctx.strokeRect(bX, bY, bW2, bH2);
  // scanlines on billboard
  for (let by2 = bY; by2 < bY+bH2; by2 += 3) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(bX, by2, bW2, 1);
  }
  // billboard text
  const bl = bLines[s.billboard.textIdx];
  const bfs = Math.max(9, bH2 * 0.28);
  ctx.font = `900 ${bfs}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = `hsla(${bHue},100%,88%,${bPulse * 0.95})`;
  ctx.fillText(bl[0], bX + bW2/2, bY + bH2*0.34);
  ctx.fillStyle = `hsla(${(bHue+40)%360},100%,80%,${bPulse * 0.85})`;
  ctx.fillText(bl[1], bX + bW2/2, bY + bH2*0.68);
  // billboard outer glow
  const bog = ctx.createRadialGradient(bX+bW2/2, bY+bH2/2, 0, bX+bW2/2, bY+bH2/2, bW2*0.9);
  bog.addColorStop(0, `hsla(${bHue},100%,65%,${bPulse * 0.15})`);
  bog.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bog; ctx.fillRect(bX - bW2*0.5, bY - bH2, bW2*2, bH2*3);
  ctx.restore();

  // ── street / ground ───────────────────────────────────────────────────────
  const streetG = ctx.createLinearGradient(0, streetY, 0, H);
  streetG.addColorStop(0, `rgb(${4+lf*10},${5+lf*8},${16+lf*18})`);
  streetG.addColorStop(0.4, `rgb(3,4,12)`);
  streetG.addColorStop(1, `rgb(2,2,8)`);
  ctx.fillStyle = streetG; ctx.fillRect(0, streetY, W, H - streetY);

  // street reflection puddles
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.puddles.forEach((pd: any) => {
    const px = pd.x * W, py = streetY + H * 0.03;
    const pr = pd.r * W;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    // reflect sign colors
    const nearSign = s.signs.find((sg: NeonSign) => Math.abs(sg.x - pd.x) < 0.2);
    const refHue = nearSign ? nearSign.hue : 200;
    pg.addColorStop(0, `hsla(${refHue},90%,55%,${pd.a * (0.5 + Math.sin(t*1.2+pd.x*6)*0.3)})`);
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.save(); ctx.scale(1, 0.28); ctx.beginPath(); ctx.arc(px, py / 0.28, pr, 0, Math.PI*2); ctx.fill(); ctx.restore();
  });
  ctx.restore();

  // ── flying vehicles ───────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.vehicles.forEach((v: Vehicle) => {
    v.x += v.vx * dt;
    if (v.x > 1.12) { v.x = -v.trail; } if (v.x < -v.trail - 0.02) { v.x = 1.12; }
    const vx = v.x * W, vy = v.y * H;
    const trailLen = v.trail * W;
    const tDir = v.vx > 0 ? -1 : 1;
    // trail
    const vtg = ctx.createLinearGradient(vx, vy, vx + tDir * trailLen, vy);
    vtg.addColorStop(0, `rgba(${v.col[0]},${v.col[1]},${v.col[2]},0.6)`);
    vtg.addColorStop(1, `rgba(${v.col[0]},${v.col[1]},${v.col[2]},0)`);
    ctx.fillStyle = vtg; ctx.fillRect(Math.min(vx, vx + tDir*trailLen), vy - v.size*0.4, trailLen, v.size * 0.8);
    // headlights/taillights
    const hg = ctx.createRadialGradient(vx, vy, 0, vx, vy, v.size * 5);
    hg.addColorStop(0, `rgba(${v.col[0]},${v.col[1]},${v.col[2]},0.9)`);
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg; ctx.fillRect(vx - v.size*5, vy - v.size*5, v.size*10, v.size*10);
    // reflection on street below
    if (v.y < 0.84) {
      const reflY = streetY + (v.y * H - streetY) * (-0.18) + H * 0.04;
      const rfg = ctx.createRadialGradient(vx, reflY, 0, vx, reflY, v.size * 4);
      rfg.addColorStop(0, `rgba(${v.col[0]},${v.col[1]},${v.col[2]},0.18)`);
      rfg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rfg; ctx.fillRect(vx - v.size*5, reflY - 4, v.size*10, 8);
    }
  });
  ctx.restore();

  // ── drones ────────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.drones.forEach((dr: Drone) => {
    dr.x += dr.vx * dt; dr.y += dr.vy * dt;
    dr.y += Math.sin(t * 1.8 + dr.ph) * 0.0002 * dt;
    if (dr.x > 1.05) dr.x = -0.02; if (dr.x < -0.05) dr.x = 1.02;
    if (dr.y < 0.12 || dr.y > 0.55) dr.vy *= -1;
    const blink = Math.sin(t * 4.5 + dr.ph) > 0.4;
    if (!blink) return;
    const dg = ctx.createRadialGradient(dr.x*W, dr.y*H, 0, dr.x*W, dr.y*H, 6);
    dg.addColorStop(0, `rgba(${dr.col[0]},${dr.col[1]},${dr.col[2]},0.9)`);
    dg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dg; ctx.fillRect(dr.x*W - 8, dr.y*H - 8, 16, 16);
  });
  ctx.restore();

  // ── rain ──────────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation = "screen";
  s.rain.forEach((r: RainDrop) => {
    r.y += r.spd * dt; r.x -= r.spd * 0.18 * dt;
    if (r.y > 1.0) { r.y = -0.02; r.x = Math.random(); }
    const rx = r.x * W, ry = r.y * H;
    const rLen = r.len * H;
    const rg = ctx.createLinearGradient(rx, ry, rx - rLen*0.18, ry + rLen);
    rg.addColorStop(0, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0)`);
    rg.addColorStop(0.5, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${r.a})`);
    rg.addColorStop(1, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(rx - 0.4, ry, 0.8, rLen);
  });
  ctx.restore();

  // ── fog layers ────────────────────────────────────────────────────────────
  s.fogOffset = (s.fogOffset + 0.00025 * dt) % 1;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let fi = 0; fi < 3; fi++) {
    const fy = H * (0.54 + fi * 0.08);
    const fAlpha = 0.04 + fi * 0.015;
    for (let fx2 = -W; fx2 < W * 2; fx2 += W * 0.55) {
      const fOff = (s.fogOffset * W * (1 + fi * 0.4) + fx2) % (W * 1.5);
      const fg2 = ctx.createRadialGradient(fOff + W*0.25, fy, 0, fOff + W*0.25, fy, W * 0.45);
      fg2.addColorStop(0, `rgba(40,40,80,${fAlpha})`);
      fg2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg2; ctx.fillRect(0, fy - H*0.08, W, H*0.16);
    }
  }
  ctx.restore();

  // ── lightning ─────────────────────────────────────────────────────────────
  s.lightningTimer -= dt;
  s.lightningFlash = Math.max(0, s.lightningFlash - 0.05 * dt);
  if (s.lightningTimer <= 0 && s.lightningFlash <= 0) {
    s.lightningFlash = 0.7 + Math.random() * 0.3;
    s.lightningTimer = 100 + Math.random() * 220;
    s.lightningX = 0.1 + Math.random() * 0.8;
  }
  if (s.lightningFlash > 0.5) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const lx = s.lightningX * W;
    let lx2 = lx, ly2 = 0;
    ctx.beginPath(); ctx.moveTo(lx2, ly2);
    while (ly2 < H * 0.68) {
      lx2 += (Math.random() - 0.5) * W * 0.08;
      ly2 += H * 0.08 + Math.random() * H * 0.05;
      ctx.lineTo(lx2, ly2);
    }
    ctx.strokeStyle = `rgba(200,220,255,${(s.lightningFlash - 0.5) * 1.8 * 0.7})`;
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(s.lightningFlash - 0.5) * 1.5})`;
    ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  }

  // ── scanlines ─────────────────────────────────────────────────────────────
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = "rgba(0,0,0,0.07)"; ctx.fillRect(0, y, W, 1);
  }

  // ── vignette ──────────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W/2, H*0.45, Math.min(W,H)*0.18, W/2, H*0.45, Math.max(W,H)*0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,8,0.82)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

export default function LightsaberDuelBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#02020c", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
