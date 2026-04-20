"use client";

import React, { useEffect, useRef } from "react";

export type MatchFoundSketchVSProps = {
  size: number;
  ink: string;
  sealBg: string;
  sealStroke: string;
  sealText: string;
  dropShadow: string;
};

/**
 * Sumi-e style “VS” canvas — brush strokes, drips, and 対決印 seal.
 * Stroke / seal colors follow the match-found theme palette.
 */
const MatchFoundSketchVS = React.memo(
  ({ size, ink, sealBg, sealStroke, sealText, dropShadow }: MatchFoundSketchVSProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 820;
      const H = 480;
      const INK = ink;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
      const easeInOut = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const easeOutBack = (t: number) => {
        const c = 1.70158;
        const c3 = c + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      };

      const cubic = (
        p0: [number, number],
        p1: [number, number],
        p2: [number, number],
        p3: [number, number],
        n: number,
      ): [number, number][] => {
        const out: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          out.push([
            mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
            mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
          ]);
        }
        return out;
      };

      const drawStroke = (
        pts: [number, number][],
        widths: number[],
        progress: number,
      ) => {
        if (pts.length < 2 || progress <= 0) return;
        const n = Math.max(2, Math.floor(pts.length * progress));
        const p = pts.slice(0, n);
        const w = widths.slice(0, n);

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = INK;
        ctx.fillStyle = INK;
        ctx.globalAlpha = 0.97;
        for (let i = 1; i < p.length; i++) {
          const ww = (w[i - 1] + w[i]) * 0.5;
          ctx.lineWidth = ww;
          ctx.beginPath();
          ctx.moveTo(p[i - 1][0], p[i - 1][1]);
          ctx.lineTo(p[i][0], p[i][1]);
          ctx.stroke();
        }
      };

      const drips = [
        { x: 142, y: 310, delay: 1100, dur: 900, len: 28, w: 3.5 },
        { x: 236, y: 298, delay: 1300, dur: 800, len: 18, w: 2.5 },
        { x: 190, y: 348, delay: 1500, dur: 700, len: 22, w: 3.0 },
        { x: 582, y: 285, delay: 1200, dur: 850, len: 20, w: 2.8 },
        { x: 528, y: 272, delay: 1600, dur: 750, len: 15, w: 2.2 },
      ];

      const drawDrips = (elapsed: number) => {
        ctx.save();
        ctx.fillStyle = INK;
        ctx.strokeStyle = INK;
        ctx.lineCap = "round";
        drips.forEach((d) => {
          if (elapsed < d.delay) return;
          const t = Math.min(1, (elapsed - d.delay) / d.dur);
          const len = d.len * easeOut3(t);
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = d.w;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y + len);
          ctx.stroke();
          const bulb = d.w * 0.9;
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          ctx.arc(d.x, d.y + len, bulb, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      };

      const vLP = cubic([108, 62], [132, 168], [172, 278], [190, 348], 46);
      const vLW = vLP.map((_, i) => {
        const t = i / 46;
        return 74 * (1 - t * 0.63) + 18;
      });
      const vRP = cubic([328, 62], [302, 168], [232, 278], [190, 348], 46);
      const vRW = vRP.map((_, i) => {
        const t = i / 46;
        return 74 * (1 - t * 0.63) + 18;
      });

      const OX = 182;
      const OY = 25;
      const sTP = cubic([462, 102], [470, 54], [336, 44], [316, 98], 40).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sTW = sTP.map((_, i) => {
        const t = i / 40;
        return 62 * (1 - Math.abs(t - 0.5) * 0.92) + 16;
      });
      const sMP = cubic([316, 98], [306, 148], [416, 163], [455, 210], 28).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sMW = sMP.map((_, i) => {
        const t = i / 28;
        return 24 + t * 32;
      });
      const sBP = cubic([455, 210], [472, 258], [332, 302], [302, 260], 40).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sBW = sBP.map((_, i) => {
        const t = i / 40;
        return 62 * (1 - Math.abs(t - 0.5) * 0.92) + 16;
      });

      const drawSeal = (alpha: number, scale: number) => {
        const sx = 664;
        const sy = 298;
        const sw = 78;
        const sh = 78;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx + sw / 2, sy + sh / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
        ctx.fillStyle = sealBg;
        ctx.beginPath();
        const rr = (ctx as any).roundRect?.bind(ctx);
        if (rr) rr(sx, sy, sw, sh, 3);
        else ctx.rect(sx, sy, sw, sh);
        ctx.fill();
        ctx.strokeStyle = sealStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (rr) rr(sx + 5, sy + 5, sw - 10, sh - 10, 2);
        else ctx.rect(sx + 5, sy + 5, sw - 10, sh - 10);
        ctx.stroke();
        ctx.fillStyle = sealText;
        ctx.font = "900 13px Georgia,serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        (
          [
            ["対", sy + 17],
            ["決", sy + 39],
            ["印", sy + 61],
          ] as const
        ).forEach(([ch, y]) => ctx.fillText(ch as string, sx + sw / 2, y as number));
        ctx.restore();
      };

      let startTime = 0;
      let raf = 0;
      const TOTAL = 2700;
      const prog = (delay: number, dur: number, elapsed: number) =>
        elapsed < delay ? 0 : easeInOut(Math.min(1, (elapsed - delay) / dur));

      const frame = (ts: number) => {
        if (!startTime) startTime = ts;
        const el = ts - startTime;

        ctx.clearRect(0, 0, W, H);

        ctx.save();
        drawStroke(vLP, vLW, prog(0, 940, el));
        drawStroke(vRP, vRW, prog(0, 940, el));
        drawStroke(sTP, sTW, prog(0, 940, el));
        drawStroke(sMP, sMW, prog(720, 400, el));
        drawStroke(sBP, sBW, prog(920, 940, el));
        ctx.restore();

        drawDrips(el);

        const st = Math.max(0, Math.min(1, (el - 2200) / 420));
        if (st > 0) drawSeal(st, easeOutBack(st));

        if (el < TOTAL + 400) raf = requestAnimationFrame(frame);
      };

      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }, [ink, sealBg, sealStroke, sealText]);

    const displayWidth = size;
    const displayHeight = size * (480 / 820);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          width: displayWidth,
          height: displayHeight,
          display: "block",
          filter: `drop-shadow(0 8px 14px ${dropShadow})`,
        }}
      />
    );
  },
);
MatchFoundSketchVS.displayName = "MatchFoundSketchVS";

export default MatchFoundSketchVS;
