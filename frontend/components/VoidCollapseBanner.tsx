"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const cx = W/2, cy = H/2, N = 200;
  if (!s.p) {
    s.p = Array.from({ length: N }, () => ({ angle: Math.random()*Math.PI*2, dist: 0.55+Math.random()*0.5, speed: -(0.004+Math.random()*0.01), inward: 0.001+Math.random()*0.0025, hue: 210+Math.random()*130, size: 0.6+Math.random()*2, trail: 0.08+Math.random()*0.15 }));
  }
  ctx.fillStyle = "rgba(2,1,12,0.82)"; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 4; i++) {
    const nx = W*(0.15+i*0.25), ny = H*(0.2+(i%2)*0.55);
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, W*(0.15+i*0.05));
    ng.addColorStop(0, `rgba(${30+i*10},${15+i*5},${80+i*15},0.05)`); ng.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  const maxR = Math.hypot(W/2, H/2);
  s.p.forEach((p: any) => {
    p.angle += p.speed / Math.max(0.08, p.dist*p.dist);
    p.dist = Math.max(0.03, p.dist - p.inward);
    if (p.dist < 0.04) { p.dist = 0.5+Math.random()*0.5; p.angle = Math.random()*Math.PI*2; }
    const r = p.dist*maxR;
    const px2 = cx+Math.cos(p.angle)*r, py2 = cy+Math.sin(p.angle)*r*0.38;
    const trailR = Math.max(0,(p.dist-p.trail))*maxR;
    const tx2 = cx+Math.cos(p.angle-p.speed*8)*trailR, ty2 = cy+Math.sin(p.angle-p.speed*8)*trailR*0.38;
    const brightness = Math.max(0, Math.min(1,(1-p.dist+0.1)*1.8));
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const tg = ctx.createLinearGradient(tx2, ty2, px2, py2);
    tg.addColorStop(0, `hsla(${p.hue},90%,70%,0)`); tg.addColorStop(1, `hsla(${p.hue},92%,75%,${brightness*0.65})`);
    ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px2, py2);
    ctx.strokeStyle = tg; ctx.lineWidth = Math.max(0, p.size*brightness); ctx.stroke();
    ctx.beginPath(); ctx.arc(px2, py2, Math.max(0, p.size*0.6*brightness), 0, Math.PI*2);
    ctx.fillStyle = `hsla(${p.hue},100%,85%,${brightness*0.7})`; ctx.fill(); ctx.restore();
  });
  const coreR = Math.min(W*0.035, H*0.2);
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR*1.6);
  cg.addColorStop(0, "rgba(0,0,0,1)"); cg.addColorStop(0.75, "rgba(0,0,0,1)"); cg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const pr = ctx.createRadialGradient(cx, cy, coreR*0.88, cx, cy, coreR*1.3);
  pr.addColorStop(0, `rgba(255,220,100,${0.45+Math.sin(t*1.8)*0.1})`); pr.addColorStop(1, "rgba(255,160,40,0)");
  ctx.fillStyle = pr; ctx.fillRect(0, 0, W, H); ctx.restore();
}

export default function VoidCollapseBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#02010c", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
