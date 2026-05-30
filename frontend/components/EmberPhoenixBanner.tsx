"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const N=280;
  if (!s.p) {
    const nBirds=Math.max(2,Math.ceil(W/300));
    s.birds=Array.from({length:nBirds},(_: any,i: number)=>({cx:(i+0.5)/nBirds,cy:0.48}));
    s.p=Array.from({length:N},(_: any,i: number)=>{const bi=i%s.birds.length;return{bi,x:s.birds[bi].cx,y:s.birds[bi].cy,vx:0,vy:0,life:Math.random(),maxLife:0.5+Math.random()*0.8,hue:18+Math.random()*35,size:0.5+Math.random()*2,wing:i%3};});
  }
  ctx.fillStyle="rgba(4,1,0,0.82)";ctx.fillRect(0,0,W,H);
  const baseG=ctx.createLinearGradient(0,0,0,H);baseG.addColorStop(0,"#0a0100");baseG.addColorStop(0.5,"#1c0400");baseG.addColorStop(1,"#300800");ctx.fillStyle=baseG;ctx.fillRect(0,0,W,H);
  s.p.forEach((p: any)=>{
    const dt=(s._dt as number)??1; p.life+=0.016*dt;
    if(p.life>p.maxLife){
      const bird=s.birds[p.bi];p.life=0;
      if(p.wing===0){const a=-Math.PI/2+(Math.random()-0.5)*0.8,d=Math.random()*0.2;p.x=bird.cx+Math.cos(a)*d*0.3;p.y=bird.cy+Math.sin(a)*d;p.vx=(Math.random()-0.5)*0.001;p.vy=-(0.001+Math.random()*0.002);}
      else if(p.wing===1){const wa=Math.PI*(0.75+Math.random()*0.65),wd=0.1+Math.random()*0.4;p.x=bird.cx+Math.cos(wa)*wd*(W/Math.max(W,H*3))+Math.sin(t*0.5)*0.025;p.y=bird.cy+Math.sin(wa)*wd*0.4-0.04;p.vx=-(0.0005+Math.random()*0.0015);p.vy=-(0.001+Math.random()*0.002);}
      else{const wa=Math.PI*(0.25-Math.random()*0.65),wd=0.1+Math.random()*0.4;p.x=bird.cx+Math.cos(wa)*wd*(W/Math.max(W,H*3))-Math.sin(t*0.5)*0.025;p.y=bird.cy+Math.sin(wa)*wd*0.4-0.04;p.vx=(0.0005+Math.random()*0.0015);p.vy=-(0.001+Math.random()*0.002);}
    }
    p.x+=p.vx*dt;p.y+=(p.vy-0.0002)*dt;
    const prog=p.life/p.maxLife,alpha=prog<0.2?prog/0.2:(1-prog),temp=1-prog;
    ctx.save();ctx.globalCompositeOperation="screen";
    const pg=ctx.createRadialGradient(p.x*W,p.y*H,0,p.x*W,p.y*H,p.size*(1+temp*2));
    pg.addColorStop(0,`hsla(${p.hue+(1-temp)*20},100%,${70+temp*20}%,${alpha*0.85})`);pg.addColorStop(0.5,`hsla(${p.hue},100%,55%,${alpha*0.35})`);pg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=pg;ctx.beginPath();ctx.arc(p.x*W,p.y*H,p.size*(1+temp*2),0,Math.PI*2);ctx.fill();ctx.restore();
  });
  s.birds.forEach((bird: any)=>{
    ctx.save();ctx.globalCompositeOperation="screen";
    const cg=ctx.createRadialGradient(bird.cx*W,bird.cy*H*0.95,0,bird.cx*W,bird.cy*H*0.95,Math.min(W,H)*0.08);
    cg.addColorStop(0,`rgba(255,200,80,${0.25+Math.sin(t*2)*0.08})`);cg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=cg;ctx.fillRect(0,0,W,H);ctx.restore();
  });
}

export default function EmberPhoenixBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#040100", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
