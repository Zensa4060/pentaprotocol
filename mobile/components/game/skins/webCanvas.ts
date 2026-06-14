/**
 * Web-canvas HTML builders. These embed the **verbatim** web grid/banner
 * `<canvas>` draw loops (from ``frontend/components/*Grid.tsx`` /
 * ``*Banner.tsx``) into a tiny self-contained HTML document, which we render
 * through a transparent ``react-native-webview`` ([CanvasWebView]). This runs
 * the exact web code on mobile — no re-implementation, no drift.
 *
 * Board backgrounds receive the RN cell-line positions (``lines``) so the
 * webview's grid lines align with the interactive RN cells layered on top.
 * Rollout is gated: only ids in ``WEB_BG_SKINS`` / handled banners are live;
 * widen these as each is verified on device.
 */

const HTML_HEAD =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
  "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}canvas{display:block}</style></head><body>";

/** Grid skins whose web canvas background is live (gated rollout). */
const WEB_BG_SKINS = new Set<string>(["glacier_grid"]);

export function skinHasWebBg(skinId: string | null | undefined): boolean {
  return !!skinId && WEB_BG_SKINS.has(skinId);
}

export interface SkinBgGeom {
  width: number;
  height: number;
  /** Grid-line positions (px) matching the RN cell boundaries. */
  lines: number[];
}

export function buildSkinBgHtml(skinId: string, geom: SkinBgGeom): string | null {
  if (skinId === "glacier_grid") return glacierHtml(geom);
  return null;
}

/** Animated-banner ids whose verbatim web canvas is live (gated rollout).
 *  Add a banner by pasting its web ``draw`` into ``BANNER_DRAWS``. */
export function bannerHtmlFor(bannerId: string | null | undefined): string | null {
  const b = bannerId ? BANNER_DRAWS[bannerId] : undefined;
  return b ? bannerHtml(b.draw, b.bg) : null;
}

/* ── Glacier (verbatim web GlacierGrid: GlacierBg + GridLines) ──────────── */

