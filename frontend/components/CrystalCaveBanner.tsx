"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function drawCrystal(ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, hue: number, tilt: number, phase: number, t: number) {
  const scaleY=0.48+Math.abs(Math.cos(tilt*0.5+t*0.02))*0.5;const pulse=Math.sin(t*1.2+phase)*0.5+0.5;
  ctx.save();ctx.translate(cx,cy);ctx.scale(1,scaleY);
  ctx.save();ctx.globalCompositeOperation="screen";const gg=ctx.createRadialGradient(0,0,sz*0.3,0,0,sz*2.4);gg.addColorStop(0,`hsla(${hue},80%,65%,${0.07+pulse*0.05})`);gg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=gg;ctx.beginPath();ctx.arc(0,0,sz*2.4,0,Math.PI*2);ctx.fill();ctx.restore();
  for(let f=0;f<6;f++){const a1=(f/6)*Math.PI*2-Math.PI/6,a2=((f+1)/6)*Math.PI*2-Math.PI/6,fL=Math.cos(a1+a2)*0.5+0.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a1)*sz,Math.sin(a1)*sz);ctx.lineTo(Math.cos(a2)*sz,Math.sin(a2)*sz);ctx.closePath();ctx.fillStyle=`hsla(${hue+f*9+t*5},70%,${30+fL*40}%,${0.12+fL*0.18+pulse*0.06})`;ctx.fill();ctx.beginPath();ctx.moveTo(Math.cos(a1)*sz,Math.sin(a1)*sz);ctx.lineTo(Math.cos(a2)*sz,Math.sin(a2)*sz);ctx.strokeStyle=`hsla(${hue+20},85%,75%,${0.18+pulse*0.18})`;ctx.lineWidth=0.6;ctx.stroke();}
  ctx.beginPath();ctx.arc(-sz*0.22,-sz*0.24,sz*0.22,0,Math.PI*2);ctx.fillStyle=`rgba(240,230,255,${0.14+pulse*0.15})`;ctx.fill();ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const rng=(seed: number)=>{let x=Math.sin(seed)*10000;return x-Math.floor(x);};
  if(!s.crystals||s.W!==W){s.W=W;const count=Math.max(12,Math.min(28,Math.floor(W/42)));s.crystals=Array.from({length:count},(_: any,i: number)=>({x:rng(i*17)*W,y:rng(i*19)*H,size:Math.min(W,H*2.5)*(0.04+rng(i*23)*0.08),hue:240+rng(i*29)*80,tilt:rng(i*31)*Math.PI,phase:rng(i*37)*Math.PI*2,rotSpd:(rng(i*41)-0.5)*0.004}));}
  const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.hypot(W/2,H/2));bg.addColorStop(0,"#0e0820");bg.addColorStop(0.5,"#080515");bg.addColorStop(1,"#040210");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const dt=(s._dt as number)??1; s.crystals.forEach((c: any)=>{c.tilt+=c.rotSpd*dt;drawCrystal(ctx,c.x,c.y,c.size,c.hue,c.tilt,c.phase,t);});
  const ceil=ctx.createLinearGradient(0,0,0,H*0.15);ceil.addColorStop(0,"rgba(2,1,8,0.9)");ceil.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=ceil;ctx.fillRect(0,0,W,H*0.15);
  const floor=ctx.createLinearGradient(0,H*0.85,0,H);floor.addColorStop(0,"rgba(0,0,0,0)");floor.addColorStop(1,"rgba(2,1,8,0.9)");ctx.fillStyle=floor;ctx.fillRect(0,H*0.85,W,H*0.15);
  ctx.save();ctx.globalCompositeOperation="screen";const atm=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.5);atm.addColorStop(0,`rgba(60,28,120,${0.04+Math.sin(t*0.5)*0.02})`);atm.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=atm;ctx.fillRect(0,0,W,H);ctx.restore();
}

export default function CrystalCaveBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#080515", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
