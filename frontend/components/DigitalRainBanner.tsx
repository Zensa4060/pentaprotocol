"use client";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type DrawState = {
  nc?: number;
  trail?: number;
  c?: Array<{
    y: number;
    spd: number;
    chars: string[];
    ct: number;
    cs: number;
    bright: boolean;
  }>;
};

function draw(
  ctx: CanvasRenderingContext2D,
  _t: number,
  W: number,
  H: number,
  s: DrawState,
) {
  const CW = Math.max(10, Math.min(18, W / 48));
  const NCOLS = Math.ceil(W / CW);
  const TRAIL = Math.max(8, Math.ceil(H / CW) + 3);

  if (!s.c || s.nc !== NCOLS || s.trail !== TRAIL) {
    s.nc = NCOLS;
    s.trail = TRAIL;
    s.c = Array.from({ length: NCOLS }, () => ({
      y: -(Math.random() * H * 0.8),
      spd: (0.6 + Math.random() * 1.2) * (CW / 13),
      chars: Array.from({ length: TRAIL + 5 }, () =>
        String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
      ),
      ct: 0,
      cs: 2 + Math.floor(Math.random() * 4),
      bright: Math.random() > 0.8,
    }));
  }

  ctx.fillStyle = "rgba(0,6,2,0.88)";
  ctx.fillRect(0, 0, W, H);

  const fz = CW - 1;
  ctx.font = `${fz}px 'Courier New',monospace`;
  ctx.textAlign = "center";

  s.c.forEach((col, i) => {
    col.y += col.spd;
    col.ct++;
    if (col.ct >= col.cs) {
      col.ct = 0;
      col.chars.shift();
      col.chars.push(
        String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
      );
    }
    if (col.y - TRAIL * CW > H + 20) {
      col.y = -(CW * (1 + Math.random() * 3));
      col.spd = (0.6 + Math.random() * 1.2) * (CW / 13);
      col.bright = Math.random() > 0.8;
    }

    const x = i * CW + CW / 2;
    col.chars.forEach((ch, ci) => {
      const cy = col.y - ci * CW;
      if (cy < -CW || cy > H + CW) return;
      const fade = Math.max(0, 1 - ci / TRAIL);

      if (ci === 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const hg = ctx.createRadialGradient(x, cy, 0, x, cy, CW);
        hg.addColorStop(0, "rgba(0,255,100,0.3)");
        hg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = hg;
        ctx.fillRect(x - CW, cy - CW, CW * 2, CW * 2);
        ctx.restore();
        ctx.fillStyle = col.bright ? "#ffffff" : "#b0ffcc";
      } else {
        const g = Math.floor(50 + fade * 185);
        ctx.fillStyle = `rgba(0,${g},${Math.floor(fade * 55)},${fade * 0.92})`;
      }
      ctx.fillText(ch, x, cy);
    });
  });

  // Edge vignette
  const vL = ctx.createLinearGradient(0, 0, W * 0.05, 0);
  vL.addColorStop(0, "rgba(0,6,2,0.9)");
  vL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vL;
  ctx.fillRect(0, 0, W * 0.05, H);
  const vR = ctx.createLinearGradient(W * 0.95, 0, W, 0);
  vR.addColorStop(0, "rgba(0,0,0,0)");
  vR.addColorStop(1, "rgba(0,6,2,0.9)");
  ctx.fillStyle = vR;
  ctx.fillRect(W * 0.95, 0, W * 0.05, H);
}

export default function DigitalRainBanner({
  style = {},
  hideLabels: _hideLabels = false,
}: {
  style?: CSSProperties;
  hideLabels?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef  = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dimRef = useRef({ W: 1, H: 1, D: 1 });
  const stRef  = useRef<DrawState>({});

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv   = cvRef.current;
    if (!wrap || !cv) return;

    let t = 0;

    const resize = () => {
      const D = Math.min(window.devicePixelRatio || 1, 2);
      const W = wrap.offsetWidth;
      const H = wrap.offsetHeight;
      dimRef.current  = { W, H, D };
      cv.width        = W * D;
      cv.height       = H * D;
      cv.style.width  = W + "px";
      cv.style.height = H + "px";
      stRef.current   = {}; // reset columns so they re-fit the new size
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const loop = () => {
      const { W, H, D } = dimRef.current;
      if (W > 1 && H > 1) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.setTransform(D, 0, 0, D, 0, 0);
          draw(ctx, t, W, H, stRef.current);
        }
      }
      t += 1 / 30;
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#000602", ...style }}
    >
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
