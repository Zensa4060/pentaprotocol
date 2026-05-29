"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.beams) {
    const n=Math.max(7,Math.ceil(W/90));
    s.beams=Array.from({length:n},(_: any,i: number)=>({hue:i*(340/n),angle:(i/(n-1))*Math.PI*0.9-Math.PI*0.45,speed:0.07+i*0.012,phase:i*0.6,width:0.035+Math.random()*0.04}));
    s.caustics=Array.from({length:20},()=>({x:Math.random(),y:Math.random(),r:0.015+Math.random()*0.04,hue:Math.random()*360,ph:Math.random()*Math.PI*2,spd:0.18+Math.random()*0.35}));
  }
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#f0f2f8");bg.addColorStop(0.5,"#f8fafc");bg.addColorStop(1,"#eef0f6");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  s.beams.forEach((b: any,bi: number)=>{
    const srcX=W*(0.05+bi/(s.beams.length-1)*0.9),srcY=H*(0.1+Math.sin(t*b.speed+b.phase)*0.15);
    const angle=b.angle+Math.sin(t*b.speed+b.phase)*0.22;const len=Math.hypot(W,H)*1.1;
    const ex=srcX+Math.cos(angle)*len,ey=srcY+Math.sin(angle)*len;const bw=b.width*Math.min(W,H*3);
    ctx.save();ctx.globalCompositeOperation="multiply";
    const bg2=ctx.createLinearGradient(srcX,srcY,ex,ey);const bright=0.5+Math.sin(t*b.speed*0.7+b.phase)*0.3;
    bg2.addColorStop(0,`hsla(${b.hue},90%,55%,0)`);bg2.addColorStop(0.15,`hsla(${b.hue},90%,55%,${bright*0.2})`);bg2.addColorStop(0.6,`hsla(${b.hue},85%,58%,${bright*0.12})`);bg2.addColorStop(1,`hsla(${b.hue},80%,60%,0)`);ctx.fillStyle=bg2;
    const perp={x:-Math.sin(angle),y:Math.cos(angle)};ctx.beginPath();ctx.moveTo(srcX+perp.x*bw,srcY+perp.y*bw);ctx.lineTo(ex+perp.x*bw*1.6,ey+perp.y*bw*1.6);ctx.lineTo(ex-perp.x*bw*1.6,ey-perp.y*bw*1.6);ctx.lineTo(srcX-perp.x*bw,srcY-perp.y*bw);ctx.closePath();ctx.fill();ctx.restore();
  });
  s.caustics.forEach((c: any)=>{
    const cx2=(c.x+Math.sin(t*c.spd+c.ph)*0.018)*W,cy2=(c.y+Math.cos(t*c.spd*0.8+c.ph)*0.025)*H;const r=c.r*Math.min(W,H*3);
    ctx.save();ctx.globalCompositeOperation="multiply";const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,r);cg.addColorStop(0,`hsla(${(c.hue+t*22)%360},80%,58%,${0.1+Math.sin(t*c.spd+c.ph)*0.04})`);cg.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  for(let i=0;i<14;i++){const gx=((i*137.5+t*4.5)%W),gy=((i*89.3+Math.sin(t*0.3+i)*H*0.08)%H);const gp=Math.abs(Math.sin(t*2.2+i*1.3));if(gp>0.82){const sz=(gp-0.82)*18;ctx.beginPath();ctx.moveTo(gx-sz,gy);ctx.lineTo(gx+sz,gy);ctx.moveTo(gx,gy-sz);ctx.lineTo(gx,gy+sz);ctx.strokeStyle=`rgba(160,190,255,${(gp-0.82)*3})`;ctx.lineWidth=0.6;ctx.stroke();}}
  const edge=ctx.createLinearGradient(0,0,W,0);edge.addColorStop(0,"rgba(160,165,190,0.18)");edge.addColorStop(0.06,"rgba(0,0,0,0)");edge.addColorStop(0.94,"rgba(0,0,0,0)");edge.addColorStop(1,"rgba(160,165,190,0.18)");ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);
}

export default function PrismaticLightBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#f0f2f8", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
