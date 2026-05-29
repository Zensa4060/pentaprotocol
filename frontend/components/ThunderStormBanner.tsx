"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function boltDraw(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, depth: number, rough: number) {
  if (depth===0){ctx.lineTo(x2,y2);return;}
  const mx=(x1+x2)/2+(Math.random()-0.5)*rough,my=(y1+y2)/2+(Math.random()-0.5)*rough*0.28;
  boltDraw(ctx,x1,y1,mx,my,depth-1,rough*0.5);boltDraw(ctx,mx,my,x2,y2,depth-1,rough*0.5);
  if(depth>2&&Math.random()>0.58){const bx=mx+(Math.random()-0.5)*rough,by=my+Math.random()*rough*0.65;ctx.moveTo(mx,my);boltDraw(ctx,mx,my,bx,by,depth-2,rough*0.38);ctx.moveTo(mx,my);}
}

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.bolts) {
    const nb=Math.max(3,Math.ceil(W/180));
    s.bolts=Array.from({length:nb},(_: any,i: number)=>({x:W*((i+0.5)/nb),timer:Math.random()*90,delay:30+i*22+Math.random()*55,active:false,dur:0,rough:W*0.03+Math.random()*W*0.025}));
    s.clouds=Array.from({length:Math.ceil(W/75)+2},(_: any,i: number)=>({x:(i/(Math.ceil(W/75)+1))*W*1.15-W*0.08,y:H*(0.04+(i%3)*0.07),w:W*(0.08+(i%4)*0.022),h:H*(0.11+(i%3)*0.055),spd:(0.07+i*0.012)*(i%2?1:-1)}));
    s.flash=0;
    s.rain=Array.from({length:Math.max(40,Math.ceil(W/10))},()=>({x:Math.random()*W,y:Math.random()*H,len:5+Math.random()*9,spd:3.5+Math.random()*4,a:0.04+Math.random()*0.09}));
  }
  s.flash=Math.max(0,s.flash-0.07);const fb=s.flash;
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,`rgb(${4+fb*28},${5+fb*35},${14+fb*50})`);sky.addColorStop(0.5,`rgb(${7+fb*20},${8+fb*25},${20+fb*40})`);sky.addColorStop(1,`rgb(${10+fb*14},${11+fb*16},${26+fb*28})`);
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  s.rain.forEach((r: any)=>{r.y+=r.spd;r.x-=r.spd*0.14;if(r.y>H+12){r.y=-12;r.x=Math.random()*W;}ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-r.len*0.12,r.y+r.len);ctx.strokeStyle=`rgba(140,180,255,${r.a})`;ctx.lineWidth=0.4;ctx.stroke();});
  s.clouds.forEach((c: any)=>{
    c.x+=c.spd*(1/60);if(c.x>W+c.w)c.x=-c.w;if(c.x<-c.w)c.x=W+c.w;
    ctx.beginPath();ctx.ellipse(c.x,c.y,c.w*0.5,c.h*0.48,0,0,Math.PI*2);ctx.fillStyle="rgba(12,15,30,0.88)";ctx.fill();
    for(let b=-2;b<=2;b++){ctx.beginPath();ctx.ellipse(c.x+b*c.w*0.23,c.y-c.h*0.1,c.w*0.2,c.h*0.34,0,0,Math.PI*2);ctx.fillStyle="rgba(9,11,24,0.9)";ctx.fill();}
    ctx.beginPath();ctx.ellipse(c.x-c.w*0.08,c.y-c.h*0.28,c.w*0.36,c.h*0.15,0,0,Math.PI*2);ctx.fillStyle=`rgba(${42+fb*28},${48+fb*38},${85+fb*55},0.14)`;ctx.fill();
  });
  s.bolts.forEach((b: any)=>{
    b.timer++;
    if(!b.active&&b.timer>b.delay){b.active=true;b.dur=4+Math.floor(Math.random()*9);b.timer=0;b.delay=45+Math.random()*105;s.flash=0.95;}
    if(b.active){
      ctx.save();ctx.globalCompositeOperation="screen";
      [{lw:10,a:0.1},{lw:4,a:0.28},{lw:1.2,a:0.9}].forEach((p: any)=>{ctx.beginPath();ctx.moveTo(b.x,0);boltDraw(ctx,b.x,0,b.x+(Math.random()-0.5)*W*0.05,H,6,b.rough);ctx.strokeStyle=p.lw>4?`rgba(100,160,255,${p.a})`:p.lw>2?`rgba(180,210,255,${p.a})`:`rgba(230,245,255,${p.a})`;ctx.lineWidth=p.lw;ctx.stroke();});
      ctx.restore();b.dur--;if(b.dur<=0)b.active=false;
    }
  });
  if(fb>0){ctx.fillStyle=`rgba(180,210,255,${fb*0.13})`;ctx.fillRect(0,0,W,H);}
}

export default function ThunderStormBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#060810", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
