"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

const HX="0123456789ABCDEF";
const rh=()=>HX[Math.floor(Math.random()*16)];
const hb=()=>rh()+rh();

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const LH=Math.max(10,Math.min(16,H/5));const NL=Math.ceil(H/LH)+1;const CH=Math.ceil(W/(LH*0.62));
  if(!s.lines||s.W!==W||s.H!==H){s.W=W;s.H=H;s.lines=Array.from({length:NL+6},()=>Array.from({length:CH},()=>hb()).join(" "));s.scrollY=0;s.rt=0;s.cx=Math.floor(Math.random()*CH);s.cl=Math.floor(Math.random()*NL);}
  ctx.fillStyle="#010804";ctx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=2){ctx.fillStyle="rgba(0,0,0,0.07)";ctx.fillRect(0,y,W,1);}
  s.scrollY=(s.scrollY+0.3)%LH;s.rt++;
  if(s.rt>3){s.rt=0;const li=Math.floor(Math.random()*s.lines.length);const ci=Math.floor(Math.random()*CH);const chars=s.lines[li].split("");chars[ci*3]=rh();if(chars[ci*3+1])chars[ci*3+1]=rh();s.lines[li]=chars.join("");if(Math.random()>0.94){s.cx=Math.floor(Math.random()*(CH-1));s.cl=Math.floor(Math.random()*NL);}}
  ctx.font=`${LH-2}px 'Courier New',monospace`;ctx.textAlign="left";
  for(let row=0;row<NL+1;row++){
    const y=row*LH-s.scrollY;const li=row%s.lines.length;const line=s.lines[li];const isHL=li%11===0;const isCR=row===s.cl;
    if(isHL){ctx.fillStyle="rgba(0,255,80,0.035)";ctx.fillRect(0,y-LH+2,W,LH);}
    const chars=line.split("");
    for(let ci=0;ci<chars.length;ci++){
      const cx2=ci*(LH-2)*0.62;if(cx2>W)break;const isCursor=isCR&&ci===s.cx*3&&Math.sin(t*4)>0;
      const de=Math.min(ci/chars.length,1-ci/chars.length)*2;const alpha=0.15+de*0.55;
      if(isCursor){ctx.fillStyle="rgba(0,255,80,0.8)";ctx.fillRect(cx2,y-LH+2,(LH-2)*0.56,LH);ctx.fillStyle="#000";}
      else ctx.fillStyle=isHL?`rgba(100,255,120,${alpha+0.15})`:`rgba(0,${Math.floor(175+de*60)},${Math.floor(de*38)},${alpha})`;
      ctx.fillText(chars[ci],cx2+2,y);
    }
  }
  ctx.save();ctx.globalCompositeOperation="screen";const glow=ctx.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.5);glow.addColorStop(0,"rgba(0,45,18,0.07)");glow.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);ctx.restore();
  const vL=ctx.createLinearGradient(0,0,W*0.05,0);vL.addColorStop(0,"rgba(0,0,0,0.75)");vL.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=vL;ctx.fillRect(0,0,W*0.05,H);
  const vR=ctx.createLinearGradient(W*0.95,0,W,0);vR.addColorStop(0,"rgba(0,0,0,0)");vR.addColorStop(1,"rgba(0,0,0,0.75)");ctx.fillStyle=vR;ctx.fillRect(W*0.95,0,W*0.05,H);
}

export default function HackerTerminalBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 24);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#010804", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
