"use client";
import { useEffect, useRef } from "react";

type DrawFn = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) => void;

/**
 * Shared canvas hook for all banner components.
 * Handles ResizeObserver, DPR scaling, RAF loop, and cleanup.
 * State object `s` is reset on every resize so draw functions can
 * re-initialise their layout-dependent data.
 */
export function useBannerCanvas(drawFn: DrawFn, fps: number = 30) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef   = useRef<HTMLCanvasElement>(null);
  const rafRef  = useRef<number>(0);
  const dimRef  = useRef({ W: 1, H: 1, D: 1 });
  const stRef   = useRef<any>({});
  const fnRef   = useRef<DrawFn>(drawFn);
  fnRef.current = drawFn;

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
      stRef.current   = {};
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
          fnRef.current(ctx, t, W, H, stRef.current);
        }
      }
      t += 1 / fps;
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { wrapRef, cvRef };
}
