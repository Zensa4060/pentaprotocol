"use client";
import { useEffect, useRef } from "react";

type DrawFn = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) => void;

/**
 * Shared canvas hook for all banner components.
 *
 * Perf features:
 *  - Adaptive refresh rate: runs at the device's native RAF rate (60/90/120/144 Hz).
 *    All per-frame movement values are multiplied by `s._dt` — a delta-time factor
 *    normalised to 60fps (1.0 at 60fps, 0.5 at 120fps, 0.667 at 90fps).
 *    Draw functions access it via `(s._dt ?? 1)` so legacy banners are unaffected.
 *  - ResizeObserver: DPR-aware canvas sizing, state reset on layout change.
 *  - IntersectionObserver: drawing is paused while the banner is outside the
 *    viewport (e.g. scrolled off in the collection screen).  This prevents
 *    20 simultaneous RAF loops when all banners are shown at once.
 *  - Page-visibility: drawing pauses when the browser tab is hidden, and
 *    resumes the moment it becomes visible again.
 *  - try/catch per frame: a single bad draw call never kills the loop.
 *
 * NOTE: We intentionally do NOT use translateZ(0) / will-change:transform on
 * the canvas.  Promoting the canvas to a GPU compositor layer causes
 * colour-space shifts on Windows (sRGB vs display-P3 compositing) which makes
 * banner colours appear washed-out/dim against the semi-transparent overlays
 * used in MatchSidebar and other containers.
 */
export function useBannerCanvas(drawFn: DrawFn, _fps: number = 60) {
  // _fps is kept for API compatibility but no longer used for throttling.
  // We run at the native device refresh rate instead.
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

    let t          = 0;
    let last       = 0;
    let inView     = true;
    let tabVisible = !document.hidden;

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
      last            = 0; // reset last so dt doesn't spike on resize
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVis = () => {
      tabVisible = !document.hidden;
      if (tabVisible) last = 0; // avoid dt spike after tab becomes visible
    };
    document.addEventListener("visibilitychange", onVis);

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);

      if (!inView || !tabVisible) {
        last = 0;
        return;
      }

      // Delta-time: clamped to 100ms max to survive browser throttling /
      // tab backgrounding. Normalised so 1.0 == one 60fps frame (16.667ms).
      const deltaMs = last > 0 ? Math.min(now - last, 100) : 16.667;
      last = now;
      // Expose dt to draw functions. They should scale per-frame movement
      // values by `(s._dt ?? 1)` to be frame-rate independent.
      stRef.current._dt = deltaMs / 16.667;

      const { W, H, D } = dimRef.current;
      if (W > 1 && H > 1) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.setTransform(D, 0, 0, D, 0, 0);
          try {
            fnRef.current(ctx, t, W, H, stRef.current);
          } catch {
            // A bad frame (e.g. zero-radius gradient) should never kill
            // the loop — just skip and keep animating.
          }
        }
      }
      // Advance time in real seconds so time-based animation (sin/cos) stays
      // at the right speed regardless of display refresh rate.
      t += deltaMs / 1000;
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
