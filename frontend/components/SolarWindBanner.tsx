"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const N=90;
  if(!s.streams){s.streams=Array.from({length:N},(_: any,i: number)=>({y:Math.random(),x:Math.random(),speed:1.0+Math.random()*2.5,len:0.06+Math.random()*0.16,width:0.003+Math.random()*0.008,hue:25+Math.random()*24,alpha:0.12+Math.random()*0.55,wA:Math.random()*0.028,wFq:0.35+Math.random()*0.6,wPh:Math.random()*Math.PI*2}));}
  ctx.fillStyle="#060200";ctx.fillRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,W,0);bg.addColorStop(0,"#130500");bg.addColorStop(0.5,"#0e0300");bg.addColorStop(1,"#040100");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalCompositeOperation="screen";const sG=ctx.createRadialGradient(-W*0.04,H/2,0,-W*0.04,H/2,W*0.55);sG.addColorStop(0,`rgba(255,200,80,${0.28+Math.sin(t*0.55)*0.05})`);sG.addColorStop(0.3,"rgba(255,120,20,0.12)");sG.addColorStop(0.65,"rgba(180,55,0,0.04)");sG.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=sG;ctx.fillRect(0,0,W,H);ctx.restore();
  s.streams.forEach((sr: any)=>{
    sr.x+=sr.speed/(W*60);if(sr.x>1+sr.len){sr.x=-sr.len;sr.y=Math.random();}
    const x1=(sr.x-sr.len)*W,x2=sr.x*W;const baseY=sr.y*H+Math.sin(t*sr.wFq+sr.wPh)*sr.wA*H;
    if(x2<0||x1>W)return;const cx1=Math.max(0,x1),cx2=Math.min(W,x2);if(cx2<=cx1)return;
    const sw=sr.width*H;ctx.save();ctx.globalCompositeOperation="screen";
    const sg=ctx.createLinearGradient(x1,0,x2,0);sg.addColorStop(0,`hsla(${sr.hue},100%,65%,0)`);sg.addColorStop(0.25,`hsla(${sr.hue},100%,68%,${sr.alpha*0.55})`);sg.addColorStop(0.7,`hsla(${sr.hue+8},100%,72%,${sr.alpha})`);sg.addColorStop(1,`hsla(${sr.hue+15},95%,65%,${sr.alpha*0.28})`);ctx.fillStyle=sg;
    ctx.beginPath();ctx.moveTo(cx1,baseY-sw/2);ctx.lineTo(cx2,baseY-sw*0.28);ctx.lineTo(cx2,baseY+sw*0.28);ctx.lineTo(cx1,baseY+sw/2);ctx.closePath();ctx.fill();ctx.restore();
  });
  for(let i=0;i<22;i++){const px=((i*137.5+t*85)%(W*1.2))-W*0.1,py=((i*73+Math.sin(t*0.4+i)*H*0.08)%H);const pa=0.07+Math.abs(Math.sin(t*2+i))*0.22;ctx.save();ctx.globalCompositeOperation="screen";const pg=ctx.createRadialGradient(px,py,0,px,py,H*0.045);pg.addColorStop(0,`rgba(255,200,80,${pa})`);pg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=pg;ctx.fillRect(px-H*0.05,py-H*0.05,H*0.1,H*0.1);ctx.restore();}
  const vT=ctx.createLinearGradient(0,0,0,H*0.1);vT.addColorStop(0,"rgba(4,2,0,0.72)");vT.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=vT;ctx.fillRect(0,0,W,H*0.1);
  const vB=ctx.createLinearGradient(0,H*0.9,0,H);vB.addColorStop(0,"rgba(0,0,0,0)");vB.addColorStop(1,"rgba(4,2,0,0.72)");ctx.fillStyle=vB;ctx.fillRect(0,H*0.9,W,H*0.1);
  const vR=ctx.createLinearGradient(W*0.88,0,W,0);vR.addColorStop(0,"rgba(0,0,0,0)");vR.addColorStop(1,"rgba(5,3,0,0.82)");ctx.fillStyle=vR;ctx.fillRect(W*0.88,0,W*0.12,H);
}

export default function SolarWindBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#060200", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
