"use client";
import { useEffect, useRef } from "react";

export default function SpaceBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D;
    if (!ctx) return;

    interface Nebula {
      cx: number; cy: number; rx: number; ry: number; hue: string; a: number;
    }

    function draw(W: number, H: number) {
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0,    "#0a1a3a");
      bg.addColorStop(0.18, "#071528");
      bg.addColorStop(0.45, "#050e1e");
      bg.addColorStop(0.72, "#030918");
      bg.addColorStop(1,    "#020612");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const bandLayers = [
        [0.5, 0.26, 0.70, 0.10,  30,  80, 200, 0.055],
        [0.5, 0.27, 0.60, 0.07,  50, 110, 220, 0.065],
        [0.5, 0.25, 0.55, 0.055, 20,  60, 180, 0.045],
        [0.5, 0.28, 0.42, 0.04,  80, 140, 255, 0.035],
        [0.48, 0.26, 0.28, 0.035, 180, 160, 100, 0.025],
      ] as const;

      for (const [xf, yf, rxf, ryf, r, g, b, a] of bandLayers) {
        const cx = W * xf, cy = H * yf;
        const rx = W * rxf, ry = H * ryf;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g2.addColorStop(0,   `rgba(${r},${g},${b},${a})`);
        g2.addColorStop(0.4, `rgba(${r},${g},${b},${(a * 0.55).toFixed(4)})`);
        g2.addColorStop(0.75,`rgba(${r},${g},${b},${(a * 0.18).toFixed(4)})`);
        g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      for (const c of [
        { xf: 0.18, yf: 0.24, r: W * 0.04 },
        { xf: 0.38, yf: 0.27, r: W * 0.035 },
        { xf: 0.58, yf: 0.25, r: W * 0.045 },
        { xf: 0.76, yf: 0.27, r: W * 0.03  },
      ]) {
        const cg = ctx.createRadialGradient(c.xf * W, c.yf * H, 0, c.xf * W, c.yf * H, c.r);
        cg.addColorStop(0,   "rgba(160,200,255,0.06)");
        cg.addColorStop(0.5, "rgba(100,160,255,0.025)");
        cg.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(c.xf * W, c.yf * H, c.r, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();

      const nebulae: Nebula[] = [
        { cx: W * 0.20, cy: H * 0.28, rx: W * 0.32, ry: H * 0.22, hue: "20,40,120",  a: 0.16 },
        { cx: W * 0.70, cy: H * 0.22, rx: W * 0.28, ry: H * 0.18, hue: "10,20,100",  a: 0.12 },
        { cx: W * 0.50, cy: H * 0.30, rx: W * 0.50, ry: H * 0.20, hue: "5,10,60",    a: 0.09 },
        { cx: W * 0.88, cy: H * 0.35, rx: W * 0.18, ry: H * 0.14, hue: "40,10,90",   a: 0.08 },
        { cx: W * 0.08, cy: H * 0.45, rx: W * 0.20, ry: H * 0.16, hue: "0,30,80",    a: 0.07 },
      ];

      for (const n of nebulae) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const g = ctx.createRadialGradient(n.cx, n.cy, 0, n.cx, n.cy, Math.max(n.rx, n.ry));
        g.addColorStop(0,    `rgba(${n.hue},${n.a})`);
        g.addColorStop(0.4,  `rgba(${n.hue},${n.a * 0.5})`);
        g.addColorStop(0.75, `rgba(${n.hue},${n.a * 0.18})`);
        g.addColorStop(1,    `rgba(${n.hue},0)`);
        ctx.scale(1, n.ry / n.rx);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.cx, n.cy * n.rx / n.ry, n.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw(canvas.width, canvas.height);
    };

    window.addEventListener("resize", onResize);
    onResize();

    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100%",
        height: "100%",
      }}
    />
  );
}
