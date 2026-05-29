"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const AREA = W*H, N = Math.min(80,Math.max(25,Math.floor(AREA/3200)));
  const CONNECT = Math.min(W*0.22,H*1.2);
  if (!s.nodes||s.N!==N) {
    s.N=N; s.nodes=Array.from({length:N},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-0.5)*0.28,vy:(Math.random()-0.5)*0.22,r:1.2+Math.random()*2.4,ph:Math.random()*Math.PI*2,hue:190+Math.random()*70}));
  }
  ctx.fillStyle="#060810"; ctx.fillRect(0,0,W,H);
  for(let i=0;i<50;i++){const sx=((i*173.5)%W),sy=((i*97.3+Math.sin(i*0.7)*H*0.1)%H);ctx.beginPath();ctx.arc(sx,sy,0.5,0,Math.PI*2);ctx.fillStyle=`rgba(160,175,220,${0.06+(i%5)*0.04})`;ctx.fill();}
  s.nodes.forEach((n: any)=>{n.x+=n.vx+Math.sin(t*0.18+n.ph)*0.07;n.y+=n.vy+Math.cos(t*0.14+n.ph)*0.05;if(n.x<-n.r*3)n.x=W+n.r*3;if(n.x>W+n.r*3)n.x=-n.r*3;if(n.y<-n.r*3)n.y=H+n.r*3;if(n.y>H+n.r*3)n.y=-n.r*3;});
  ctx.save(); ctx.globalCompositeOperation="screen";
  for(let i=0;i<s.nodes.length;i++){for(let j=i+1;j<s.nodes.length;j++){const a=s.nodes[i],b=s.nodes[j];const dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy);if(dist<CONNECT){const fade=(1-dist/CONNECT);const cg=ctx.createLinearGradient(a.x,a.y,b.x,b.y);cg.addColorStop(0,`hsla(${a.hue},85%,65%,${fade*0.22})`);cg.addColorStop(1,`hsla(${b.hue},85%,65%,${fade*0.22})`);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=cg;ctx.lineWidth=fade*1.4;ctx.stroke();}}}
  s.nodes.forEach((n: any)=>{const pulse=Math.sin(t*2.8+n.ph)*0.5+0.5;const ng=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*5.5);ng.addColorStop(0,`hsla(${n.hue},100%,85%,${0.55+pulse*0.35})`);ng.addColorStop(0.35,`hsla(${n.hue},90%,65%,${0.22+pulse*0.12})`);ng.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=ng;ctx.beginPath();ctx.arc(n.x,n.y,n.r*5.5,0,Math.PI*2);ctx.fill();});
  ctx.restore();
  const vig=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.8);
  vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(4,5,12,0.6)");ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
}

export default function ParticleWebBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#060810", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
