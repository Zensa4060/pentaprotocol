"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

const INVADER = [
  [0,0,1,0,0,0,0,0,1,0,0],[0,0,0,1,0,0,0,1,0,0,0],[0,0,1,1,1,1,1,1,1,0,0],
  [0,1,1,0,1,1,1,0,1,1,0],[1,1,1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,1,0,1],[0,0,0,1,1,0,1,1,0,0,0],
];

function drawInvader(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, col: string, frame: number) {
  const flipped = frame % 2 === 0;
  INVADER.forEach((row, ry) => {
    row.forEach((cell, rx) => {
      if (!cell) return;
      const drawRx = flipped ? rx : 10 - rx;
      ctx.fillStyle = col;
      ctx.fillRect(x + drawRx * px, y + ry * px, px - 0.5, px - 0.5);
    });
  });
}

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const PX = Math.max(3, Math.floor(H / 10));
  const COLS = Math.ceil(W / (PX * 14));
  if (!s.stars) {
    s.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, ph: Math.random() * Math.PI * 2 }));
    s.bullets = Array.from({ length: 8 }, () => ({ x: 0, y: H + 10, active: false, col: "#ff0088" }));
    s.bulletTimer = 0;
  }
  ctx.fillStyle = "#000010"; ctx.fillRect(0, 0, W, H);
  s.stars.forEach((st: any) => {
    const tw = Math.sin(t * 1.5 + st.ph) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(200,210,255,${0.08 + tw * 0.4})`;
    ctx.fillRect(Math.round(st.x), Math.round(st.y), 1, 1);
  });
  for (let y = 0; y < H; y += 3) { ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(0, y, W, 1); }
  const frame = Math.floor(t * 2);
  const nRows = Math.max(2, Math.floor(H / (PX * 11)));
  const invaderW = PX * 11, invaderH = PX * 8, margin = PX * 1.5;
  const totalRowW = COLS * (invaderW + margin);
  const scroll = (t * PX * 1.8) % (invaderW + margin);
  const rowColors = ["#ff0088","#ff4400","#ffcc00","#00ff88","#00ccff","#aa44ff","#ff2244","#44ffaa"];
  for (let row = 0; row < nRows; row++) {
    const rowY = H * (0.08 + row * (0.88 / nRows));
    const dir = row % 2 === 0 ? 1 : -1;
    const rowScroll = dir * scroll;
    const col = rowColors[row % rowColors.length];
    for (let col2 = -1; col2 <= COLS + 1; col2++) {
      const ix = col2 * (invaderW + margin) + rowScroll;
      const ixWrapped = ((ix % totalRowW) + totalRowW * 2) % totalRowW - (invaderW + margin);
      if (ixWrapped > W + invaderW || ixWrapped < -invaderW * 2) continue;
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const gg = ctx.createRadialGradient(ixWrapped + invaderW / 2, rowY + invaderH / 2, 0, ixWrapped + invaderW / 2, rowY + invaderH / 2, invaderW * 0.65);
      const hex = col.replace("#", "");
      const rr = parseInt(hex.slice(0,2),16), gg2 = parseInt(hex.slice(2,4),16), bb = parseInt(hex.slice(4,6),16);
      gg.addColorStop(0, `rgba(${rr},${gg2},${bb},0.12)`); gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg; ctx.fillRect(ixWrapped - invaderW * 0.5, rowY - invaderH * 0.5, invaderW * 2, invaderH * 2);
      ctx.restore();
      drawInvader(ctx, ixWrapped, rowY, PX, col, frame + row + col2);
    }
  }
  s.bulletTimer++;
  if (s.bulletTimer > 18) {
    s.bulletTimer = 0;
    const b = s.bullets.find((b: any) => !b.active);
    if (b) { b.x = Math.random() * W; b.y = H; b.active = true; b.col = rowColors[Math.floor(Math.random() * rowColors.length)]; }
  }
  s.bullets.forEach((b: any) => {
    if (!b.active) return;
    b.y -= H * 0.025;
    if (b.y < -8) { b.active = false; return; }
    ctx.save(); ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = b.col; ctx.fillRect(Math.round(b.x - PX * 0.3), Math.round(b.y), Math.round(PX * 0.6), PX * 2);
    const bg2 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, PX * 2);
    bg2.addColorStop(0, b.col + "88"); bg2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg2; ctx.fillRect(b.x - PX * 2, b.y - PX * 2, PX * 4, PX * 4); ctx.restore();
  });
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, H - PX * 2.5, W, PX * 2.5);
  const score = (Math.floor(t * 120) % 99999).toString().padStart(5, "0");
  ctx.font = `bold ${PX * 1.4}px 'Courier New',monospace`;
  ctx.fillStyle = "#ffcc00"; ctx.textAlign = "left"; ctx.fillText(`SCORE: ${score}`, PX, H - PX * 0.8);
  ctx.fillStyle = "#00ff88"; ctx.textAlign = "right";
  ctx.fillText(`${Array(Math.floor((t * 0.5) % 4) + 1).fill("♥").join("")}`, W - PX, H - PX * 0.8);
}

export default function ArcadeBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 60);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#000010", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
