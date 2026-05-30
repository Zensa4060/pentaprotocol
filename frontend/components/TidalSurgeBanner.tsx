"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if(!s.spray){s.spray=Array.from({length:65},()=>({x:0,y:0,vx:0,vy:0,r:0,life:0}));s.st=0;}
  ctx.fillStyle="#010c1a";ctx.fillRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,W,0);bg.addColorStop(0,"#001428");bg.addColorStop(0.5,"#001e3c");bg.addColorStop(1,"#010c1a");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const waves=[
    {base:0.22,amp:0.16,freq:0.009,spd:0.7,col:["#002850","#001230"],crest:0.06},
    {base:0.38,amp:0.13,freq:0.012,spd:1.0,col:["#003870","#001c40"],crest:0.08},
    {base:0.54,amp:0.1,freq:0.015,spd:1.3,col:["#004888","#002450"],crest:0.1},
    {base:0.68,amp:0.08,freq:0.018,spd:1.6,col:["#1060a0","#002860"],crest:0.14},
    {base:0.8,amp:0.06,freq:0.022,spd:2.0,col:["#2070b8","#003070"],crest:0.18},
  ];
  waves.forEach((w: any)=>{
    ctx.beginPath();ctx.moveTo(0,H);
    for(let x=0;x<=W;x+=3){const y=w.base*H+Math.sin(x*w.freq-t*w.spd)*w.amp*H+Math.sin(x*w.freq*1.6-t*w.spd*1.3+1.4)*w.amp*H*0.4;ctx.lineTo(x,y);}
    ctx.lineTo(W,H);ctx.closePath();
    const wg=ctx.createLinearGradient(0,(w.base-w.amp)*H,0,H);wg.addColorStop(0,w.col[0]);wg.addColorStop(0.4,w.col[1]);wg.addColorStop(1,"#010810");ctx.fillStyle=wg;ctx.fill();
    ctx.beginPath();for(let x=0;x<=W;x+=3){const y=w.base*H+Math.sin(x*w.freq-t*w.spd)*w.amp*H+Math.sin(x*w.freq*1.6-t*w.spd*1.3+1.4)*w.amp*H*0.4;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.strokeStyle=`rgba(160,210,255,${w.crest})`;ctx.lineWidth=1.2;ctx.stroke();
    ctx.save();ctx.globalCompositeOperation="screen";for(let x=0;x<W;x+=W/10){const wy=w.base*H+Math.sin(x*w.freq-t*w.spd)*w.amp*H;const wi=waves.indexOf(w);const gg=ctx.createRadialGradient(x,wy,0,x,wy,W*0.06);gg.addColorStop(0,`rgba(0,${70+wi*18},${150+wi*18},0.05)`);gg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=gg;ctx.fillRect(x-W*0.06,wy-W*0.06,W*0.12,W*0.12);}ctx.restore();
  });
  s.st++;if(s.st>1){s.st=0;const sp=s.spray[Math.floor(Math.random()*s.spray.length)];if(sp.life<=0){const srcX=Math.random()*W;const wTop=waves[4];const srcY=wTop.base*H+Math.sin(srcX*wTop.freq-t*wTop.spd)*wTop.amp*H;sp.x=srcX;sp.y=srcY;sp.vx=(Math.random()-0.5)*2.8;sp.vy=-(1+Math.random()*3);sp.r=0.8+Math.random()*2.2;sp.life=0.4+Math.random()*0.6;}}
  const dt=(s._dt as number)??1; s.spray.forEach((sp: any)=>{if(sp.life<=0)return;sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vy+=0.07*dt;sp.life-=dt/30;const a=sp.life*0.8;ctx.beginPath();ctx.arc(sp.x,sp.y,sp.r,0,Math.PI*2);ctx.fillStyle=`rgba(180,225,255,${a})`;ctx.fill();});
  ctx.save();ctx.globalCompositeOperation="screen";const shaft=ctx.createLinearGradient(W*0.72,0,W*0.72+W*0.04,H*0.55);shaft.addColorStop(0,"rgba(0,120,200,0.055)");shaft.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=shaft;ctx.beginPath();ctx.moveTo(W*0.68,0);ctx.lineTo(W*0.79,0);ctx.lineTo(W*0.86,H*0.55);ctx.lineTo(W*0.59,H*0.55);ctx.closePath();ctx.fill();ctx.restore();
  const top=ctx.createLinearGradient(0,0,0,H*0.1);top.addColorStop(0,"rgba(0,6,14,0.78)");top.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=top;ctx.fillRect(0,0,W,H*0.1);
}

export default function TidalSurgeBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#010c1a", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
