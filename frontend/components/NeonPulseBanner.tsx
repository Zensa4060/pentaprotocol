"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.sources) {
    const nSrc=Math.max(3,Math.ceil(W/220));
    s.sources=Array.from({length:nSrc},(_: any,i: number)=>({x:W*((i+0.5)/nSrc),y:H*(0.2+(i%3)*0.3),hue:(i*55)%360,ph:i*0.8,pulseSpd:0.5+i*0.12}));
    s.rings=Array.from({length:7},(_: any,i: number)=>({phase:i*(1/7),hueOff:i*22}));
  }
  ctx.fillStyle="#04020c";ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalCompositeOperation="screen";
  s.sources.forEach((src: any)=>{
    s.rings.forEach((ring: any)=>{
      const phase=(t*0.65*src.pulseSpd-ring.phase+10)%1;
      const maxR=Math.hypot(Math.max(src.x,W-src.x),Math.max(src.y,H-src.y))*1.05;
      const r=phase*maxR;const alpha=Math.sin(phase*Math.PI)*0.45;if(alpha<0.01)return;
      const lw=1.2+(1-phase)*2.2;const h=(src.hue+ring.hueOff+t*12)%360;
      ctx.beginPath();ctx.arc(src.x,src.y,r,0,Math.PI*2);
      ctx.strokeStyle=`hsla(${h},100%,65%,${alpha*0.2})`;ctx.lineWidth=lw*6;ctx.stroke();
      ctx.strokeStyle=`hsla(${h},100%,72%,${alpha*0.85})`;ctx.lineWidth=lw;ctx.stroke();
    });
    for(let g=0;g<3;g++){const gr=H*(0.06+g*0.05)*(0.8+Math.sin(t*3+src.ph)*0.18);const cg=ctx.createRadialGradient(src.x,src.y,0,src.x,src.y,gr);cg.addColorStop(0,`hsla(${src.hue+t*20},100%,90%,${(0.4-g*0.1)*(0.7+Math.sin(t*3+src.ph)*0.25)})`);cg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=cg;ctx.beginPath();ctx.arc(src.x,src.y,gr,0,Math.PI*2);ctx.fill();}
  });
  ctx.restore();
  for(let y=0;y<H;y+=3){ctx.fillStyle="rgba(0,0,0,0.06)";ctx.fillRect(0,y,W,1);}
}

export default function NeonPulseBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#04020c", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
