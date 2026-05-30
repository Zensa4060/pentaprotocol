"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const N = 220;
  if (!s.stars) {
    s.stars = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      return { angle, dist: 0.02 + Math.random() * 0.3, speed: 0.008 + Math.random() * 0.022, size: Math.random() * 1.5 + 0.3, col: Math.random() > 0.82 ? [200, 220, 255] : [255, 255, 255], trailFrac: 0.08 + Math.random() * 0.14 };
    });
  }
  const compact = Math.max(W, H) < 200;
  ctx.fillStyle = compact ? "rgba(2,3,14,0.45)" : "rgba(2,3,14,0.75)"; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const maxR = Math.hypot(W / 2, H / 2) * 1.02;
  s.stars.forEach((star: any) => {
    star.dist += star.speed;
    if (star.dist > 1.0) { star.dist = 0.02 + Math.random() * 0.08; star.angle = Math.random() * Math.PI * 2; star.speed = 0.008 + Math.random() * 0.022; }
    const r = star.dist * maxR;
    const px = cx + Math.cos(star.angle) * r, py = cy + Math.sin(star.angle) * r;
    const tr = Math.max(0, (star.dist - star.trailFrac * star.dist)) * maxR;
    const tx2 = cx + Math.cos(star.angle) * tr, ty2 = cy + Math.sin(star.angle) * tr;
    const bright = Math.min(1, star.dist * 2.2), alpha = bright * 0.9;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const tg = ctx.createLinearGradient(tx2, ty2, px, py);
    tg.addColorStop(0, `rgba(${star.col[0]},${star.col[1]},${star.col[2]},0)`);
    tg.addColorStop(1, `rgba(${star.col[0]},${star.col[1]},${star.col[2]},${alpha * 0.75})`);
    ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px, py);
    ctx.strokeStyle = tg; ctx.lineWidth = star.size * (0.5 + bright * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, star.size * (0.4 + bright * 0.7), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${star.col[0]},${star.col[1]},${star.col[2]},${alpha})`; ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.globalCompositeOperation = "screen";
  const coreR = Math.min(W, H) * 0.06;
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2);
  cg.addColorStop(0, `rgba(180,160,255,${0.45 + Math.sin(t * 2) * 0.08})`);
  cg.addColorStop(0.5, "rgba(100,80,200,0.15)"); cg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H); ctx.restore();
  const vig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * (compact ? 0.08 : 0.15), cx, cy, Math.max(W, H) * (compact ? 0.92 : 0.75));
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, compact ? "rgba(1,2,12,0.38)" : "rgba(1,2,12,0.72)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

export default function HyperdriveBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#02030e", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
