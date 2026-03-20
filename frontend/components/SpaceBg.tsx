"use client";
import { useEffect, useRef } from "react";

export default function SpaceBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let W = 0, H = 0;
    let animId: number;
    let t = 0;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;

    interface Star {
      x: number; y: number; bx: number; by: number;
      r: number; a: number; parallax: number;
      twink: number; phase: number; col: string; isBright: boolean;
    }
    interface MWstar {
      x: number; y: number; r: number; a: number; col: string;
    }
    interface Nebula {
      cx: number; cy: number; rx: number; ry: number; hue: string; a: number;
    }
    interface Shooter {
      x: number; y: number; vx: number; vy: number;
      len: number; life: number; decay: number; w: number; bright: number;
    }

    let stars: Star[] = [];
    let mwStars: MWstar[] = [];
    let nebulae: Nebula[] = [];
    let shooters: Shooter[] = [];

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function hexA(hex: string, a: number): string {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }

    /* ── Build scene ── */
    function buildScene() {
      // Regular parallax stars
      stars = [];
      const N = Math.floor((W * H) / 900);
      for (let i = 0; i < N; i++) {
        const layer = Math.random();
        const isBright = layer > 0.96;
        const isMid = layer > 0.82;
        const hue = Math.random();
        const col = hue > 0.88 ? "#ffe8c0" : hue > 0.75 ? "#c8e0ff" : hue > 0.60 ? "#ffd0d0" : "#e8f0ff";
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          bx: 0, by: 0,
          r: isBright ? rnd(1.2, 2.4) : isMid ? rnd(0.5, 1.1) : rnd(0.15, 0.5),
          a: isBright ? rnd(0.7, 1) : isMid ? rnd(0.3, 0.65) : rnd(0.08, 0.28),
          parallax: isBright ? rnd(0.025, 0.055) : isMid ? rnd(0.01, 0.022) : rnd(0.003, 0.009),
          twink: rnd(0.4, 1.8), phase: Math.random() * Math.PI * 2,
          col, isBright,
        });
      }

      // Milky Way band — dense arc of tiny stars sweeping across middle of screen
      // Band centre line: gentle S-curve from left-30% to right-60% of height
      mwStars = [];
      const MW_COUNT = Math.floor(W * 3.5); // dense
      for (let i = 0; i < MW_COUNT; i++) {
        const xFrac = Math.random();
        const x = xFrac * W;
        // Band centre: arcs gently, like the reference photo
        const bandCY = H * (0.28 + 0.18 * Math.sin(xFrac * Math.PI * 1.1 - 0.3));
        const bandW  = H * (0.10 + 0.06 * Math.sin(xFrac * Math.PI)); // wider in the middle
        // Gaussian-ish distribution perpendicular to band
        const u1 = Math.random(), u2 = Math.random();
        const gauss = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
        const y = bandCY + gauss * bandW * 0.5;
        if (y < 0 || y > H) continue;

        // Stars denser toward centre of band → higher alpha there
        const distFromCentre = Math.abs(y - bandCY) / bandW;
        const density = Math.max(0, 1 - distFromCentre * 1.6);

        const r = rnd(0.08, 0.55) * (0.4 + density * 0.6);
        const a = rnd(0.04, 0.28) * density;
        if (a < 0.03) continue;

        const hv = Math.random();
        const col = hv > 0.7 ? "#d0e8ff"   // blue-white
                  : hv > 0.4 ? "#ffe8d0"   // warm
                  : "#f0f4ff";             // white
        mwStars.push({ x, y, r, a, col });
      }

      nebulae = [
        { cx: W * 0.20, cy: H * 0.28, rx: W * 0.32, ry: H * 0.22, hue: "20,40,120",  a: 0.16 },
        { cx: W * 0.70, cy: H * 0.22, rx: W * 0.28, ry: H * 0.18, hue: "10,20,100",  a: 0.12 },
        { cx: W * 0.50, cy: H * 0.30, rx: W * 0.50, ry: H * 0.20, hue: "5,10,60",    a: 0.09 },
        { cx: W * 0.88, cy: H * 0.35, rx: W * 0.18, ry: H * 0.14, hue: "40,10,90",   a: 0.08 },
        { cx: W * 0.08, cy: H * 0.45, rx: W * 0.20, ry: H * 0.16, hue: "0,30,80",    a: 0.07 },
      ];
    }

    function spawnShooter() {
      const fromLeft = Math.random() > 0.5;
      shooters.push({
        x: fromLeft ? rnd(-200, W * 0.3) : rnd(W * 0.7, W + 200),
        y: rnd(0, H * 0.45),
        vx: fromLeft ? rnd(8, 16) : rnd(-16, -8),
        vy: rnd(2, 6),
        len: rnd(100, 280),
        life: 1, decay: rnd(0.008, 0.018),
        w: rnd(0.8, 2.0), bright: rnd(0.7, 1.0),
      });
    }

    /* ── Draw passes ── */

    function drawBase() {
      // Deep space — rich blue-black gradient like the reference image
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0,    "#0a1a3a");
      bg.addColorStop(0.18, "#071528");
      bg.addColorStop(0.45, "#050e1e");
      bg.addColorStop(0.72, "#030918");
      bg.addColorStop(1,    "#020612");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    function drawMilkyWay() {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // 1. Glowing dust band — multiple layered soft gradients
      const bandLayers = [
        // [xFrac, yCentFrac, rxFrac, ryFrac, r, g, b, alpha]
        [0.5, 0.26, 0.70, 0.10,  30,  80, 200, 0.055],
        [0.5, 0.27, 0.60, 0.07,  50, 110, 220, 0.065],
        [0.5, 0.25, 0.55, 0.055, 20,  60, 180, 0.045],
        [0.5, 0.28, 0.42, 0.04,  80, 140, 255, 0.035],
        // warm core glow
        [0.48, 0.26, 0.28, 0.035, 180, 160, 100, 0.025],
      ];

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

      // 2. Dense Milky Way micro-stars
      for (const s of mwStars) {
        const tw = 0.85 + 0.15 * Math.sin(t * rnd(0.3, 0.8) + s.x * 0.01);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 3. Extra bright cluster nodes along the band
      const clusters = [
        { xf: 0.18, yf: 0.24, r: W * 0.04 },
        { xf: 0.38, yf: 0.27, r: W * 0.035 },
        { xf: 0.58, yf: 0.25, r: W * 0.045 },
        { xf: 0.76, yf: 0.27, r: W * 0.03  },
      ];
      for (const c of clusters) {
        const cg = ctx.createRadialGradient(c.xf*W, c.yf*H, 0, c.xf*W, c.yf*H, c.r);
        cg.addColorStop(0,   "rgba(160,200,255,0.06)");
        cg.addColorStop(0.5, "rgba(100,160,255,0.025)");
        cg.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(c.xf*W, c.yf*H, c.r, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }

    function drawNebulae() {
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

    function drawStars() {
      const nx = mx / W;
      const ny = my / H;
      for (const s of stars) {
        const targetX = s.x + (nx - 0.5) * s.parallax * W * 0.35;
        const targetY = s.y + (ny - 0.5) * s.parallax * H * 0.35;
        s.bx += (targetX - s.x - s.bx) * 0.12;
        s.by += (targetY - s.y - s.by) * 0.12;
        const px = s.x + s.bx;
        const py = s.y + s.by;
        const tw = Math.sin(t * s.twink + s.phase);
        const alpha = s.a * (0.7 + 0.3 * tw);

        if (s.isBright) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 8);
          glow.addColorStop(0,   hexA(s.col, alpha * 0.9));
          glow.addColorStop(0.3, hexA(s.col, alpha * 0.15));
          glow.addColorStop(1,   "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(px, py, s.r * 8, 0, Math.PI * 2); ctx.fill();
          const cross = s.r * 12 * alpha;
          ctx.globalAlpha = alpha * 0.18;
          ctx.strokeStyle = s.col; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(px - cross, py); ctx.lineTo(px + cross, py); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px, py - cross * 1.5); ctx.lineTo(px, py + cross * 1.5); ctx.stroke();
          ctx.restore();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function drawShooters() {
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        const tx = s.x + s.vx, ty = s.y + s.vy;
        const ang = Math.atan2(s.vy, s.vx);
        const tailX = s.x - Math.cos(ang) * s.len;
        const tailY = s.y - Math.sin(ang) * s.len;

        ctx.save(); ctx.globalCompositeOperation = "screen";
        const g = ctx.createLinearGradient(tailX, tailY, tx, ty);
        g.addColorStop(0,    "rgba(200,225,255,0)");
        g.addColorStop(0.55, `rgba(210,230,255,${(s.life * s.bright * 0.25).toFixed(3)})`);
        g.addColorStop(0.82, `rgba(240,245,255,${(s.life * s.bright * 0.6).toFixed(3)})`);
        g.addColorStop(1,    `rgba(255,255,255,${(s.life * s.bright).toFixed(3)})`);
        ctx.strokeStyle = g; ctx.lineWidth = s.w * s.life; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tx, ty); ctx.stroke();

        const hg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 8 * s.life);
        hg.addColorStop(0,   `rgba(255,255,255,${(s.life * 0.9).toFixed(3)})`);
        hg.addColorStop(0.4, `rgba(200,225,255,${(s.life * 0.25).toFixed(3)})`);
        hg.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(tx, ty, 8 * s.life, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        s.x = tx; s.y = ty; s.life -= s.decay;
        if (s.life <= 0 || s.x < -400 || s.x > W + 400 || s.y > H + 200) shooters.splice(i, 1);
      }
    }

    /* ── Main loop ── */
    function frame() {
      t += 0.006;

      drawBase();
      drawMilkyWay();
      drawNebulae();
      drawStars();
      drawShooters();

      if (Math.random() < 0.005) spawnShooter();

      animId = requestAnimationFrame(frame);
    }

    /* ── Events ── */
    const onMove  = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onLeave = () => { mx = W / 2; my = H / 2; };
    const onResize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildScene();
    };

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize",     onResize);

    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildScene();
    frame();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize",     onResize);
    };
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