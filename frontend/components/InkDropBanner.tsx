"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.drops) {
    s.drops = Array.from({length:8},(_: any,i: number)=>({x:0.06+(i/7)*0.88,y:0.12+(i%3)*0.35,phase:i*0.8,speed:0.055+i*0.008,maxR:0.09+(i%4)*0.04,hue:[220,260,180,300,200,340,140,280][i],life:i*0.12}));
    s.tendrils = Array.from({length:16},(_: any,i: number)=>({ox:i/15,oy:0.1+(i%5)*0.18,angle:Math.random()*Math.PI*2,len:0.08+Math.random()*0.15,speed:0.035+Math.random()*0.03,hue:200+Math.random()*130,ph:Math.random()*Math.PI*2,width:0.003+Math.random()*0.006}));
  }
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#f6f4f0");bg.addColorStop(0.5,"#fafaf7");bg.addColorStop(1,"#f3f1ed");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  s.tendrils.forEach((ten: any)=>{
    const tx=ten.ox*W,ty=ten.oy*H;const angle=ten.angle+Math.sin(t*ten.speed+ten.ph)*0.5;const len=ten.len*Math.min(W,H*3);
    ctx.save();ctx.globalCompositeOperation="multiply";
    const tg=ctx.createLinearGradient(tx,ty,tx+Math.cos(angle)*len,ty+Math.sin(angle)*len);
    tg.addColorStop(0,`hsla(${ten.hue},55%,28%,0.22)`);tg.addColorStop(0.5,`hsla(${ten.hue},50%,32%,0.14)`);tg.addColorStop(1,`hsla(${ten.hue},45%,38%,0)`);
    ctx.strokeStyle=tg;ctx.lineWidth=ten.width*W;ctx.beginPath();ctx.moveTo(tx,ty);ctx.bezierCurveTo(tx+Math.cos(angle+0.4)*len*0.5,ty+Math.sin(angle+0.4)*len*0.5,tx+Math.cos(angle-0.25)*len*0.8,ty+Math.sin(angle-0.25)*len*0.8,tx+Math.cos(angle)*len,ty+Math.sin(angle)*len);ctx.stroke();ctx.restore();
  });
  s.drops.forEach((d: any)=>{
    d.life=(d.life+d.speed*0.016)%1;const r=d.maxR*Math.min(W,H*3)*d.life;const alpha=d.life<0.25?d.life/0.25:(1-(d.life-0.25)/0.75);const dx=d.x*W,dy=d.y*H;
    ctx.save();ctx.globalCompositeOperation="multiply";
    const dg=ctx.createRadialGradient(dx,dy,0,dx,dy,r);dg.addColorStop(0,`hsla(${d.hue},65%,22%,${alpha*0.75})`);dg.addColorStop(0.45,`hsla(${d.hue},55%,30%,${alpha*0.38})`);dg.addColorStop(1,`hsla(${d.hue},45%,38%,0)`);ctx.fillStyle=dg;ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fill();
    for(let ti=0;ti<7;ti++){const ta=(ti/7)*Math.PI*2+t*0.08+d.phase;const tl=r*(0.5+Math.sin(t*d.speed*3+ti)*0.2);const tg2=ctx.createLinearGradient(dx,dy,dx+Math.cos(ta)*tl,dy+Math.sin(ta)*tl);tg2.addColorStop(0,`hsla(${d.hue},65%,25%,${alpha*0.45})`);tg2.addColorStop(1,"rgba(0,0,0,0)");ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(dx+Math.cos(ta)*tl,dy+Math.sin(ta)*tl);ctx.strokeStyle=tg2;ctx.lineWidth=2.2-ti*0.25;ctx.stroke();}
    ctx.restore();
  });
  const edgeL=ctx.createLinearGradient(0,0,W*0.04,0);edgeL.addColorStop(0,"rgba(180,170,155,0.2)");edgeL.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=edgeL;ctx.fillRect(0,0,W*0.04,H);
  const edgeR=ctx.createLinearGradient(W*0.96,0,W,0);edgeR.addColorStop(0,"rgba(0,0,0,0)");edgeR.addColorStop(1,"rgba(180,170,155,0.2)");ctx.fillStyle=edgeR;ctx.fillRect(W*0.96,0,W*0.04,H);
}

export default function InkDropBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 24);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#f6f4f0", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