function glacierHtml({ width, height, lines }: SkinBgGeom): string {
  return (
    HTML_HEAD +
    '<canvas id="c"></canvas><script>(function(){' +
    "var W=" +
    width +
    ",H=" +
    height +
    ",LINES=" +
    JSON.stringify(lines) +
    ";" +
    "var cv=document.getElementById('c');var dpr=Math.min(3,window.devicePixelRatio||2);" +
    "cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';" +
    "var ctx=cv.getContext('2d');ctx.scale(dpr,dpr);" +
    "var snow=Array.from({length:55},function(){return{x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.8+0.6,vy:Math.random()*0.55+0.2,vx:Math.random()*0.4-0.2,phase:Math.random()*Math.PI*2};});" +
    "var snowflakes=Array.from({length:10},function(){return{x:Math.random()*W,y:Math.random()*H,size:Math.random()*W*0.035+W*0.012,rot:Math.random()*Math.PI,rotSpd:Math.random()*0.012-0.006,vy:Math.random()*0.32+0.1,vx:Math.random()*0.22-0.11};});" +
    "var iceShards=[{x:W*0.15,y:H*0.2,a:Math.PI/6},{x:W*0.75,y:H*0.35,a:-Math.PI/4},{x:W*0.5,y:H*0.08,a:Math.PI/8},{x:W*0.9,y:H*0.7,a:-Math.PI/6},{x:W*0.05,y:H*0.75,a:Math.PI/3}];" +
    "var aur=[[W*0.15,H*0.05,'rgba(0,220,180,.09)'],[W*0.65,H*0.02,'rgba(0,120,255,.08)'],[W*0.4,H*0.12,'rgba(60,0,200,.07)']];" +
    "var t=0,last=0;function draw(now){var dt=last?Math.min((now-last)/16.667,3):1;last=now;t+=0.014*dt;var tc=t;ctx.clearRect(0,0,W,H);" +
    "var bg=ctx.createRadialGradient(W*0.5,H*0.3,0,W*0.5,H*0.3,H);bg.addColorStop(0,'#000c1a');bg.addColorStop(0.5,'#000610');bg.addColorStop(1,'#000308');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);" +
    "aur.forEach(function(b,i){var sg=ctx.createRadialGradient(b[0],b[1]+Math.sin(tc*0.3+i)*H*0.04,0,b[0],b[1],W*0.58);sg.addColorStop(0,b[2]);sg.addColorStop(1,'transparent');ctx.fillStyle=sg;ctx.fillRect(0,0,W,H);});" +
    "ctx.save();ctx.globalAlpha=0.07+0.04*Math.sin(tc*0.5);var ag=ctx.createLinearGradient(0,H*0.15,W,H*0.25);ag.addColorStop(0,'transparent');ag.addColorStop(0.3,'rgba(0,200,160,.65)');ag.addColorStop(0.6,'rgba(60,120,255,.55)');ag.addColorStop(1,'transparent');ctx.fillStyle=ag;ctx.fillRect(0,H*0.05,W,H*0.25);ctx.restore();" +
    "iceShards.forEach(function(s){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a+Math.sin(tc*0.2)*0.08);ctx.strokeStyle='rgba(180,240,255,.38)';ctx.lineWidth=1;ctx.shadowColor='rgba(180,240,255,.55)';ctx.shadowBlur=9;for(var j=0;j<3;j++){var a=j*Math.PI/3;var len=W*0.065+j*W*0.016;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);ctx.stroke();}ctx.restore();});" +
    "snowflakes.forEach(function(sf){sf.y+=sf.vy*dt;sf.x+=sf.vx*dt;sf.rot+=sf.rotSpd*dt;if(sf.y>H+sf.size)sf.y=-sf.size;if(sf.x<-sf.size)sf.x=W+sf.size;if(sf.x>W+sf.size)sf.x=-sf.size;ctx.save();ctx.translate(sf.x,sf.y);ctx.rotate(sf.rot);ctx.strokeStyle='rgba(200,240,255,.6)';ctx.lineWidth=1;ctx.shadowColor='rgba(200,240,255,.5)';ctx.shadowBlur=9;for(var j=0;j<6;j++){var a=j*60*Math.PI/180;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*sf.size,Math.sin(a)*sf.size);ctx.stroke();}ctx.restore();});" +
    "snow.forEach(function(s){s.y+=s.vy*dt;s.x+=(s.vx+Math.sin(tc+s.phase)*0.28)*dt;if(s.y>H+5)s.y=-5;if(s.x<-5)s.x=W+5;if(s.x>W+5)s.x=-5;ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle='rgba(220,240,255,.92)';ctx.shadowColor='rgba(200,240,255,.55)';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});" +
    "for(var i=0;i<LINES.length;i++){var x=LINES[i];var icy=0.6+0.4*Math.sin(tc*1.0+i*0.9);" +
    "ctx.save();ctx.strokeStyle='rgba(180,240,255,.07)';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(160,230,255,'+(0.22*icy)+')';ctx.lineWidth=9;ctx.shadowColor='rgba(180,240,255,.7)';ctx.shadowBlur=26;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(200,240,255,'+(0.74*icy)+')';ctx.lineWidth=4;ctx.shadowColor='rgba(220,250,255,1)';ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(240,252,255,'+(0.94*icy)+')';ctx.lineWidth=1.2;ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.restore();" +
    "var y=LINES[i];" +
    "ctx.save();ctx.strokeStyle='rgba(0,200,180,.07)';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(0,190,170,'+(0.2*icy)+')';ctx.lineWidth=9;ctx.shadowColor='rgba(0,220,200,.7)';ctx.shadowBlur=26;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(0,220,200,'+(0.72*icy)+')';ctx.lineWidth=4;ctx.shadowColor='rgba(80,240,220,1)';ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();ctx.restore();" +
    "ctx.save();ctx.strokeStyle='rgba(180,255,248,'+(0.92*icy)+')';ctx.lineWidth=1.2;ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();ctx.restore();}" +
    "for(var a2=0;a2<LINES.length;a2++)for(var b2=0;b2<LINES.length;b2++){var nx=LINES[b2],ny=LINES[a2];var sp=0.5+0.5*Math.abs(Math.sin(tc*2+(a2*6+b2)*0.9));ctx.save();ctx.translate(nx,ny);ctx.globalAlpha=sp*0.9;ctx.strokeStyle='rgba(220,250,255,.9)';ctx.lineWidth=1.3;ctx.shadowColor='rgba(200,240,255,1)';ctx.shadowBlur=14*sp;var sz=8*0.6+sp*4;[0,60,120].forEach(function(an){var rad=an*Math.PI/180;ctx.beginPath();ctx.moveTo(-Math.cos(rad)*sz,-Math.sin(rad)*sz);ctx.lineTo(Math.cos(rad)*sz,Math.sin(rad)*sz);ctx.stroke();});ctx.fillStyle='rgba(240,255,255,'+(0.92*sp)+')';ctx.shadowBlur=12*sp;ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();ctx.restore();}" +
    "requestAnimationFrame(draw);}requestAnimationFrame(draw);" +
    "})();</script></body></html>"
  );
}

/* ── Banners (verbatim web *Banner draw loops + shared rAF wrapper) ─────── */

/**
 * Wrap a verbatim web banner ``draw(ctx,t,W,H,s)`` in the ``useBannerCanvas``
 * rAF loop (delta-time ``s._dt``, seconds ``t``, DPR transform, self-resize).
 * Porting a banner = paste its web ``draw`` into ``BANNER_DRAWS``.
 */
