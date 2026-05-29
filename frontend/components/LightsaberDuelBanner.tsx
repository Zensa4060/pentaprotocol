"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.sparks) {
    s.sparks = Array.from({ length: 80 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0.6, col: [255, 100, 80], trail: [] as {x:number;y:number}[] }));
    s.flash = 0; s.flashTimer = 0;
  }
  s.flash = Math.max(0, s.flash - 0.07);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `rgba(${8 + s.flash * 25},${3 + s.flash * 10},${18 + s.flash * 30},1)`);
  bg.addColorStop(0.5, `rgba(${10 + s.flash * 20},${4 + s.flash * 8},${22 + s.flash * 25},1)`);
  bg.addColorStop(1, `rgba(${6 + s.flash * 25},${2 + s.flash * 10},${14 + s.flash * 30},1)`);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const clash = { x: W / 2 + Math.sin(t * 0.5) * W * 0.06, y: H / 2 + Math.cos(t * 0.4) * H * 0.12 };
  const s1 = { x1: -W * 0.02, y1: H * (0.75 + Math.sin(t * 0.3) * 0.12), x2: clash.x, y2: clash.y };
  const s2 = { x1: W * 1.02, y1: H * (0.8 + Math.cos(t * 0.35) * 0.1), x2: clash.x, y2: clash.y };

  function drawBlade(x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const passes = [{ lw: 24, a: 0.08 }, { lw: 14, a: 0.15 }, { lw: 7, a: 0.28 }, { lw: 3, a: 0.55 }, { lw: 1.2, a: 0.9 }];
    passes.forEach(p => {
      const grd = ctx.createLinearGradient(x1, y1, x2, y2);
      grd.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grd.addColorStop(0.15, `rgba(${r},${g},${b},${p.a * 0.6})`);
      grd.addColorStop(0.7, `rgba(${r},${g},${b},${p.a})`);
      grd.addColorStop(1, `rgba(255,255,255,${p.a})`);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = grd; ctx.lineWidth = p.lw; ctx.stroke();
    });
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    const amb = ctx.createRadialGradient(midX, midY, 0, midX, midY, W * 0.6);
    amb.addColorStop(0, `rgba(${r},${g},${b},0.06)`); amb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = amb; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  drawBlade(s1.x1, s1.y1, s1.x2, s1.y2, 255, 50, 60);
  drawBlade(s2.x1, s2.y1, s2.x2, s2.y2, 60, 130, 255);

  const clashPulse = 0.7 + Math.sin(t * 14) * 0.22 + Math.sin(t * 9) * 0.1;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let g = 0; g < 6; g++) {
    const gr = H * (0.07 + g * 0.05) * clashPulse;
    const ig = ctx.createRadialGradient(clash.x, clash.y, 0, clash.x, clash.y, gr);
    ig.addColorStop(0, `rgba(255,255,255,${(0.55 - g * 0.08) * clashPulse})`);
    ig.addColorStop(0.4, `rgba(200,160,255,${(0.2 - g * 0.03) * clashPulse})`);
    ig.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(clash.x, clash.y, gr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (Math.random() > 0.3) {
    for (let i = 0; i < 2; i++) {
      const sp = s.sparks[Math.floor(Math.random() * s.sparks.length)];
      if (sp.life <= 0) {
        sp.x = clash.x + (Math.random() - 0.5) * 8; sp.y = clash.y + (Math.random() - 0.5) * 8;
        const a = Math.random() * Math.PI * 2, spd = 2.5 + Math.random() * 6;
        sp.vx = Math.cos(a) * spd; sp.vy = Math.sin(a) * spd - 2;
        sp.life = sp.maxLife; sp.trail = [];
        sp.col = Math.random() > 0.5 ? [255, 120, 80] : [100, 160, 255];
      }
    }
  }
  s.sparks.forEach((sp: any) => {
    if (sp.life <= 0) return;
    sp.trail.unshift({ x: sp.x, y: sp.y });
    if (sp.trail.length > 7) sp.trail.pop();
    sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.18; sp.vx *= 0.97; sp.life -= 1 / 60;
    const p = sp.life / sp.maxLife;
    if (sp.x < 0 || sp.x > W || sp.y > H + 20) { sp.life = 0; return; }
    ctx.save(); ctx.globalCompositeOperation = "screen";
    if (sp.trail.length > 1) {
      ctx.beginPath(); ctx.moveTo(sp.trail[0].x, sp.trail[0].y);
      sp.trail.forEach((pt: any) => ctx.lineTo(pt.x, pt.y));
      const tg = ctx.createLinearGradient(sp.trail[0].x, sp.trail[0].y, sp.trail[sp.trail.length - 1].x, sp.trail[sp.trail.length - 1].y);
      tg.addColorStop(0, `rgba(${sp.col[0]},${sp.col[1]},${sp.col[2]},${p * 0.8})`);
      tg.addColorStop(1, `rgba(${sp.col[0]},${sp.col[1]},${sp.col[2]},0)`);
      ctx.strokeStyle = tg; ctx.lineWidth = 1.2 * p; ctx.stroke();
    }
    const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, Math.max(0.01, 3 * p));
    sg.addColorStop(0, `rgba(255,255,220,${p})`); sg.addColorStop(1, "rgba(0,0,0,0)");
    const r = Math.max(0, 3 * p); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });

  ctx.save(); ctx.globalCompositeOperation = "screen";
  const floor = ctx.createLinearGradient(0, H * 0.65, 0, H);
  floor.addColorStop(0, "rgba(0,0,0,0)"); floor.addColorStop(0.5, "rgba(80,20,40,0.04)"); floor.addColorStop(1, "rgba(30,30,80,0.06)");
  ctx.fillStyle = floor; ctx.fillRect(0, 0, W, H); ctx.restore();
}

export default function LightsaberDuelBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#06020e", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
