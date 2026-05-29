"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.jelly) {
    s.jelly=Array.from({length:8},(_: any,i: number)=>({x:(i%4)*0.28+0.08,y:Math.floor(i/4)*0.5+0.1,vx:(Math.random()-0.5)*0.0004,vy:-(0.00015+Math.random()*0.0003),size:0.025+Math.random()*0.03,hue:155+Math.random()*90,ph:Math.random()*Math.PI*2,spd:0.4+Math.random()*0.7,tN:5+i%3}));
    s.particles=Array.from({length:100},()=>({x:Math.random(),y:Math.random(),r:0.002+Math.random()*0.004,hue:160+Math.random()*80,ph:Math.random()*Math.PI*2,vy:-(0.00004+Math.random()*0.00018),spd:0.3+Math.random()*1.2}));
    s.rays=Array.from({length:4},(_: any,i: number)=>({x:0.15+i*0.25,ph:i*0.9,spd:0.12+i*0.04}));
  }
  ctx.fillStyle="#00020a";ctx.fillRect(0,0,W,H);
  const depth=ctx.createLinearGradient(0,0,0,H);depth.addColorStop(0,"rgba(0,15,35,0.35)");depth.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=depth;ctx.fillRect(0,0,W,H);
  s.rays.forEach((r: any)=>{
    const rx=(r.x+Math.sin(t*r.spd+r.ph)*0.02)*W;ctx.save();ctx.globalCompositeOperation="screen";
    const rg=ctx.createLinearGradient(rx,0,rx+W*0.03,H);rg.addColorStop(0,`rgba(0,80,140,${0.06+Math.sin(t*r.spd*0.5+r.ph)*0.025})`);rg.addColorStop(0.6,"rgba(0,60,120,0.025)");rg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=rg;
    ctx.beginPath();ctx.moveTo(rx-W*0.015,0);ctx.lineTo(rx+W*0.025,0);ctx.lineTo(rx+W*0.06,H);ctx.lineTo(rx-W*0.045,H);ctx.closePath();ctx.fill();ctx.restore();
  });
  s.particles.forEach((p: any)=>{
    p.y+=p.vy;p.x+=Math.sin(t*0.3+p.ph)*0.00008;if(p.y<-0.04){p.y=1.02;p.x=Math.random();}
    const tw=Math.sin(t*p.spd+p.ph)*0.5+0.5;ctx.save();ctx.globalCompositeOperation="screen";
    const pg=ctx.createRadialGradient(p.x*W,p.y*H,0,p.x*W,p.y*H,p.r*Math.min(W,H*3)*2.5);pg.addColorStop(0,`hsla(${p.hue},100%,78%,${tw*0.48})`);pg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=pg;ctx.beginPath();ctx.arc(p.x*W,p.y*H,p.r*Math.min(W,H*3)*2.5,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  s.jelly.forEach((j: any)=>{
    j.x+=j.vx+Math.sin(t*j.spd*0.18+j.ph)*0.0002;j.y+=j.vy+Math.cos(t*j.spd*0.14+j.ph)*0.00008;
    if(j.y<-0.12){j.y=1.05;j.x=Math.random();}if(j.x<-0.06||j.x>1.06)j.vx*=-1;j.x=Math.max(-0.05,Math.min(1.05,j.x));
    const jx=j.x*W,jy=j.y*H,sz=j.size*Math.min(W,H*3),pulse=Math.sin(t*j.spd*1.3+j.ph)*0.5+0.5;
    ctx.save();ctx.globalCompositeOperation="screen";
    for(let g=0;g<4;g++){const gr=sz*(1.6+g*1.4)*(0.8+pulse*0.25);const gg=ctx.createRadialGradient(jx,jy,0,jx,jy,gr);gg.addColorStop(0,`hsla(${j.hue},100%,75%,${(0.32-g*0.07)*pulse})`);gg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=gg;ctx.beginPath();ctx.arc(jx,jy,gr,0,Math.PI*2);ctx.fill();}
    ctx.beginPath();ctx.arc(jx,jy,sz*0.7,Math.PI,Math.PI*2);ctx.fillStyle=`hsla(${j.hue},100%,80%,${0.22+pulse*0.18})`;ctx.fill();
    for(let ti=0;ti<j.tN;ti++){const ta=Math.PI+(ti/(j.tN-1))*Math.PI;const tl=sz*(1.4+Math.sin(t*j.spd+ti*0.9)*0.4);const tx2=jx+Math.cos(ta)*sz*0.5,ty2=jy+Math.sin(ta)*sz*0.5;ctx.beginPath();ctx.moveTo(tx2,ty2);ctx.quadraticCurveTo(tx2+Math.sin(t*j.spd+ti)*sz*0.5,ty2+tl*0.5,tx2+Math.sin(t*j.spd*0.7+ti*1.3)*sz*0.3,ty2+tl);ctx.strokeStyle=`hsla(${j.hue},90%,70%,${0.18+pulse*0.12})`;ctx.lineWidth=0.9;ctx.stroke();}
    ctx.restore();
  });
}

export default function DeepSeaBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#00020a", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
