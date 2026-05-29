"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const rng = (seed: number) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  if (!s.stars) {
    s.stars = Array.from({ length: 160 }, (_: any, i: number) => ({ x: rng(i*13)*W, y: rng(i*17)*H*0.75, r: rng(i*19)*0.9+0.15, ph: rng(i*23)*Math.PI*2, sp: 0.3+rng(i*29)*2 }));
    s.curtains = [
      { hue:148, speed:0.18, phase:0.0, amp:1.0 }, { hue:165, speed:0.22, phase:1.2, amp:0.85 },
      { hue:180, speed:0.14, phase:2.4, amp:0.9 }, { hue:200, speed:0.26, phase:3.6, amp:0.75 },
      { hue:290, speed:0.19, phase:4.8, amp:0.7 },
    ];
  }
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#000c12"); bg.addColorStop(0.6, "#010f18"); bg.addColorStop(1, "#010810");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  s.stars.forEach((st: any) => {
    const tw = Math.sin(t * st.sp + st.ph) * 0.5 + 0.5;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r * (0.35 + tw * 0.65), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210,230,255,${0.06 + tw * 0.55})`; ctx.fill();
  });
  s.curtains.forEach((c: any, ci: number) => {
    const bright = 0.55 + Math.sin(t * 0.4 + c.phase) * 0.35;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath(); ctx.moveTo(-10, 0);
      for (let x = -10; x <= W + 10; x += 5) {
        const topY = H*(0.02+ci*0.04) + H*0.08*Math.sin(x*0.006+t*c.speed+c.phase) + H*0.04*Math.sin(x*0.013+t*c.speed*1.4+c.phase+1.2);
        x === -10 ? ctx.moveTo(x, topY) : ctx.lineTo(x, topY);
      }
      ctx.lineTo(W+10, H); ctx.lineTo(-10, H); ctx.closePath();
      const grd = ctx.createLinearGradient(0, H*(0.02+ci*0.04), 0, H);
      const a = (0.14 - pass*0.04)*bright*c.amp;
      grd.addColorStop(0, `hsla(${c.hue},95%,65%,${a})`); grd.addColorStop(0.2, `hsla(${c.hue+15},90%,68%,${a*1.1})`);
      grd.addColorStop(0.5, `hsla(${c.hue},85%,60%,${a*0.7})`); grd.addColorStop(1, `hsla(${c.hue},80%,55%,0)`);
      ctx.fillStyle = grd; ctx.fill();
    }
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = H*(0.02+ci*0.04) + H*0.08*Math.sin(x*0.006+t*c.speed+c.phase) + H*0.04*Math.sin(x*0.013+t*c.speed*1.4+c.phase+1.2);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${c.hue},100%,82%,${0.2*bright})`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  });
  const ground = ctx.createLinearGradient(0, H*0.78, 0, H);
  ground.addColorStop(0, "rgba(0,0,0,0)"); ground.addColorStop(1, "rgba(0,6,4,0.75)");
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
}

export default function NorthernLightsBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#000c12", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
