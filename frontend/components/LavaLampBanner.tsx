"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if(!s.blobs){const nBlobs=Math.max(6,Math.ceil(W/110));s.blobs=Array.from({length:nBlobs},(_: any,i: number)=>({x:0.06+(i/(nBlobs-1))*0.88,y:0.12+Math.random()*0.76,bsX:0.12+Math.random()*0.16,bsY:0.1+Math.random()*0.14,phX:Math.random()*Math.PI*2,phY:Math.random()*Math.PI*2,size:0.08+Math.random()*0.1,hue:16+i*9,px:i*1.1,py:i*1.6+0.4}));}
  ctx.fillStyle="#0e0500";ctx.fillRect(0,0,W,H);
  const baseG=ctx.createLinearGradient(0,0,0,H);baseG.addColorStop(0,"#0a0300");baseG.addColorStop(0.5,"#1c0800");baseG.addColorStop(1,"#0a0300");ctx.fillStyle=baseG;ctx.fillRect(0,0,W,H);
  s.blobs.forEach((b: any)=>{
    const bx=(b.x+Math.sin(t*b.bsX+b.phX)*0.18)*W;const by=(b.y+Math.sin(t*b.bsY+b.phY)*0.28)*H;
    const shortDim=Math.min(W,H*2.2);const r=b.size*shortDim*(0.88+Math.sin(t*1.9+b.px)*0.14);
    ctx.save();ctx.globalCompositeOperation="screen";
    const bg2=ctx.createRadialGradient(bx,by,0,bx,by,r);bg2.addColorStop(0,`hsla(${b.hue},100%,72%,0.72)`);bg2.addColorStop(0.35,`hsla(${b.hue-5},100%,55%,0.45)`);bg2.addColorStop(0.7,`hsla(${b.hue-10},90%,35%,0.18)`);bg2.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=bg2;ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill();
    const hx=bx-r*0.28,hy=by-r*0.28;const hg=ctx.createRadialGradient(hx,hy,0,hx,hy,r*0.22);hg.addColorStop(0,`rgba(255,225,180,${0.38*(0.85+Math.sin(t*1.9+b.px)*0.14)})`);hg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=hg;ctx.beginPath();ctx.arc(hx,hy,r*0.22,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  const top=ctx.createLinearGradient(0,0,0,H*0.1);top.addColorStop(0,"rgba(8,3,0,0.92)");top.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=top;ctx.fillRect(0,0,W,H*0.1);
  const bot=ctx.createLinearGradient(0,H*0.9,0,H);bot.addColorStop(0,"rgba(0,0,0,0)");bot.addColorStop(1,"rgba(8,3,0,0.92)");ctx.fillStyle=bot;ctx.fillRect(0,H*0.9,W,H*0.1);
}

export default function LavaLampBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#0e0500", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
