"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, _s: any) {
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#c47820");sky.addColorStop(0.4,"#dbbe72");sky.addColorStop(0.65,"#e8cc88");sky.addColorStop(1,"#c49848");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  const sunX=W*0.78,sunY=H*0.14;
  ctx.save();ctx.globalCompositeOperation="screen";const sG=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,W*0.42);sG.addColorStop(0,"rgba(255,255,200,0.5)");sG.addColorStop(0.3,"rgba(255,230,150,0.15)");sG.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=sG;ctx.fillRect(0,0,W,H);ctx.restore();
  const sC=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,H*0.1);sC.addColorStop(0,"rgba(255,255,225,0.95)");sC.addColorStop(0.5,"rgba(255,240,170,0.4)");sC.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=sC;ctx.fillRect(sunX-H*0.1,sunY-H*0.1,H*0.2,H*0.2);
  const layers=[{b:0.48,a1:0.12,a2:0.05,f1:0.008,f2:0.02,s:0.006,c:["#c8882a","#7a4e10"]},{b:0.6,a1:0.1,a2:0.045,f1:0.01,f2:0.024,s:0.009,c:["#d8982e","#8a5a14"]},{b:0.72,a1:0.08,a2:0.038,f1:0.012,f2:0.028,s:0.012,c:["#e4a832","#9a6818"]},{b:0.84,a1:0.065,a2:0.03,f1:0.015,f2:0.032,s:0.015,c:["#f0b838","#a8741e"]}];
  layers.forEach((l: any)=>{
    ctx.beginPath();ctx.moveTo(0,H);
    for(let x=0;x<=W;x+=4){const y=l.b*H+Math.sin(x*l.f1+t*l.s)*l.a1*H+Math.sin(x*l.f2+t*l.s*1.4+1.1)*l.a2*H;ctx.lineTo(x,y);}
    ctx.lineTo(W,H);ctx.closePath();
    const dg=ctx.createLinearGradient(0,(l.b-l.a1)*H,0,H);dg.addColorStop(0,l.c[0]);dg.addColorStop(0.5,l.c[1]);dg.addColorStop(1,"#5a3208");ctx.fillStyle=dg;ctx.fill();
    ctx.beginPath();for(let x=0;x<=W;x+=4){const y=l.b*H+Math.sin(x*l.f1+t*l.s)*l.a1*H+Math.sin(x*l.f2+t*l.s*1.4+1.1)*l.a2*H;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.strokeStyle="rgba(255,220,130,0.28)";ctx.lineWidth=1;ctx.stroke();
  });
  for(let i=0;i<5;i++){const sy=H*(0.44+i*0.04)+Math.sin(t*1.5+i)*H*0.01;ctx.beginPath();for(let x=0;x<=W;x+=5)ctx.lineTo(x,sy+Math.sin(x*0.04+t*2.8+i)*2);ctx.strokeStyle=`rgba(255,210,110,${0.04+Math.sin(t*2+i)*0.012})`;ctx.lineWidth=1;ctx.stroke();}
  const top=ctx.createLinearGradient(0,0,0,H*0.14);top.addColorStop(0,"rgba(160,108,18,0.38)");top.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=top;ctx.fillRect(0,0,W,H*0.14);
}

export default function SandDunesBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 24);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#c47820", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