function bannerHtml(drawSrc: string, bg: string): string {
  return (
    HTML_HEAD.replace("background:transparent", "background:" + bg) +
    '<canvas id="c"></canvas><script>(function(){' +
    "var cv=document.getElementById('c');var ctx=cv.getContext('2d',{alpha:true});" +
    "var D=Math.min(window.devicePixelRatio||1,2);var W=0,H=0;var s={};var t=0,last=0;" +
    "function resize(){W=window.innerWidth;H=window.innerHeight;cv.width=W*D;cv.height=H*D;cv.style.width=W+'px';cv.style.height=H+'px';s={};last=0;}" +
    "var draw=" + drawSrc + ";" +
    "function loop(now){requestAnimationFrame(loop);var deltaMs=last>0?Math.min(now-last,100):16.667;last=now;s._dt=deltaMs/16.667;if(W>1&&H>1){ctx.setTransform(D,0,0,D,0,0);try{draw(ctx,t,W,H,s);}catch(e){}}t+=deltaMs/1000;}" +
    "window.addEventListener('resize',resize);resize();requestAnimationFrame(loop);" +
    "})();</script></body></html>"
  );
}

/**
 * id → { verbatim web ``draw`` source, body background }. Each ``draw`` is the
 * exact function copied from the matching ``frontend/components/*Banner.tsx``.
 * Backtick strings so inner ' and " need no escaping.
 */
const BANNER_DRAWS: Record<string, { draw: string; bg: string }> = {
  digital_rain: {
    bg: "#000602",
    draw: `function(ctx,_t,W,H,s){var CW=Math.max(10,Math.min(18,W/48));var NCOLS=Math.ceil(W/CW);var TRAIL=Math.max(8,Math.ceil(H/CW)+3);if(!s.c||s.nc!==NCOLS||s.trail!==TRAIL){s.nc=NCOLS;s.trail=TRAIL;s.c=Array.from({length:NCOLS},function(){return{y:-(Math.random()*H*0.8),spd:(2.2+Math.random()*3.5)*(CW/13),chars:Array.from({length:TRAIL+5},function(){return String.fromCharCode(0x30a0+Math.floor(Math.random()*96));}),ct:0,cs:2+Math.floor(Math.random()*4),bright:Math.random()>0.8};});}var dt=(s._dt)||1;var trailAlpha=Math.min(0.99,1-Math.pow(1-0.88,dt));ctx.fillStyle='rgba(0,6,2,'+trailAlpha.toFixed(3)+')';ctx.fillRect(0,0,W,H);var fz=CW-1;ctx.font=fz+"px 'Courier New',monospace";ctx.textAlign='center';s.c.forEach(function(col,i){col.y+=col.spd*dt;col.ct+=dt;if(col.ct>=col.cs){col.ct=0;col.chars.shift();col.chars.push(String.fromCharCode(0x30a0+Math.floor(Math.random()*96)));}if(col.y-TRAIL*CW>H+20){col.y=-(CW*(1+Math.random()*3));col.spd=(2.2+Math.random()*3.5)*(CW/13);col.bright=Math.random()>0.8;}var x=i*CW+CW/2;col.chars.forEach(function(ch,ci){var cy=col.y-ci*CW;if(cy<-CW||cy>H+CW)return;var fade=Math.max(0,1-ci/TRAIL);if(ci===0){ctx.save();ctx.globalCompositeOperation='screen';var hg=ctx.createRadialGradient(x,cy,0,x,cy,CW);hg.addColorStop(0,'rgba(0,255,100,0.3)');hg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=hg;ctx.fillRect(x-CW,cy-CW,CW*2,CW*2);ctx.restore();ctx.fillStyle=col.bright?'#ffffff':'#b0ffcc';}else{var g=Math.floor(50+fade*185);ctx.fillStyle='rgba(0,'+g+','+Math.floor(fade*55)+','+(fade*0.92)+')';}ctx.fillText(ch,x,cy);});});var vL=ctx.createLinearGradient(0,0,W*0.05,0);vL.addColorStop(0,'rgba(0,6,2,0.9)');vL.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=vL;ctx.fillRect(0,0,W*0.05,H);var vR=ctx.createLinearGradient(W*0.95,0,W,0);vR.addColorStop(0,'rgba(0,0,0,0)');vR.addColorStop(1,'rgba(0,6,2,0.9)');ctx.fillStyle=vR;ctx.fillRect(W*0.95,0,W*0.05,H);}`,
  },
  // Other banners (neon_pulse, etc.) get ported here after Digital Rain is
  // verified on device — paste each web *Banner draw() and widen as needed.
};
