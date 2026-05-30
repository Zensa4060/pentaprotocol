"use client";
import { useEffect, useRef } from "react";

type DrawFn = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) => void;

/**
 * Shared canvas hook for all banner components.
 *
 * Perf features:
 *  - ResizeObserver: DPR-aware canvas sizing, state reset on layout change.
 *  - IntersectionObserver: drawing is paused while the banner is outside the
 *    viewport (e.g. scrolled off in the collection screen).  This prevents
 *    20 simultaneous RAF loops when all banners are shown at once.
 *  - Page-visibility: drawing pauses when the browser tab is hidden, and
 *    resumes the moment it becomes visible again.
 *  - try/catch per frame: a single bad draw call never kills the loop.
 *  - GPU compositing: the canvas element gets will-change:transform so the
 *    browser promotes it to its own compositor layer.
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

    // GPU-promote this canvas to its own compositor layer so it never
    // triggers a layout/paint on the main thread during animation.
    cv.style.willChange = "transform";
    cv.style.transform  = "translateZ(0)";

    let t           = 0;
    let inView      = true;   // IntersectionObserver gate
    let tabVisible  = !document.hidden; // Page-visibility gate

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

    // Pause when the banner is completely out of the viewport (threshold: 0
    // means even 1px visible counts as "in view").
    const io = new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(wrap);

    // Pause when the user switches tabs / minimises the window.
    const onVis = () => { tabVisible = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    const interval = 1000 / fps;
    let last = 0;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);

      // Skip the draw work while the element is off-screen or the tab is hidden.
      if (!inView || !tabVisible) return;

      // Throttle to the requested fps so banners that run at 30fps don't
      // burn GPU time doing 60 identical frames per second on a 60Hz display.
      if (now - last < interval - 1) return;
      last = now;

      const { W, H, D } = dimRef.current;
      if (W > 1 && H > 1) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.setTransform(D, 0, 0, D, 0, 0);
          try {
            fnRef.current(ctx, t, W, H, stRef.current);
          } catch {
            // A single bad frame (e.g. zero-radius gradient) should never
            // kill the loop — just skip this frame and keep animating.
          }
        }
      }
      t += 1 / fps;
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { wrapRef, cvRef };
}
