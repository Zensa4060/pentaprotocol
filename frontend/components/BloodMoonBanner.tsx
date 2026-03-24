"use client";
import React, { useEffect, useRef, useState } from "react";

const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;

export default function BloodMoonBanner({ style = {}, hideLabels = false }: { style?: React.CSSProperties; hideLabels?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [dims, setDims] = useState({ w: 860, h: 80 });

  // Use ResizeObserver for true responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ w: width, h: height });
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const stars = useRef(Array.from({length:90},()=>({
    x: Math.random() * 860, 
    y: Math.random() * 80, 
    r: Math.random() * 1.2 + 0.2, 
    phase: Math.random() * Math.PI * 2, 
    speed: 0.4 + Math.random() * 2
  })));
  
  const drips = useRef(Array.from({length:10},(_,i)=>({
    x: 860 - 130 + i * 10 + (Math.random() - 0.5) * 8, 
    y: 80 / 2 + 16, 
    len: 0, 
    maxLen: 12 + Math.random() * 22, 
    speed: 0.25 + Math.random() * 0.4, 
    phase: 0, 
    delay: i * 14 + Math.random() * 25
  })));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w * DPR;
    canvas.height = dims.h * DPR;
    // Reset transform so DPR scaling doesn't accumulate on resize.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const DW = dims.w;
    const DH = dims.h;
    const scaleX = DW / 860;
    const scaleY = DH / 80;

    let t = 0;

    const draw = () => {
      // Deep night sky
      const bg = ctx.createLinearGradient(0,0,DW,0);
      bg.addColorStop(0,"#000008"); bg.addColorStop(0.5,"#0a0012"); bg.addColorStop(0.75,"#180008"); bg.addColorStop(1,"#080006");
      ctx.fillStyle=bg; ctx.fillRect(0,0,DW,DH);

      // Nebula smear
      ctx.save(); ctx.globalCompositeOperation="screen";
      const neb = ctx.createRadialGradient(DW*0.6,DH*0.4,0,DW*0.6,DH*0.4,100 * scaleX);
      neb.addColorStop(0,"rgba(80,0,20,0.06)"); neb.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=neb; ctx.fillRect(0,0,DW,DH); ctx.restore();

      // Stars with detailed twinkle
      stars.current.forEach(s=>{
        const sx = s.x * scaleX;
        const sy = s.y * scaleY;
        const tw = Math.sin(t*s.speed+s.phase)*0.5+0.5;
        ctx.save(); ctx.globalCompositeOperation="screen";
        // Diffraction spikes on bright stars
        if(s.r>0.9 && tw>0.7){
          const sz=(tw-0.7)*8 * scaleX;
          ctx.beginPath(); ctx.moveTo(sx-sz,sy); ctx.lineTo(sx+sz,sy);
          ctx.moveTo(sx,sy-sz); ctx.lineTo(sx,sy+sz);
          ctx.strokeStyle=`rgba(255,230,200,${(tw-0.7)*0.8})`; ctx.lineWidth=0.4; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(sx,sy,s.r*(0.4+tw*0.6) * scaleX,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,240,220,${0.08+tw*0.7})`; ctx.fill(); ctx.restore();
      });

      const MX=DW - (95 * scaleX), MY=DH/2;
      const glow=Math.sin(t*1.4)*0.5+0.5;

      // Moon atmospheric halo layers
      for(let i=0;i<4;i++){
        const haloR=(32+i*10) * scaleX;
        ctx.save(); ctx.globalCompositeOperation="screen";
        const halo=ctx.createRadialGradient(MX,MY,28 * scaleX,MX,MY,haloR);
        halo.addColorStop(0,`rgba(180,0,0,0)`);
        halo.addColorStop(0.7,`rgba(${160-i*15},0,0,${(0.12+glow*0.08)/Math.pow(i+1,0.8)})`);
        halo.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(MX,MY,haloR,0,Math.PI*2); ctx.fill(); ctx.restore();
      }

      // Moon body — rich texture
      const moonGrd=ctx.createRadialGradient(MX-(5 * scaleX),MY-(5 * scaleY),2 * scaleX,MX,MY,30 * scaleX);
      moonGrd.addColorStop(0,"#c01818"); moonGrd.addColorStop(0.4,"#991010"); moonGrd.addColorStop(0.7,"#7a0c0c"); moonGrd.addColorStop(1,"#3a0606");
      ctx.beginPath(); ctx.arc(MX,MY,30 * scaleX,0,Math.PI*2); ctx.fillStyle=moonGrd; ctx.fill();

      // Craters
      [{x:-9,y:-10,r:5.5},{x:9,y:6,r:3.5},{x:-4,y:12,r:4},{x:12,y:-8,r:2.5}].forEach(cr=>{
        const crX = MX + cr.x * scaleX;
        const crY = MY + cr.y * scaleY;
        const crR = cr.r * scaleX;
        const cgrd=ctx.createRadialGradient(crX-(1 * scaleX),crY-(1 * scaleY),0,crX,crY,crR);
        cgrd.addColorStop(0,"rgba(0,0,0,0.35)"); cgrd.addColorStop(0.7,"rgba(0,0,0,0.15)"); cgrd.addColorStop(1,"rgba(160,40,40,0.1)");
        ctx.beginPath(); ctx.arc(crX,crY,crR,0,Math.PI*2); ctx.fillStyle=cgrd; ctx.fill();
        ctx.beginPath(); ctx.arc(crX,crY,crR,0,Math.PI*2);
        ctx.strokeStyle="rgba(180,40,40,0.2)"; ctx.lineWidth=0.5; ctx.stroke();
      });

      // Shadow for crescent (eclipse)
      const shd=ctx.createRadialGradient(MX-(16 * scaleX),MY-(8 * scaleY),4 * scaleX,MX-(16 * scaleX),MY-(8 * scaleY),34 * scaleX);
      shd.addColorStop(0,"rgba(0,0,8,0.97)"); shd.addColorStop(0.65,"rgba(0,0,8,0.75)"); shd.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(MX,MY,30 * scaleX,0,Math.PI*2); ctx.fillStyle=shd; ctx.fill();

      // Crescent rim glow
      ctx.beginPath(); ctx.arc(MX,MY,30 * scaleX,-0.7,0.7);
      ctx.strokeStyle=`rgba(255,60,60,${0.55+glow*0.25})`; ctx.lineWidth=1.6;
      ctx.shadowColor="rgba(255,0,0,0.5)"; ctx.shadowBlur=4; ctx.stroke(); ctx.shadowBlur=0;

      // Blood drips
      drips.current.forEach(d=>{
        d.phase+=0.016; const active=d.phase>d.delay/60;
        if(active && d.len<d.maxLen) d.len+=d.speed;
        
        const dx = (DW - (130 * scaleX)) + (d.x - (860 - 130)) * scaleX;
        const dy = (DH/2 + 16 * scaleY) + (d.y - (80/2 + 16)) * scaleY;
        const dlen = d.len * scaleY;

        if(d.len>0){
          const dripGrd=ctx.createLinearGradient(dx,dy,dx,dy+dlen);
          dripGrd.addColorStop(0,"rgba(180,20,20,0.9)"); dripGrd.addColorStop(0.7,"rgba(160,10,10,0.6)"); dripGrd.addColorStop(1,"rgba(140,0,0,0)");
          ctx.beginPath(); ctx.moveTo(dx,dy); ctx.lineTo(dx,dy+dlen);
          ctx.strokeStyle=dripGrd; ctx.lineWidth=1.6 * scaleX;
          ctx.shadowColor="rgba(200,0,0,0.4)"; ctx.shadowBlur=3; ctx.stroke(); ctx.shadowBlur=0;
          // Drip tip bulge
          const tipAlpha=Math.min(1,d.len/d.maxLen);
          ctx.beginPath(); ctx.arc(dx,dy+dlen,2.2*tipAlpha * scaleX,0,Math.PI*2);
          ctx.fillStyle=`rgba(170,10,10,${tipAlpha*0.7})`; ctx.fill();
        }
        if(d.len>=d.maxLen && d.phase>(d.delay/60+d.maxLen/d.speed/60+0.5)){
          d.len=0; d.phase=0; d.delay=Math.random()*25;
        }
      });

      // (Rarity/name badge removed for all screens)

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims, hideLabels]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
