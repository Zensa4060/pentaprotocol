"use client";
import { useEffect, useRef } from "react";

export default function PixelBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const TILE = 32;
    const colors = ["#1a2e0a", "#162808", "#1f3510", "#10140B", "#0d1007", "#243d12"];
    const accentColors = ["#4a7c24", "#5a9030", "#3d6b1c", "#6aaa3a"];

    // Generate fixed tile grid
    const cols = Math.ceil(1920 / TILE) + 2;
    const rows = Math.ceil(1080 / TILE) + 2;
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        color: colors[Math.floor(Math.random() * colors.length)],
        accent: Math.random() < 0.06,
        accentColor: accentColors[Math.floor(Math.random() * accentColors.length)],
      }))
    );

    // Fireflies
    const flies = Array.from({ length: 18 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    let animId: number;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      const cols2 = Math.ceil(w / TILE) + 2;
      const rows2 = Math.ceil(h / TILE) + 2;

      // Draw tiles
      for (let r = 0; r < rows2; r++) {
        for (let c = 0; c < cols2; c++) {
          const cell = grid[r % grid.length][c % grid[0].length];
          ctx.fillStyle = cell.color;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          if (cell.accent) {
            ctx.fillStyle = cell.accentColor + "33";
            ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
          }
        }
      }

      // Grid lines
      ctx.strokeStyle = "rgba(74,124,36,0.08)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= w; c += TILE) {
        ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, h); ctx.stroke();
      }
      for (let r = 0; r <= h; r += TILE) {
        ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(w, r); ctx.stroke();
      }

      // Fireflies
      flies.forEach(f => {
        f.x += f.vx; f.y += f.vy;
        if (f.x < 0) f.x = w; if (f.x > w) f.x = 0;
        if (f.y < 0) f.y = h; if (f.y > h) f.y = 0;
        const glow = Math.sin(frame * 0.03 + f.phase) * 0.5 + 0.5;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 8);
        grad.addColorStop(0, `rgba(120,220,60,${glow * 0.8})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(f.x - 8, f.y - 8, 16, 16);
      });

      frame++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      width: "100%", height: "100%",
    }} />
  );
}