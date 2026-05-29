"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  if (!s.embers) {
    s.embers = Array.from({ length: 55 }, () => ({ x: Math.random()*W, y: H+Math.random()*15, vy: -(0.4+Math.random()*1.1), vx: (Math.random()-0.5)*0.45, r: Math.random()*2.2+0.4, life: Math.random(), col: Math.random()>0.55?[255,200,50]:[255,100,15] }));
    const rng = (seed: number) => { let x = Math.sin(seed)*10000; return x-Math.floor(x); };
    s.cracks = Array.from({ length: 22 }, (_: any, i: number) => {
      const pts: {x:number;y:number}[] = []; let cx2 = rng(i*11)*W, cy2 = rng(i*13)*H;
      pts.push({x:cx2,y:cy2});
      for (let j = 0; j < 9; j++) { cx2+=(rng(i*17+j)-0.5)*W*0.12; cy2+=(rng(i*19+j)-0.5)*H*0.18; pts.push({x:Math.max(0,Math.min(W,cx2)),y:Math.max(0,Math.min(H,cy2))}); }
      return { pts, ph: rng(i*31)*Math.PI*2, spd: 0.35+rng(i*37)*0.55 };
    });
  }
  ctx.fillStyle = "#060100"; ctx.fillRect(0, 0, W, H);
  const baseG = ctx.createLinearGradient(0, 0, 0, H);
  baseG.addColorStop(0,"#0a0100"); baseG.addColorStop(0.3,"#200400"); baseG.addColorStop(0.7,"#3a0800"); baseG.addColorStop(1,"#580c00");
  ctx.fillStyle = baseG; ctx.fillRect(0, 0, W, H);
  const layers = [
    {base:0.15,amp:0.1,freq:0.009,spd:0.6,col:["#2a0600","#1a0300"],crest:0.06},
    {base:0.3,amp:0.09,freq:0.011,spd:0.8,col:["#420a00","#280500"],crest:0.08},
    {base:0.48,amp:0.08,freq:0.013,spd:1.0,col:["#6e1200","#3e0800"],crest:0.1},
    {base:0.65,amp:0.07,freq:0.016,spd:1.3,col:["#a82000","#5c1000"],crest:0.14},
    {base:0.8,amp:0.06,freq:0.019,spd:1.6,col:["#e03000","#882000"],crest:0.18},
  ];
  layers.forEach(l => {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) { const y = l.base*H+Math.sin(x*l.freq+t*l.spd)*l.amp*H+Math.sin(x*l.freq*1.8+t*l.spd*1.4+1.1)*l.amp*H*0.4; ctx.lineTo(x, y); }
    ctx.lineTo(W, H); ctx.closePath();
    const lg = ctx.createLinearGradient(0,(l.base-l.amp)*H,0,H);
    lg.addColorStop(0,l.col[0]); lg.addColorStop(0.5,l.col[1]); lg.addColorStop(1,"#1a0200");
    ctx.fillStyle = lg; ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) { const y = l.base*H+Math.sin(x*l.freq+t*l.spd)*l.amp*H+Math.sin(x*l.freq*1.8+t*l.spd*1.4+1.1)*l.amp*H*0.4; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.strokeStyle = `rgba(255,${Math.floor(180+l.crest*400)},${Math.floor(l.crest*300)},${l.crest*1.8})`; ctx.lineWidth=1.2; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let x = 0; x < W; x += W/8) {
      const wy = l.base*H+Math.sin(x*l.freq+t*l.spd)*l.amp*H;
      const gv = Math.sin(x*0.06+t*4)*0.5+0.5;
      if (gv > 0.65) { const hg = ctx.createRadialGradient(x,wy,0,x,wy,W*0.05); hg.addColorStop(0,`rgba(255,${Math.floor(160+gv*80)},0,${(gv-0.65)*0.3})`); hg.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=hg; ctx.fillRect(x-W*0.05,wy-W*0.05,W*0.1,W*0.1); }
    }
    ctx.restore();
  });
  s.cracks.forEach((cr: any) => {
    const glow = 0.45+Math.sin(t*cr.spd+cr.ph)*0.45;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    ctx.beginPath(); cr.pts.forEach((p: any, pi: number) => pi===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.strokeStyle=`rgba(255,${Math.floor(80+glow*130)},0,${0.1*glow})`; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle=`rgba(255,${Math.floor(190+glow*55)},${Math.floor(glow*55)},${0.4*glow})`; ctx.lineWidth=0.9; ctx.stroke(); ctx.restore();
  });
  s.embers.forEach((e: any) => {
    e.x+=e.vx+Math.sin(t*2+e.x*0.01)*0.35; e.y+=e.vy; e.life+=0.008;
    if (e.y<-e.r||e.life>1){e.y=H+e.r;e.x=Math.random()*W;e.life=0;e.vy=-(0.4+Math.random()*1.1);}
    const a = Math.sin(e.life*Math.PI)*0.85;
    ctx.save(); ctx.globalCompositeOperation="screen"; ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(1.1-e.life*0.5),0,Math.PI*2);
    ctx.fillStyle=`rgba(${e.col[0]},${e.col[1]},${e.col[2]},${a})`; ctx.fill(); ctx.restore();
  });
  const topFade=ctx.createLinearGradient(0,0,0,H*0.12); topFade.addColorStop(0,"rgba(5,1,0,0.8)"); topFade.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=topFade; ctx.fillRect(0,0,W,H*0.12);
}

export default function LavaFlowBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#060100", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
