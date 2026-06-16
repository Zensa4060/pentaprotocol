"use client";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useId,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────
export type CoinTossProps = {
  revealed?: boolean;
  result?: "PENTA" | "PROTO" | null;
  pendingForSpin?: "PENTA" | "PROTO" | null;
  coinDiam?: number;
  compact?: boolean;
  autostart?: boolean;
  enableAmbient?: boolean;
  showOutcomeText?: boolean;
  p1Name?: string;
  p2Name?: string;
  winCol?: string;
};

export type PreviewProps = { coinDiam?: number; compact?: boolean };

type Phase =
  | "idle"
  | "rising"
  | "spinning"
  | "falling"
  | "bouncing"
  | "settling"
  | "done";

// ─────────────────────────────────────────────────────────────────────────────
// Shared physics hook
// ─────────────────────────────────────────────────────────────────────────────
type ParticleEmitter = (
  cx: number,
  cy: number,
  phase: Phase,
  canvas: HTMLCanvasElement
) => void;

// Physics constants
const INITIAL_VEL_Y = -30;
const GRAVITY = 0.33;
const COR = 0.58;
const MIN_BOUNCE_VEL = 2.2;

function useCoinTossPhysics(
  result: "PENTA" | "PROTO" | null | undefined,
  pendingForSpin: "PENTA" | "PROTO" | null | undefined,
  coinDiam: number,
  autostart: boolean,
  enableAmbient: boolean,
  particleEmitter: ParticleEmitter,
  onBurst?: (cx: number, cy: number) => void,
  onEmit?: (cx: number, cy: number, count: number, pow: number) => void,
  compact?: boolean,
) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [side, setSide] = useState<"PENTA" | "PROTO">("PENTA");
  const [yOff, setYOff] = useState(0);
  const [scl, setScl] = useState(1);
  const [shake, setShake] = useState(false);
  const [sw, setSw] = useState(false);
  const [glow, setGlow] = useState(0.3);
  const [spinKey, setSpinKey] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const forceDoneRef = useRef(false);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<Phase>("idle");

  const particleW = Math.round(coinDiam * 1.8);
  const particleH = Math.round(coinDiam * 1.8);
  const particleCX = particleW / 2;
  const particleCY = particleH / 2;

  // Kick off spin
  useEffect(() => {
    const target = result ?? pendingForSpin;
    if (!target || !autostart) return;
    if (phaseRef.current !== "idle") return;

    setSide(target);
    setSpinKey((k) => k + 1);
    phaseRef.current = "rising";
    setPhase("rising");
    forceDoneRef.current = false;

    const CX = particleCX;
    const CY = particleCY;

    let posY = 0;
    let velY = INITIAL_VEL_Y;
    let bounceN = 0;
    let settled = false;
    let settleTime = 0;
    let lastPaint = 0;

    const step = (now: number) => {
      const rawDelta = lastPaint > 0 ? now - lastPaint : 16.667;
      const dt = Math.min(rawDelta, 100) / 16.667;
      lastPaint = now;

      if (forceDoneRef.current && !settled) {
        settled = true;
        settleTime = now;
        velY = 0;
        posY = 0;
        setYOff(0);
        setGlow(0);
        phaseRef.current = "done";
        setPhase("done");
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (settled) {
        const st = Math.min(1, (now - settleTime) / 500);
        const wobble = Math.sin(st * Math.PI * 4) * (1 - st) * 0.07;
        setScl(1 + wobble);
        if (st >= 1) {
          setScl(1);
          setPhase("done");
          phaseRef.current = "done";
          if (onEmit) onEmit(CX, CY - 25, compact ? 6 : 12, 0.35);
          rafRef.current = 0;
          return;
        }
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      velY += GRAVITY * dt;
      posY += velY * dt;

      const heightFrac = Math.min(1, Math.abs(posY) / 280);
      const nextScl = Math.max(0.08, 1 - heightFrac * 0.92);
      const nextGlow = Math.max(0.03, 0.42 * (1 - heightFrac * 0.88));

      // Kick off spinning phase display once rising
      if (phaseRef.current === "rising" && posY <= -20) {
        phaseRef.current = "spinning";
        setPhase("spinning");
        const canvas = canvasRef.current;
        if (canvas) particleEmitter(CX, CY, "spinning", canvas);
      }

      if (posY >= 0 && velY > 0) {
        posY = 0;
        const impactVel = Math.abs(velY);
        const nextVel = impactVel * COR;
        if (nextVel < MIN_BOUNCE_VEL) {
          // Settle
          settled = true;
          settleTime = now;
          velY = 0;
          posY = 0;
          setGlow(0);
        } else {
          velY = -nextVel;
          const impactPow = Math.min(impactVel / 12, 1.4);
          if (bounceN === 0) {
            if (onBurst) onBurst(CX, CY);
            if (onEmit) onEmit(CX, CY, compact ? 8 : 18, impactPow * 1.2);
            setShake(true);
            setSw(true);
            setTimeout(() => setShake(false), 380);
            setTimeout(() => setSw(false), 650);
          } else {
            if (onEmit) onEmit(CX, CY, compact ? 3 : 6, impactPow * 0.7);
          }
          bounceN++;
        }
      }

      setScl(nextScl);
      setGlow(nextGlow);
      setYOff(posY);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, pendingForSpin, autostart, particleCX, particleCY, compact]);

  // forceDone when result changes
  useEffect(() => {
    if (result && phaseRef.current !== "idle" && phaseRef.current !== "done") {
      forceDoneRef.current = true;
    }
  }, [result]);

  // Suppress unused variable warnings for hook params used only for init
  void enableAmbient;

  return {
    phase,
    side,
    yOff,
    scl,
    shake,
    sw,
    glow,
    spinKey,
    canvasRef,
    particleW,
    particleH,
    particleCX,
    particleCY,
    forceDoneRef,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle system helpers
// ─────────────────────────────────────────────────────────────────────────────
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  sat: number;
  lit: number;
  alpha: number;
  decay: number;
  gravity: number;
  type: string;
};

function makeParticleSystem(maxCount = 300) {
  const particles: Particle[] = [];
  let rafId = 0;

  function emit(
    cx: number,
    cy: number,
    count: number,
    factory: () => Particle
  ) {
    for (let i = 0; i < count; i++) {
      if (particles.length < maxCount) {
        const p = factory();
        p.x = cx + (Math.random() - 0.5) * 10;
        p.y = cy + (Math.random() - 0.5) * 10;
        particles.push(p);
      }
    }
  }

  function step(
    canvas: HTMLCanvasElement,
    ambientFn?: (cx: number, cy: number) => void,
    cx = 0,
    cy = 0
  ) {
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (ambientFn) ambientFn(cx, cy);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = `hsl(${p.hue},${p.sat}%,${p.lit}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function start(canvas: HTMLCanvasElement, cx: number, cy: number, ambientFn?: (cx: number, cy: number) => void) {
    stop();
    const loop = () => {
      step(canvas, ambientFn, cx, cy);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(rafId);
  }

  function clear() {
    particles.length = 0;
  }

  return { emit, start, stop, clear, particles };
}

