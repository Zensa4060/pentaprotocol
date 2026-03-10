"use client";
import { useEffect, useRef } from "react";

export default function SpaceBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Stars
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.2,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.3 + 0.05,
    }));

    let frame = 0;
    let animId: number;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      // Deep space gradient
      const grad = ctx.createRadialGradient(w * 0.4, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
      grad.addColorStop(0, "#0d1b4b");
      grad.addColorStop(0.5, "#02040F");
      grad.addColorStop(1, "#000008");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Nebula glow
      const neb = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.7, h * 0.2, w * 0.4);
      neb.addColorStop(0, "rgba(100,60,200,0.08)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      const neb2 = ctx.createRadialGradient(w * 0.2, h * 0.7, 0, w * 0.2, h * 0.7, w * 0.35);
      neb2.addColorStop(0, "rgba(0,100,180,0.07)");
      neb2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      // Draw stars
      stars.forEach(s => {
        const twinkle = Math.sin(frame * s.speed + s.x) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * twinkle})`;
        ctx.fill();
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