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

// ─────────────────────────────────────────────────────────────────────────────
// COIN 1: SOLAR FLARE
// ─────────────────────────────────────────────────────────────────────────────

function SolarFlarePentaFace({ gid }: { gid: string }) {
  const bgId = `${gid}-sf-bg`;
  const hotspotId = `${gid}-sf-hs`;
  const discId = `${gid}-sf-disc`;
  const pupilId = `${gid}-sf-pupil`;
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5c2000" />
          <stop offset="35%" stopColor="#3a1400" />
          <stop offset="70%" stopColor="#1a0800" />
          <stop offset="100%" stopColor="#0a0200" />
        </radialGradient>
        <radialGradient id={hotspotId} cx="60%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#e87800" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#e87800" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={discId} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fff8e0" />
          <stop offset="30%" stopColor="#ffd020" />
          <stop offset="65%" stopColor="#ff8800" />
          <stop offset="100%" stopColor="#cc4400" />
        </radialGradient>
        <radialGradient id={pupilId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff8e0" />
          <stop offset="40%" stopColor="#ffe060" />
          <stop offset="100%" stopColor="#ff8800" />
        </radialGradient>
        <clipPath id={`${gid}-sf-clip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="100" fill={`url(#${hotspotId})`} />

      {/* Rim rings */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#c8820a" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#f0a020" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#a06010" strokeWidth="0.8" opacity="0.4" />

      {/* Solar rays */}
      <g transform="translate(100,100)" clipPath={`url(#${gid}-sf-clip)`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <path d="M -8,50 L 0,90 L 8,50 Z" fill="#f0c030" stroke="#c08020" strokeWidth="0.5" />
            </g>
          ))}
          {[45, 135, 225, 315].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <path d="M -6,50 L 0,78 L 6,50 Z" fill="#e89020" opacity="0.85" />
            </g>
          ))}
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <path d="M -4,50 L 0,65 L 4,50 Z" fill="#cc6010" opacity="0.65" />
            </g>
          ))}
        </g>
      </g>

      {/* Central solar disc */}
      <circle cx="100" cy="100" r="46" fill={`url(#${discId})`} stroke="#e89020" strokeWidth="2" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="#ffe060" strokeWidth="1.5" opacity="0.6" />

      {/* Sunspots */}
      <circle cx="92" cy="92" r="2.5" fill="#8a3000" opacity="0.4" />
      <circle cx="112" cy="88" r="2" fill="#8a3000" opacity="0.3" />
      <circle cx="105" cy="108" r="3" fill="#8a3000" opacity="0.35" />
      <circle cx="88" cy="110" r="2.2" fill="#8a3000" opacity="0.3" />
      <circle cx="116" cy="104" r="2.8" fill="#8a3000" opacity="0.45" />
      <circle cx="97" cy="80" r="2" fill="#8a3000" opacity="0.3" />
      <circle cx="108" cy="118" r="1.8" fill="#8a3000" opacity="0.35" />
      <circle cx="84" cy="98" r="2.3" fill="#8a3000" opacity="0.3" />

      {/* Surface cracks */}
      <path d="M 100,100 L 112,88" stroke="#a04000" strokeWidth="0.6" opacity="0.25" />
      <path d="M 100,100 L 88,115" stroke="#a04000" strokeWidth="0.6" opacity="0.2" />
      <path d="M 100,100 L 118,108" stroke="#a04000" strokeWidth="0.6" opacity="0.22" />

      {/* Face brow arches */}
      <path d="M 82,88 Q 88,82 94,88" stroke="#8a2000" strokeWidth="2" fill="none" />
      <path d="M 106,88 Q 112,82 118,88" stroke="#8a2000" strokeWidth="2" fill="none" />

      {/* Eye sockets */}
      <ellipse cx="88" cy="96" rx="7" ry="8" fill="#8a2000" />
      <ellipse cx="112" cy="96" rx="7" ry="8" fill="#8a2000" />

      {/* Glowing pupils */}
      <ellipse cx="88" cy="96" rx="4.5" ry="5" fill={`url(#${pupilId})`} />
      <ellipse cx="112" cy="96" rx="4.5" ry="5" fill={`url(#${pupilId})`} />

      {/* Nose */}
      <path d="M 100,102 L 96,112 L 104,112 Z" fill="#8a2000" />

      {/* Smile */}
      <path d="M 84,118 Q 100,130 116,118" stroke="#c05000" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SolarFlareProtoFace({ gid }: { gid: string }) {
  const bgId = `${gid}-sf-proto-bg`;
  const moonId = `${gid}-sf-proto-moon`;
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0800" />
          <stop offset="50%" stopColor="#050400" />
          <stop offset="100%" stopColor="#010100" />
        </radialGradient>
        <radialGradient id={moonId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#0c0c10" />
          <stop offset="100%" stopColor="#040408" />
        </radialGradient>
        <filter id={`${gid}-sf-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />

      {/* Rim rings */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#c8820a" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#f0a020" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#a06010" strokeWidth="0.8" opacity="0.4" />

      {/* Corona outer glows */}
      <circle cx="100" cy="100" r="68" fill="none" stroke="#ff8800" strokeWidth="2" opacity="0.12" filter={`url(#${gid}-sf-blur)`} />
      <circle cx="100" cy="100" r="62" fill="none" stroke="#ffcc44" strokeWidth="2.5" opacity="0.22" filter={`url(#${gid}-sf-blur)`} />
      <circle cx="100" cy="100" r="57" fill="none" stroke="#ffe090" strokeWidth="3" opacity="0.5" filter={`url(#${gid}-sf-blur)`} />
      <circle cx="100" cy="100" r="53" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.95">
        <animate attributeName="opacity" values="0.95;0.7;0.95" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Corona spikes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const len = i % 2 === 0 ? 22 : 14;
        const x2 = 100 + Math.cos(rad) * (52 + len);
        const y2 = 100 + Math.sin(rad) * (52 + len);
        const x1l = 100 + Math.cos(rad + 0.15) * 52;
        const y1l = 100 + Math.sin(rad + 0.15) * 52;
        const x1r = 100 + Math.cos(rad - 0.15) * 52;
        const y1r = 100 + Math.sin(rad - 0.15) * 52;
        return (
          <path
            key={deg}
            d={`M ${x1l},${y1l} L ${x2},${y2} L ${x1r},${y1r} Z`}
            fill="#ffd040"
            opacity={i % 2 === 0 ? 0.9 : 0.7}
          />
        );
      })}

      {/* Moon disc */}
      <circle cx="100" cy="100" r="49" fill={`url(#${moonId})`} stroke="#1a1a28" strokeWidth="1" />

      {/* Solar prominences */}
      <path d="M 100,51 C 80,28 70,20 78,12 C 86,4 100,10 100,24" fill="none" stroke="#ff6600" strokeWidth="3.5" strokeLinecap="round">
        <animate attributeName="opacity" values="0.7;1;0.5;0.9;0.7" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M 148,100 C 166,82 175,75 178,84 C 181,93 172,104 160,100" fill="none" stroke="#ff4400" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="opacity" values="0.6;0.9;0.4;0.8;0.6" dur="5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function createSolarFlareParticles() {
  const sys = makeParticleSystem(350);

  function emitBurst(cx: number, cy: number) {
    sys.emit(cx, cy, 25, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      size: 2 + Math.random() * 2,
      hue: 20 + Math.random() * 25,
      sat: 100, lit: 65,
      alpha: 0.9,
      decay: 0.018,
      gravity: -0.02,
      type: "ember",
    }));
    sys.emit(cx, cy, 20, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5 - 3,
      size: 4 + Math.random() * 4,
      hue: 15 + Math.random() * 20,
      sat: 100, lit: 55,
      alpha: 0.75,
      decay: 0.012,
      gravity: 0.01,
      type: "flame",
    }));
    sys.emit(cx, cy, 15, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 1,
      size: 1 + Math.random() * 1,
      hue: 45 + Math.random() * 15,
      sat: 90, lit: 80,
      alpha: 1.0,
      decay: 0.04,
      gravity: 0.03,
      type: "spark",
    }));
  }

  function ambientEmit(cx: number, cy: number) {
    if (Math.random() < 0.12) {
      sys.emit(cx, cy, 1, () => ({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.5 - Math.random() * 1.2,
        size: 1.5 + Math.random() * 2,
        hue: 25 + Math.random() * 20,
        sat: 100, lit: 65,
        alpha: 0.7,
        decay: 0.01,
        gravity: -0.015,
        type: "ambient-ember",
      }));
    }
  }

  return { sys, emitBurst, ambientEmit };
}

export function SolarFlareCoinToss({
  revealed: _revealed,
  result,
  pendingForSpin,
  coinDiam = 240,
  compact = false,
  autostart = true,
  enableAmbient = false,
  showOutcomeText = false,
  p1Name: _p1Name,
  p2Name: _p2Name,
  winCol: _winCol,
}: CoinTossProps) {
  const gid = useId().replace(/:/g, "");
  const sfRef = useRef(createSolarFlareParticles());

  const particleEmitter = useCallback(
    (cx: number, cy: number, p: Phase, _canvas: HTMLCanvasElement) => {
      if (p === "bouncing" || p === "spinning") {
        sfRef.current.emitBurst(cx, cy);
      }
    },
    []
  );

  const handleBurst = useCallback((cx: number, cy: number) => {
    sfRef.current.emitBurst(cx, cy);
  }, []);

  const handleEmit = useCallback((cx: number, cy: number, count: number, pow: number) => {
    sfRef.current.sys.emit(cx, cy, count, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 8 * pow,
      vy: (Math.random() - 0.5) * 8 * pow - 2,
      size: 2 + Math.random() * 2,
      hue: 20 + Math.random() * 25,
      sat: 100, lit: 65,
      alpha: 0.9,
      decay: 0.018,
      gravity: -0.02,
      type: "ember",
    }));
  }, []);

  const {
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
  } = useCoinTossPhysics(
    result,
    pendingForSpin,
    coinDiam,
    autostart,
    enableAmbient,
    particleEmitter,
    handleBurst,
    handleEmit,
    compact,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { sys, ambientEmit } = sfRef.current;
    sys.start(canvas, particleCX, particleCY, enableAmbient ? ambientEmit : undefined);
    return () => sys.stop();
  }, [canvasRef, particleCX, particleCY, enableAmbient]);

  const spinDeg = side === "PENTA" ? 5040 : 5220;
  const outcomeLabel = side === "PENTA" ? "THE SUN KING" : "THE ECLIPSE";
  const outcomeCol = side === "PENTA" ? "#ffd020" : "#ff8822";
  const glowStyle = `drop-shadow(0 0 ${glow * 30}px rgba(255,140,0,${glow})) drop-shadow(0 0 ${glow * 60}px rgba(255,60,0,${glow * 0.4}))`;

  return (
    <div
      className="sf-wrapper"
      style={{
        position: "relative",
        width: particleW,
        height: particleH,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: particleH * 0.12,
          left: "50%",
          transform: `translateX(-50%) scaleY(0.3)`,
          width: coinDiam * scl,
          height: coinDiam * scl * 0.3,
          background: "radial-gradient(ellipse, rgba(255,120,0,.4) 0%, transparent 70%)",
          borderRadius: "50%",
          opacity: 0.5 + glow * 0.3,
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        width={particleW}
        height={particleH}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      />
      {sw && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(1.5)`,
            width: coinDiam,
            height: coinDiam,
            borderRadius: "50%",
            border: `3px solid rgba(255,160,0,0.25)`,
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        key={`sf-coin-${spinKey}`}
        style={{
          position: "relative",
          width: coinDiam,
          height: coinDiam,
          transform: `translateY(${yOff}px) scale(${scl})`,
          filter: glowStyle,
          perspective: 800,
          animation:
            spinKey > 0
              ? `sf-spin-${spinKey} 5.15s cubic-bezier(0.05, 0.7, 0.98, 1) forwards`
              : undefined,
        }}
      >
        <style>{`
          @keyframes sf-spin-${spinKey} {
            from { transform: translateY(${yOff}px) scale(${scl}) rotateY(0deg); }
            to   { transform: translateY(${yOff}px) scale(${scl}) rotateY(${spinDeg}deg); }
          }
        `}</style>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
          {side === "PENTA" ? (
            <SolarFlarePentaFace gid={gid} />
          ) : (
            <SolarFlareProtoFace gid={gid} />
          )}
        </div>
      </div>
      {showOutcomeText && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            color: outcomeCol,
            fontFamily: "serif",
            fontSize: compact ? 12 : 16,
            fontWeight: 700,
            letterSpacing: 2,
            textShadow: `0 0 12px ${outcomeCol}`,
            whiteSpace: "nowrap",
          }}
        >
          {outcomeLabel}
        </div>
      )}
    </div>
  );
}

export function SolarFlarePreview({ coinDiam = 120, compact = true }: PreviewProps) {
  const [cycle, setCycle] = useState(0);
  const [side, setSide] = useState<"PENTA" | "PROTO">("PENTA");
  useEffect(() => {
    const id = setInterval(() => {
      setCycle((c) => c + 1);
      setSide((s) => (s === "PENTA" ? "PROTO" : "PENTA"));
    }, 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <SolarFlareCoinToss
      key={cycle}
      coinDiam={coinDiam}
      compact={compact}
      result={side}
      autostart
      showOutcomeText
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COIN 2: VOID RIFT
// ─────────────────────────────────────────────────────────────────────────────

function VoidRiftPentaFace({ gid }: { gid: string }) {
  const bgId = `${gid}-vr-bg`;
  const coreId = `${gid}-vr-core`;
  const core2Id = `${gid}-vr-core2`;

  const stars = [
    { x: 32, y: 45, r: 1.2, c: "#fff", o: 0.8, d: "2.1s", b: "0s" },
    { x: 58, y: 28, r: 0.8, c: "#aaccff", o: 0.6, d: "3.5s", b: "0.4s" },
    { x: 75, y: 40, r: 1.5, c: "#fff", o: 0.9, d: "2.8s", b: "1.1s" },
    { x: 142, y: 35, r: 1.0, c: "#ffddcc", o: 0.7, d: "4.0s", b: "0.7s" },
    { x: 165, y: 55, r: 1.3, c: "#fff", o: 0.85, d: "3.2s", b: "2.0s" },
    { x: 155, y: 75, r: 0.7, c: "#aaccff", o: 0.5, d: "2.5s", b: "0.3s" },
    { x: 170, y: 42, r: 1.1, c: "#fff", o: 0.75, d: "3.8s", b: "1.5s" },
    { x: 25, y: 70, r: 0.9, c: "#fff", o: 0.65, d: "2.3s", b: "0.9s" },
    { x: 40, y: 130, r: 1.4, c: "#aaccff", o: 0.9, d: "4.2s", b: "2.3s" },
    { x: 28, y: 155, r: 0.6, c: "#fff", o: 0.5, d: "3.0s", b: "1.7s" },
    { x: 50, y: 168, r: 1.2, c: "#ffddcc", o: 0.8, d: "2.7s", b: "0.5s" },
    { x: 35, y: 90, r: 0.8, c: "#fff", o: 0.6, d: "3.5s", b: "2.8s" },
    { x: 160, y: 130, r: 1.0, c: "#aaccff", o: 0.7, d: "2.9s", b: "1.2s" },
    { x: 172, y: 155, r: 1.3, c: "#fff", o: 0.9, d: "4.1s", b: "0.6s" },
    { x: 148, y: 168, r: 0.7, c: "#ffddcc", o: 0.55, d: "3.3s", b: "1.9s" },
    { x: 175, y: 110, r: 1.1, c: "#fff", o: 0.8, d: "2.6s", b: "2.5s" },
    { x: 60, y: 155, r: 0.9, c: "#aaccff", o: 0.65, d: "3.7s", b: "0.2s" },
    { x: 45, y: 50, r: 1.6, c: "#fff", o: 0.95, d: "2.4s", b: "1.4s" },
    { x: 150, y: 45, r: 0.8, c: "#fff", o: 0.7, d: "3.9s", b: "2.1s" },
    { x: 130, y: 28, r: 1.2, c: "#aaccff", o: 0.85, d: "2.2s", b: "0.8s" },
    { x: 110, y: 18, r: 0.9, c: "#ffddcc", o: 0.6, d: "4.3s", b: "1.6s" },
    { x: 90, y: 22, r: 1.0, c: "#fff", o: 0.75, d: "3.1s", b: "2.7s" },
    { x: 70, y: 175, r: 1.3, c: "#fff", o: 0.9, d: "2.8s", b: "0.1s" },
    { x: 100, y: 178, r: 0.7, c: "#aaccff", o: 0.5, d: "3.6s", b: "1.3s" },
    { x: 130, y: 172, r: 1.1, c: "#fff", o: 0.8, d: "2.5s", b: "2.2s" },
    { x: 18, y: 110, r: 0.8, c: "#ffddcc", o: 0.6, d: "4.0s", b: "0.4s" },
    { x: 22, y: 80, r: 1.4, c: "#fff", o: 0.85, d: "3.2s", b: "1.8s" },
    { x: 182, y: 80, r: 0.9, c: "#aaccff", o: 0.7, d: "2.7s", b: "2.9s" },
    { x: 178, y: 95, r: 1.2, c: "#fff", o: 0.95, d: "3.4s", b: "0.7s" },
    { x: 178, y: 125, r: 0.6, c: "#fff", o: 0.5, d: "2.9s", b: "1.0s" },
    { x: 48, y: 80, r: 1.0, c: "#aaccff", o: 0.75, d: "3.8s", b: "2.4s" },
    { x: 155, y: 95, r: 1.3, c: "#ffddcc", o: 0.88, d: "2.3s", b: "0.3s" },
    { x: 68, y: 45, r: 0.7, c: "#fff", o: 0.6, d: "4.4s", b: "1.5s" },
    { x: 55, y: 140, r: 1.1, c: "#fff", o: 0.8, d: "3.0s", b: "2.6s" },
    { x: 140, y: 155, r: 0.8, c: "#aaccff", o: 0.65, d: "3.5s", b: "0.9s" },
    { x: 165, y: 170, r: 1.4, c: "#fff", o: 0.92, d: "2.6s", b: "1.7s" },
    { x: 35, y: 170, r: 0.9, c: "#ffddcc", o: 0.58, d: "3.9s", b: "0.5s" },
    { x: 120, y: 175, r: 1.0, c: "#fff", o: 0.74, d: "2.4s", b: "2.0s" },
    { x: 80, y: 38, r: 1.2, c: "#aaccff", o: 0.87, d: "4.1s", b: "1.2s" },
    { x: 180, y: 150, r: 0.7, c: "#fff", o: 0.55, d: "3.3s", b: "2.8s" },
  ];

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#100830" />
          <stop offset="40%" stopColor="#080420" />
          <stop offset="75%" stopColor="#020110" />
          <stop offset="100%" stopColor="#010008" />
        </radialGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#eeddff" />
          <stop offset="60%" stopColor="#bb88ff" />
          <stop offset="100%" stopColor="#330066" />
        </radialGradient>
        <radialGradient id={core2Id} cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffffdd" />
        </radialGradient>
        <filter id={`${gid}-vr-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <clipPath id={`${gid}-vr-clip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />

      {/* Rim */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#2a0860" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#6622cc" strokeWidth="1.5" opacity="0.8" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#4400aa" strokeWidth="0.8" opacity="0.4" />

      {/* Stars */}
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.o}>
          {i % 3 === 0 && (
            <animate
              attributeName="opacity"
              values={`${s.o};${s.o * 0.25};${Math.min(s.o * 1.1, 1)};${s.o * 0.5};${s.o}`}
              dur={s.d}
              begin={s.b}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}

      {/* Galaxy arms */}
      <g clipPath={`url(#${gid}-vr-clip)`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="30s" repeatCount="indefinite" />
          <path d="M 100,100 C 105,80 120,65 140,58 C 158,52 172,60 168,74 C 164,88 150,92 135,96 C 118,100 105,104 100,100" stroke="#9966ff" strokeWidth="2" fill="none" opacity="0.7" filter={`url(#${gid}-vr-blur)`} />
          <path d="M 100,100 C 95,120 80,135 60,142 C 42,148 28,140 32,126 C 36,112 50,108 65,104 C 82,100 95,96 100,100" stroke="#7744cc" strokeWidth="1.8" fill="none" opacity="0.55" filter={`url(#${gid}-vr-blur)`} />
          <path d="M 100,100 C 120,95 140,85 155,70 C 165,60 162,50 152,55" stroke="#5533aa" strokeWidth="1" fill="none" opacity="0.3" filter={`url(#${gid}-vr-blur)`} />
          <path d="M 100,100 C 80,105 60,115 45,130 C 35,140 38,150 48,145" stroke="#5533aa" strokeWidth="1" fill="none" opacity="0.3" filter={`url(#${gid}-vr-blur)`} />
        </g>
      </g>

      {/* Nebula clouds */}
      <ellipse cx="130" cy="75" rx="22" ry="14" fill="#7744cc" opacity="0.07" filter={`url(#${gid}-vr-blur)`} />
      <ellipse cx="68" cy="125" rx="18" ry="12" fill="#4422aa" opacity="0.09" filter={`url(#${gid}-vr-blur)`} />
      <ellipse cx="140" cy="130" rx="16" ry="10" fill="#8855dd" opacity="0.06" filter={`url(#${gid}-vr-blur)`} />

      {/* Galactic core */}
      <circle cx="100" cy="100" r="22" fill={`url(#${coreId})`}>
        <animate attributeName="r" values="22;24;22;20;22" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="100" r="14" fill={`url(#${core2Id})`} />
      <circle cx="100" cy="100" r="7" fill="#ffffff" />

      {/* Lens flare lines */}
      <line x1="85" y1="100" x2="115" y2="100" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      <line x1="100" y1="85" x2="100" y2="115" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      <line x1="89" y1="89" x2="111" y2="111" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
      <line x1="111" y1="89" x2="89" y2="111" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

function VoidRiftProtoFace({ gid }: { gid: string }) {
  const bgId = `${gid}-vr-proto-bg`;
  const singId = `${gid}-vr-sing`;
  const evId = `${gid}-vr-ev`;

  const discColors = [
    "#ff8800", "#ff6600", "#dd4400", "#aa2200",
    "#880066", "#6600cc", "#4400ff", "#2244ff",
    "#44aaff", "#88ccff", "#ffcc44", "#ff9900",
  ];

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#080418" />
          <stop offset="50%" stopColor="#020110" />
          <stop offset="100%" stopColor="#000006" />
        </radialGradient>
        <radialGradient id={singId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#8866ff" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={evId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#010005" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id={`${gid}-vr-gblur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <clipPath id={`${gid}-vr-pclip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />

      {/* Rim */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#2a0860" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#6622cc" strokeWidth="1.5" opacity="0.8" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#4400aa" strokeWidth="0.8" opacity="0.4" />

      {/* Reality distortion lines */}
      {[35, 52, 70, 115, 133, 148, 162, 175].map((y, i) => (
        <path key={i} d={`M 15,${y} C 60,${y - 2} 140,${y + 2} 185,${y}`} stroke="#220044" strokeWidth="0.5" fill="none" opacity="0.2" />
      ))}

      {/* Accretion disc */}
      <g clipPath={`url(#${gid}-vr-pclip)`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="8s" repeatCount="indefinite" />
          {discColors.map((col, i) => {
            const startDeg = i * 30;
            const endDeg = startDeg + 30;
            const toRad = (d: number) => (d * Math.PI) / 180;
            const r = 46;
            const x1 = 100 + r * Math.cos(toRad(startDeg));
            const y1 = 100 + r * Math.sin(toRad(startDeg));
            const x2 = 100 + r * Math.cos(toRad(endDeg));
            const y2 = 100 + r * Math.sin(toRad(endDeg));
            return (
              <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={col} strokeWidth="18" fill="none" opacity={0.7 + (i % 3) * 0.1} />
            );
          })}
        </g>
      </g>

      {/* Event horizon */}
      <circle cx="100" cy="100" r="32" fill={`url(#${evId})`} />
      <circle cx="100" cy="100" r="28" fill="#000000" />
      <circle cx="100" cy="100" r="32" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" filter={`url(#${gid}-vr-gblur)`} />
      <circle cx="100" cy="100" r="4" fill={`url(#${singId})`} />

      {/* Gravitational lens arcs */}
      {[40, 44, 49, 53, 57, 61].map((r2, i) => {
        const startA = 30 + i * 20;
        const endA = startA + 80;
        const toR = (d: number) => (d * Math.PI) / 180;
        const x1 = 100 + r2 * Math.cos(toR(startA));
        const y1 = 100 + r2 * Math.sin(toR(startA));
        const x2 = 100 + r2 * Math.cos(toR(endA));
        const y2 = 100 + r2 * Math.sin(toR(endA));
        return (
          <path key={i} d={`M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2}`} stroke="#ffffff" strokeWidth="0.8" fill="none" opacity={0.3 + (i % 3) * 0.07} />
        );
      })}

      {/* Rift cracks */}
      <path d="M 100,32 L 96,60 L 104,60" stroke="#4400aa" strokeWidth="1.5" fill="none" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.2;0.6;0.4;0.5" dur="3.5s" repeatCount="indefinite" />
      </path>
      <path d="M 168,100 L 140,96 L 140,104" stroke="#4400aa" strokeWidth="1.2" fill="none" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.7;0.2;0.5;0.4" dur="4.2s" repeatCount="indefinite" />
      </path>
      <path d="M 100,168 L 104,140 L 96,140" stroke="#4400aa" strokeWidth="1" fill="none" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.15;0.55;0.35;0.4" dur="5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function createVoidRiftParticles() {
  const sys = makeParticleSystem(300);

  function emitBurst(cx: number, cy: number) {
    sys.emit(cx, cy, 20, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: 3 + Math.random() * 4,
      hue: 260 + Math.random() * 40,
      sat: 80, lit: 45,
      alpha: 0.75,
      decay: 0.008,
      gravity: -0.01,
      type: "dust",
    }));
    sys.emit(cx, cy, 20, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9,
      size: 2 + Math.random() * 2,
      hue: 240 + Math.random() * 40,
      sat: 90, lit: 65,
      alpha: 0.9,
      decay: 0.02,
      gravity: 0.02,
      type: "shard",
    }));
    sys.emit(cx, cy, 10, () => ({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: 1.5 + Math.random() * 1.5,
      hue: 270 + Math.random() * 30,
      sat: 70, lit: 55,
      alpha: 0.65,
      decay: 0.007,
      gravity: 0,
      type: "singularity",
    }));
  }

  function ambientEmit(cx: number, cy: number) {
    if (Math.random() < 0.1) {
      sys.emit(cx, cy, 1, () => ({
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 2 + Math.random() * 3,
        hue: 270 + Math.random() * 30,
        sat: 75, lit: 42,
        alpha: 0.5,
        decay: 0.005,
        gravity: 0,
        type: "ambient-dust",
      }));
    }
  }

  return { sys, emitBurst, ambientEmit };
}

export function VoidRiftCoinToss({
  revealed: _revealed,
  result,
  pendingForSpin,
  coinDiam = 240,
  compact = false,
  autostart = true,
  enableAmbient = false,
  showOutcomeText = false,
  p1Name: _p1Name,
  p2Name: _p2Name,
  winCol: _winCol,
}: CoinTossProps) {
  const gid = useId().replace(/:/g, "");
  const vrRef = useRef(createVoidRiftParticles());

  const particleEmitter = useCallback(
    (cx: number, cy: number, p: Phase, _canvas: HTMLCanvasElement) => {
      if (p === "bouncing" || p === "spinning") {
        vrRef.current.emitBurst(cx, cy);
      }
    },
    []
  );

  const handleBurstVR = useCallback((cx: number, cy: number) => {
    vrRef.current.emitBurst(cx, cy);
  }, []);

  const handleEmitVR = useCallback((cx: number, cy: number, count: number, pow: number) => {
    vrRef.current.sys.emit(cx, cy, count, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 9 * pow,
      vy: (Math.random() - 0.5) * 9 * pow,
      size: 2 + Math.random() * 2,
      hue: 260 + Math.random() * 40,
      sat: 90, lit: 55,
      alpha: 0.85,
      decay: 0.018,
      gravity: 0.02,
      type: "shard",
    }));
  }, []);

  const {
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
  } = useCoinTossPhysics(
    result,
    pendingForSpin,
    coinDiam,
    autostart,
    enableAmbient,
    particleEmitter,
    handleBurstVR,
    handleEmitVR,
    compact,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { sys, ambientEmit } = vrRef.current;
    sys.start(canvas, particleCX, particleCY, enableAmbient ? ambientEmit : undefined);
    return () => sys.stop();
  }, [canvasRef, particleCX, particleCY, enableAmbient]);

  const spinDeg = side === "PENTA" ? 5040 : 5220;
  const outcomeLabel = side === "PENTA" ? "ETERNAL COSMOS" : "THE RIFT";
  const outcomeCol = side === "PENTA" ? "#bb88ff" : "#7733cc";
  const glowStyle = `drop-shadow(0 0 ${glow * 30}px rgba(100,0,255,${glow})) drop-shadow(0 0 ${glow * 60}px rgba(60,0,180,${glow * 0.5}))`;

  return (
    <div
      className="vr-wrapper"
      style={{
        position: "relative",
        width: particleW,
        height: particleH,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: particleH * 0.12,
          left: "50%",
          transform: `translateX(-50%) scaleY(0.3)`,
          width: coinDiam * scl,
          height: coinDiam * scl * 0.3,
          background: "radial-gradient(ellipse, rgba(80,0,200,.35) 0%, transparent 70%)",
          borderRadius: "50%",
          opacity: 0.5 + glow * 0.3,
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        width={particleW}
        height={particleH}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      />
      {sw && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(1.5)`,
            width: coinDiam,
            height: coinDiam,
            borderRadius: "50%",
            border: `3px solid rgba(100,40,255,0.25)`,
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        key={`vr-coin-${spinKey}`}
        style={{
          position: "relative",
          width: coinDiam,
          height: coinDiam,
          transform: `translateY(${yOff}px) scale(${scl})`,
          filter: glowStyle,
          perspective: 800,
          animation:
            spinKey > 0
              ? `vr-spin-${spinKey} 5.15s cubic-bezier(0.05, 0.7, 0.98, 1) forwards`
              : undefined,
        }}
      >
        <style>{`
          @keyframes vr-spin-${spinKey} {
            from { transform: translateY(${yOff}px) scale(${scl}) rotateY(0deg); }
            to   { transform: translateY(${yOff}px) scale(${scl}) rotateY(${spinDeg}deg); }
          }
        `}</style>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
          {side === "PENTA" ? (
            <VoidRiftPentaFace gid={gid} />
          ) : (
            <VoidRiftProtoFace gid={gid} />
          )}
        </div>
      </div>
      {showOutcomeText && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            color: outcomeCol,
            fontFamily: "monospace",
            fontSize: compact ? 11 : 15,
            fontWeight: 700,
            letterSpacing: 2,
            textShadow: `0 0 12px ${outcomeCol}`,
            whiteSpace: "nowrap",
          }}
        >
          {outcomeLabel}
        </div>
      )}
    </div>
  );
}

export function VoidRiftPreview({ coinDiam = 120, compact = true }: PreviewProps) {
  const [cycle, setCycle] = useState(0);
  const [side, setSide] = useState<"PENTA" | "PROTO">("PENTA");
  useEffect(() => {
    const id = setInterval(() => {
      setCycle((c) => c + 1);
      setSide((s) => (s === "PENTA" ? "PROTO" : "PENTA"));
    }, 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <VoidRiftCoinToss
      key={cycle}
      coinDiam={coinDiam}
      compact={compact}
      result={side}
      autostart
      showOutcomeText
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COIN 3: NEON STRIKE
// ─────────────────────────────────────────────────────────────────────────────

function NeonStrikePentaFace({ gid }: { gid: string }) {
  const bgId = `${gid}-ns-bg`;
  const boltId = `${gid}-ns-bolt`;
  const nodeId = `${gid}-ns-node`;
  const centerGlowId = `${gid}-ns-cg`;

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d1a14" />
          <stop offset="50%" stopColor="#060e0a" />
          <stop offset="100%" stopColor="#020605" />
        </radialGradient>
        <linearGradient id={boltId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#88ffee" />
          <stop offset="60%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#00cc88" />
        </linearGradient>
        <radialGradient id={nodeId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#006644" />
        </radialGradient>
        <radialGradient id={centerGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffcc" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#00ffcc" stopOpacity="0" />
        </radialGradient>
        <filter id={`${gid}-ns-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id={`${gid}-ns-clip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />

      {/* Circuit substrate */}
      {[40, 70, 100, 130, 160].map((y) => (
        <line key={`h${y}`} x1="10" y1={y} x2="190" y2={y} stroke="#00ffcc" strokeWidth="0.5" opacity="0.05" />
      ))}
      {[40, 70, 100, 130, 160].map((x) => (
        <line key={`v${x}`} x1={x} y1="10" x2={x} y2="190" stroke="#00ffcc" strokeWidth="0.5" opacity="0.05" />
      ))}
      {[40, 70, 130, 160].map((x) =>
        [40, 70, 130, 160].map((y) => (
          <circle key={`p${x}-${y}`} cx={x} cy={y} r="1.5" fill="#00ffcc" opacity="0.08" />
        ))
      )}

      {/* Rim */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#445544" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#00ffcc" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#006644" strokeWidth="0.8" opacity="0.4" />

      {/* Center glow */}
      <circle cx="100" cy="100" r="65" fill={`url(#${centerGlowId})`} />

      {/* Node lines */}
      <line x1="55" y1="55" x2="90" y2="85" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="145" y1="55" x2="110" y2="85" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="55" y1="145" x2="90" y2="120" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="145" y1="145" x2="110" y2="120" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />

      {/* Corner energy nodes */}
      <circle cx="55" cy="55" r="6" fill={`url(#${nodeId})`} />
      <circle cx="145" cy="55" r="6" fill={`url(#${nodeId})`} />
      <circle cx="55" cy="145" r="6" fill={`url(#${nodeId})`} />
      <circle cx="145" cy="145" r="6" fill={`url(#${nodeId})`} />

      {/* Bolt glow */}
      <polygon
        points="95,22 120,78 103,78 130,162 80,98 98,98 72,22"
        fill={`url(#${boltId})`}
        opacity="0.25"
        filter={`url(#${gid}-ns-glow)`}
        clipPath={`url(#${gid}-ns-clip)`}
      />

      {/* Bolt main */}
      <polygon
        points="95,22 120,78 103,78 130,162 80,98 98,98 72,22"
        fill={`url(#${boltId})`}
        stroke="#00ffcc"
        strokeWidth="2"
        clipPath={`url(#${gid}-ns-clip)`}
      />

      {/* Bolt inner highlight */}
      <polygon
        points="95,22 120,78 103,78 130,162 80,98 98,98 72,22"
        fill="#ffffff"
        opacity="0.25"
        clipPath={`url(#${gid}-ns-clip)`}
      />

      {/* Electricity arcs */}
      <path d="M 95,50 L 78,43 L 72,36" stroke="#00ffee" strokeWidth="1.2" fill="none">
        <animate attributeName="opacity" values="0;0.8;0;0.5;0" dur="0.3s" begin="0s" repeatCount="indefinite" />
      </path>
      <path d="M 118,72 L 132,65 L 138,58" stroke="#00ffee" strokeWidth="1" fill="none">
        <animate attributeName="opacity" values="0;0.7;0;0.4;0" dur="0.3s" begin="0.05s" repeatCount="indefinite" />
      </path>
      <path d="M 85,108 L 68,115 L 62,122" stroke="#00ffee" strokeWidth="1.3" fill="none">
        <animate attributeName="opacity" values="0;0.9;0;0.6;0" dur="0.28s" begin="0.1s" repeatCount="indefinite" />
      </path>
      <path d="M 125,138 L 140,132 L 148,140" stroke="#00ffee" strokeWidth="1" fill="none">
        <animate attributeName="opacity" values="0;0.6;0;0.8;0" dur="0.32s" begin="0.15s" repeatCount="indefinite" />
      </path>
      <path d="M 78,62 L 65,58 L 60,50" stroke="#00ffee" strokeWidth="0.9" fill="none">
        <animate attributeName="opacity" values="0;0.75;0;0.45;0" dur="0.25s" begin="0.08s" repeatCount="indefinite" />
      </path>
      <path d="M 112,90 L 128,88 L 135,82" stroke="#00ffee" strokeWidth="1.1" fill="none">
        <animate attributeName="opacity" values="0;0.85;0;0.55;0" dur="0.35s" begin="0.22s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function NeonStrikeProtoFace({ gid }: { gid: string }) {
  const bgId = `${gid}-ns-proto-bg`;
  const chipId = `${gid}-ns-chip-fill`;
  const dotPathId = `${gid}-ns-dp-${gid}`;

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d1a14" />
          <stop offset="50%" stopColor="#060e0a" />
          <stop offset="100%" stopColor="#020605" />
        </radialGradient>
        <radialGradient id={chipId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#021208" />
          <stop offset="100%" stopColor="#020c0a" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />

      {/* Rim */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#445544" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#00ffcc" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#006644" strokeWidth="0.8" opacity="0.4" />

      {/* PCB traces horizontal */}
      <line x1="20" y1="40" x2="180" y2="40" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="70" x2="70" y2="70" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="70" x2="180" y2="70" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="100" x2="72" y2="100" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="128" y1="100" x2="180" y2="100" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="130" x2="70" y2="130" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="130" x2="180" y2="130" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="160" x2="180" y2="160" stroke="#ff0088" strokeWidth="2" opacity="0.5" />

      {/* PCB traces vertical */}
      <line x1="40" y1="20" x2="40" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="70" y1="20" x2="70" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="70" y1="128" x2="70" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="20" x2="100" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="128" x2="100" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="20" x2="130" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="128" x2="130" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="160" y1="20" x2="160" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />

      {/* Via pads */}
      <circle cx="70" cy="70" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="130" cy="70" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="70" cy="130" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="130" cy="130" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="40" cy="40" r="4" fill="#ff0088" opacity="0.55" />
      <circle cx="160" cy="40" r="4" fill="#ff0088" opacity="0.55" />
      <circle cx="40" cy="160" r="4" fill="#ff0088" opacity="0.55" />
      <circle cx="160" cy="160" r="4" fill="#ff0088" opacity="0.55" />

      {/* IC outlines */}
      <rect x="25" y="48" width="25" height="12" rx="1" fill="none" stroke="#ff0088" strokeWidth="1.5" opacity="0.5" />
      <rect x="150" y="48" width="25" height="12" rx="1" fill="none" stroke="#ff0088" strokeWidth="1.5" opacity="0.5" />
      <rect x="28" y="140" width="20" height="12" rx="1" fill="none" stroke="#ff0088" strokeWidth="1.5" opacity="0.5" />

      {/* SMD components */}
      {([
        [55, 32], [90, 23], [120, 30], [155, 55],
        [162, 90], [148, 148], [90, 168], [35, 110]
      ] as [number, number][]).map(([x, y], i) => (
        <rect key={i} x={x - 4} y={y - 2.5} width="8" height="5" rx="1" fill="none" stroke="#ff0088" strokeWidth="1" opacity="0.35" />
      ))}

      {/* Data pulse route */}
      <path id={dotPathId} d="M 70,70 L 130,70 L 130,130" stroke="#00ffcc" strokeWidth="2.5" fill="none" opacity="0.9" />

      {/* Animated dot */}
      <circle r="4" fill="#ffffff">
        <animateMotion dur="2s" repeatCount="indefinite">
          <mpath href={`#${dotPathId}`} />
        </animateMotion>
      </circle>
      <circle r="8" fill="#00ffcc" opacity="0.4">
        <animateMotion dur="2s" repeatCount="indefinite">
          <mpath href={`#${dotPathId}`} />
        </animateMotion>
      </circle>

      {/* Central IC chip */}
      <rect x="75" y="75" width="50" height="50" rx="4" fill={`url(#${chipId})`} stroke="#00ffcc" strokeWidth="2" />

      {/* IC pins top/bottom */}
      {([82, 91, 100, 109, 118] as number[]).map((x) => (
        <React.Fragment key={x}>
          <rect x={x - 2} y={70} width="4" height="5" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
          <rect x={x - 2} y={125} width="4" height="5" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
        </React.Fragment>
      ))}
      {/* IC pins left/right */}
      {([82, 91, 100, 109, 118] as number[]).map((y) => (
        <React.Fragment key={y}>
          <rect x={70} y={y - 2} width="5" height="4" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
          <rect x={125} y={y - 2} width="5" height="4" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
        </React.Fragment>
      ))}

      {/* IC label */}
      <text x="100" y="103" textAnchor="middle" fill="#00ffcc" fontFamily="monospace" fontSize="10" fontWeight="bold">PP-01</text>
      <text x="78" y="73" fill="#ff0088" fontFamily="monospace" fontSize="8" opacity="0.6">U1</text>
    </svg>
  );
}

function createNeonStrikeParticles() {
  const sys = makeParticleSystem(400);

  function emitBurst(cx: number, cy: number) {
    sys.emit(cx, cy, 40, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 24,
      vy: (Math.random() - 0.5) * 24,
      size: 2 + Math.random() * 3,
      hue: 170 + Math.random() * 30,
      sat: 100, lit: 70,
      alpha: 1.0,
      decay: 0.06,
      gravity: 0,
      type: "arc",
    }));
    sys.emit(cx, cy, 25, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12 - 2,
      size: 2 + Math.random() * 2,
      hue: 300 + Math.random() * 30,
      sat: 100, lit: 65,
      alpha: 0.9,
      decay: 0.025,
      gravity: 0.08,
      type: "spark",
    }));
    sys.emit(cx, cy, 15, () => {
      const dir = Math.random() * Math.PI * 2;
      return {
        x: cx, y: cy,
        vx: Math.cos(dir) * 18,
        vy: Math.sin(dir) * 18,
        size: 10,
        hue: 180 + Math.random() * 20,
        sat: 100, lit: 75,
        alpha: 0.15,
        decay: 0.06,
        gravity: 0,
        type: "streak",
      };
    });
  }

  return { sys, emitBurst };
}

export function NeonStrikeCoinToss({
  revealed: _revealed,
  result,
  pendingForSpin,
  coinDiam = 240,
  compact = false,
  autostart = true,
  enableAmbient = false,
  showOutcomeText = false,
  p1Name: _p1Name,
  p2Name: _p2Name,
  winCol: _winCol,
}: CoinTossProps) {
  const gid = useId().replace(/:/g, "");
  const nsRef = useRef(createNeonStrikeParticles());

  const particleEmitter = useCallback(
    (cx: number, cy: number, p: Phase, _canvas: HTMLCanvasElement) => {
      if (p === "bouncing" || p === "spinning") {
        nsRef.current.emitBurst(cx, cy);
      }
    },
    []
  );

  const handleBurstNS = useCallback((cx: number, cy: number) => {
    nsRef.current.emitBurst(cx, cy);
  }, []);

  const handleEmitNS = useCallback((cx: number, cy: number, count: number, pow: number) => {
    nsRef.current.sys.emit(cx, cy, count, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 12 * pow,
      vy: (Math.random() - 0.5) * 12 * pow,
      size: 2 + Math.random() * 3,
      hue: 170 + Math.random() * 30,
      sat: 100, lit: 70,
      alpha: 1.0,
      decay: 0.06,
      gravity: 0,
      type: "arc",
    }));
  }, []);

  const {
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
  } = useCoinTossPhysics(
    result,
    pendingForSpin,
    coinDiam,
    autostart,
    enableAmbient,
    particleEmitter,
    handleBurstNS,
    handleEmitNS,
    compact,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { sys } = nsRef.current;
    sys.start(canvas, particleCX, particleCY);
    return () => sys.stop();
  }, [canvasRef, particleCX, particleCY]);

  const spinDeg = side === "PENTA" ? 5040 : 5220;
  const outcomeLabel = side === "PENTA" ? "FULL SURGE" : "DEAD CIRCUIT";
  const outcomeCol = side === "PENTA" ? "#00ffcc" : "#ff0088";
  const glowStyle = `drop-shadow(0 0 ${glow * 30}px rgba(0,255,200,${glow})) drop-shadow(0 0 ${glow * 60}px rgba(0,200,160,${glow * 0.4}))`;

  return (
    <div
      className="ns-wrapper"
      style={{
        position: "relative",
        width: particleW,
        height: particleH,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: particleH * 0.12,
          left: "50%",
          transform: `translateX(-50%) scaleY(0.3)`,
          width: coinDiam * scl,
          height: coinDiam * scl * 0.3,
          background: "radial-gradient(ellipse, rgba(0,255,180,.3) 0%, transparent 70%)",
          borderRadius: "50%",
          opacity: 0.5 + glow * 0.3,
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        width={particleW}
        height={particleH}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      />
      {sw && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(1.5)`,
            width: coinDiam,
            height: coinDiam,
            borderRadius: "50%",
            border: `3px solid rgba(0,255,200,0.25)`,
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        key={`ns-coin-${spinKey}`}
        style={{
          position: "relative",
          width: coinDiam,
          height: coinDiam,
          transform: `translateY(${yOff}px) scale(${scl})`,
          filter: glowStyle,
          perspective: 800,
          animation:
            spinKey > 0
              ? `ns-spin-${spinKey} 5.15s cubic-bezier(0.05, 0.7, 0.98, 1) forwards`
              : undefined,
        }}
      >
        <style>{`
          @keyframes ns-spin-${spinKey} {
            from { transform: translateY(${yOff}px) scale(${scl}) rotateY(0deg); }
            to   { transform: translateY(${yOff}px) scale(${scl}) rotateY(${spinDeg}deg); }
          }
        `}</style>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
          {side === "PENTA" ? (
            <NeonStrikePentaFace gid={gid} />
          ) : (
            <NeonStrikeProtoFace gid={gid} />
          )}
        </div>
      </div>
      {showOutcomeText && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            color: outcomeCol,
            fontFamily: "monospace",
            fontSize: compact ? 11 : 15,
            fontWeight: 700,
            letterSpacing: 2,
            textShadow: `0 0 12px ${outcomeCol}`,
            whiteSpace: "nowrap",
          }}
        >
          {outcomeLabel}
        </div>
      )}
    </div>
  );
}

// ── Static face SVG helpers ───────────────────────────────────────────────────
// Each takes { gid } and renders defs + SVG elements (no outer <svg> tag).
// <animate>/<animateTransform> elements are omitted for static, performant display.

function SolarFlarePentaSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-sf-bg`;
  const hotspotId = `${gid}-sf-hs`;
  const discId = `${gid}-sf-disc`;
  const pupilId = `${gid}-sf-pupil`;
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5c2000" />
          <stop offset="35%" stopColor="#3a1400" />
          <stop offset="70%" stopColor="#1a0800" />
          <stop offset="100%" stopColor="#0a0200" />
        </radialGradient>
        <radialGradient id={hotspotId} cx="60%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#e87800" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#e87800" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={discId} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fff8e0" />
          <stop offset="30%" stopColor="#ffd020" />
          <stop offset="65%" stopColor="#ff8800" />
          <stop offset="100%" stopColor="#cc4400" />
        </radialGradient>
        <radialGradient id={pupilId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff8e0" />
          <stop offset="40%" stopColor="#ffe060" />
          <stop offset="100%" stopColor="#ff8800" />
        </radialGradient>
        <clipPath id={`${gid}-sf-clip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="100" fill={`url(#${hotspotId})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#c8820a" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#f0a020" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#a06010" strokeWidth="0.8" opacity="0.4" />
      <g transform="translate(100,100)" clipPath={`url(#${gid}-sf-clip)`}>
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M -8,50 L 0,90 L 8,50 Z" fill="#f0c030" stroke="#c08020" strokeWidth="0.5" />
          </g>
        ))}
        {[45, 135, 225, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M -6,50 L 0,78 L 6,50 Z" fill="#e89020" opacity="0.85" />
          </g>
        ))}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M -4,50 L 0,65 L 4,50 Z" fill="#cc6010" opacity="0.65" />
          </g>
        ))}
      </g>
      <circle cx="100" cy="100" r="46" fill={`url(#${discId})`} stroke="#e89020" strokeWidth="2" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="#ffe060" strokeWidth="1.5" opacity="0.6" />
      <circle cx="92" cy="92" r="2.5" fill="#8a3000" opacity="0.4" />
      <circle cx="112" cy="88" r="2" fill="#8a3000" opacity="0.3" />
      <circle cx="105" cy="108" r="3" fill="#8a3000" opacity="0.35" />
      <circle cx="88" cy="110" r="2.2" fill="#8a3000" opacity="0.3" />
      <circle cx="116" cy="104" r="2.8" fill="#8a3000" opacity="0.45" />
      <path d="M 82,88 Q 88,82 94,88" stroke="#8a2000" strokeWidth="2" fill="none" />
      <path d="M 106,88 Q 112,82 118,88" stroke="#8a2000" strokeWidth="2" fill="none" />
      <ellipse cx="88" cy="96" rx="7" ry="8" fill="#8a2000" />
      <ellipse cx="112" cy="96" rx="7" ry="8" fill="#8a2000" />
      <ellipse cx="88" cy="96" rx="4.5" ry="5" fill={`url(#${pupilId})`} />
      <ellipse cx="112" cy="96" rx="4.5" ry="5" fill={`url(#${pupilId})`} />
      <path d="M 100,102 L 96,112 L 104,112 Z" fill="#8a2000" />
      <path d="M 84,118 Q 100,130 116,118" stroke="#c05000" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function SolarFlareProtoSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-sfp-bg`;
  const moonId = `${gid}-sfp-moon`;
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0800" />
          <stop offset="50%" stopColor="#050400" />
          <stop offset="100%" stopColor="#010100" />
        </radialGradient>
        <radialGradient id={moonId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#0c0c10" />
          <stop offset="100%" stopColor="#040408" />
        </radialGradient>
        <filter id={`${gid}-sfp-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#c8820a" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#f0a020" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#a06010" strokeWidth="0.8" opacity="0.4" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#ff8800" strokeWidth="2" opacity="0.12" filter={`url(#${gid}-sfp-blur)`} />
      <circle cx="100" cy="100" r="62" fill="none" stroke="#ffcc44" strokeWidth="2.5" opacity="0.22" filter={`url(#${gid}-sfp-blur)`} />
      <circle cx="100" cy="100" r="57" fill="none" stroke="#ffe090" strokeWidth="3" opacity="0.5" filter={`url(#${gid}-sfp-blur)`} />
      <circle cx="100" cy="100" r="53" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.95" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const len = i % 2 === 0 ? 22 : 14;
        const x2 = 100 + Math.cos(rad) * (52 + len);
        const y2 = 100 + Math.sin(rad) * (52 + len);
        const x1l = 100 + Math.cos(rad + 0.15) * 52;
        const y1l = 100 + Math.sin(rad + 0.15) * 52;
        const x1r = 100 + Math.cos(rad - 0.15) * 52;
        const y1r = 100 + Math.sin(rad - 0.15) * 52;
        return (
          <path key={deg} d={`M ${x1l},${y1l} L ${x2},${y2} L ${x1r},${y1r} Z`} fill="#ffd040" opacity={i % 2 === 0 ? 0.9 : 0.7} />
        );
      })}
      <circle cx="100" cy="100" r="49" fill={`url(#${moonId})`} stroke="#1a1a28" strokeWidth="1" />
      <path d="M 100,51 C 80,28 70,20 78,12 C 86,4 100,10 100,24" fill="none" stroke="#ff6600" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <path d="M 148,100 C 166,82 175,75 178,84 C 181,93 172,104 160,100" fill="none" stroke="#ff4400" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </>
  );
}

function VoidRiftPentaSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-vrp-bg`;
  const coreId = `${gid}-vrp-core`;
  const core2Id = `${gid}-vrp-core2`;
  const stars = [
    { x: 32, y: 45, r: 1.2 }, { x: 58, y: 28, r: 0.8 }, { x: 75, y: 40, r: 1.5 },
    { x: 142, y: 35, r: 1.0 }, { x: 165, y: 55, r: 1.3 }, { x: 155, y: 75, r: 0.7 },
    { x: 170, y: 42, r: 1.1 }, { x: 25, y: 70, r: 0.9 }, { x: 40, y: 130, r: 1.4 },
    { x: 28, y: 155, r: 0.6 }, { x: 50, y: 168, r: 1.2 }, { x: 35, y: 90, r: 0.8 },
    { x: 160, y: 130, r: 1.0 }, { x: 172, y: 155, r: 1.3 }, { x: 148, y: 168, r: 0.7 },
    { x: 175, y: 110, r: 1.1 }, { x: 60, y: 155, r: 0.9 }, { x: 45, y: 50, r: 1.6 },
    { x: 150, y: 45, r: 0.8 }, { x: 130, y: 28, r: 1.2 }, { x: 110, y: 18, r: 0.9 },
    { x: 90, y: 22, r: 1.0 }, { x: 70, y: 175, r: 1.3 }, { x: 100, y: 178, r: 0.7 },
    { x: 130, y: 172, r: 1.1 }, { x: 18, y: 110, r: 0.8 }, { x: 22, y: 80, r: 1.4 },
    { x: 182, y: 80, r: 0.9 }, { x: 178, y: 95, r: 1.2 }, { x: 178, y: 125, r: 0.6 },
  ];
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#100830" />
          <stop offset="40%" stopColor="#080420" />
          <stop offset="75%" stopColor="#020110" />
          <stop offset="100%" stopColor="#010008" />
        </radialGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#eeddff" />
          <stop offset="60%" stopColor="#bb88ff" />
          <stop offset="100%" stopColor="#330066" />
        </radialGradient>
        <radialGradient id={core2Id} cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffffdd" />
        </radialGradient>
        <filter id={`${gid}-vrp-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#2a0860" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#6622cc" strokeWidth="1.5" opacity="0.8" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#4400aa" strokeWidth="0.8" opacity="0.4" />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity="0.75" />
      ))}
      <ellipse cx="130" cy="75" rx="22" ry="14" fill="#7744cc" opacity="0.07" filter={`url(#${gid}-vrp-blur)`} />
      <ellipse cx="68" cy="125" rx="18" ry="12" fill="#4422aa" opacity="0.09" filter={`url(#${gid}-vrp-blur)`} />
      <circle cx="100" cy="100" r="22" fill={`url(#${coreId})`} />
      <circle cx="100" cy="100" r="14" fill={`url(#${core2Id})`} />
      <circle cx="100" cy="100" r="7" fill="#ffffff" />
      <line x1="85" y1="100" x2="115" y2="100" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      <line x1="100" y1="85" x2="100" y2="115" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      <line x1="89" y1="89" x2="111" y2="111" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
      <line x1="111" y1="89" x2="89" y2="111" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
    </>
  );
}

function VoidRiftProtoSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-vrpr-bg`;
  const singId = `${gid}-vrpr-sing`;
  const evId = `${gid}-vrpr-ev`;
  const discColors = [
    "#ff8800", "#ff6600", "#dd4400", "#aa2200",
    "#880066", "#6600cc", "#4400ff", "#2244ff",
    "#44aaff", "#88ccff", "#ffcc44", "#ff9900",
  ];
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#080418" />
          <stop offset="50%" stopColor="#020110" />
          <stop offset="100%" stopColor="#000006" />
        </radialGradient>
        <radialGradient id={singId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#8866ff" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={evId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#010005" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id={`${gid}-vrpr-gblur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#2a0860" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#6622cc" strokeWidth="1.5" opacity="0.8" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#4400aa" strokeWidth="0.8" opacity="0.4" />
      {discColors.map((col, i) => {
        const startDeg = i * 30;
        const endDeg = startDeg + 30;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const r = 46;
        const x1 = 100 + r * Math.cos(toRad(startDeg));
        const y1 = 100 + r * Math.sin(toRad(startDeg));
        const x2 = 100 + r * Math.cos(toRad(endDeg));
        const y2 = 100 + r * Math.sin(toRad(endDeg));
        return (
          <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={col} strokeWidth="18" fill="none" opacity={0.7 + (i % 3) * 0.1} />
        );
      })}
      <circle cx="100" cy="100" r="32" fill={`url(#${evId})`} />
      <circle cx="100" cy="100" r="28" fill="#000000" />
      <circle cx="100" cy="100" r="32" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" filter={`url(#${gid}-vrpr-gblur)`} />
      <circle cx="100" cy="100" r="4" fill={`url(#${singId})`} />
    </>
  );
}

function NeonStrikePentaSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-nsp-bg`;
  const boltId = `${gid}-nsp-bolt`;
  const nodeId = `${gid}-nsp-node`;
  const centerGlowId = `${gid}-nsp-cg`;
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d1a14" />
          <stop offset="50%" stopColor="#060e0a" />
          <stop offset="100%" stopColor="#020605" />
        </radialGradient>
        <linearGradient id={boltId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#88ffee" />
          <stop offset="60%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#00cc88" />
        </linearGradient>
        <radialGradient id={nodeId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#006644" />
        </radialGradient>
        <radialGradient id={centerGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffcc" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#00ffcc" stopOpacity="0" />
        </radialGradient>
        <filter id={`${gid}-nsp-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <clipPath id={`${gid}-nsp-clip`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      {[40, 70, 100, 130, 160].map((y) => (
        <line key={`h${y}`} x1="10" y1={y} x2="190" y2={y} stroke="#00ffcc" strokeWidth="0.5" opacity="0.05" />
      ))}
      {[40, 70, 100, 130, 160].map((x) => (
        <line key={`v${x}`} x1={x} y1="10" x2={x} y2="190" stroke="#00ffcc" strokeWidth="0.5" opacity="0.05" />
      ))}
      <circle cx="100" cy="100" r="97" fill="none" stroke="#445544" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#00ffcc" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#006644" strokeWidth="0.8" opacity="0.4" />
      <circle cx="100" cy="100" r="65" fill={`url(#${centerGlowId})`} />
      <line x1="55" y1="55" x2="90" y2="85" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="145" y1="55" x2="110" y2="85" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="55" y1="145" x2="90" y2="120" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <line x1="145" y1="145" x2="110" y2="120" stroke="#00ffcc" strokeWidth="0.8" opacity="0.35" />
      <circle cx="55" cy="55" r="6" fill={`url(#${nodeId})`} />
      <circle cx="145" cy="55" r="6" fill={`url(#${nodeId})`} />
      <circle cx="55" cy="145" r="6" fill={`url(#${nodeId})`} />
      <circle cx="145" cy="145" r="6" fill={`url(#${nodeId})`} />
      <polygon points="95,22 120,78 103,78 130,162 80,98 98,98 72,22" fill={`url(#${boltId})`} opacity="0.25" filter={`url(#${gid}-nsp-glow)`} clipPath={`url(#${gid}-nsp-clip)`} />
      <polygon points="95,22 120,78 103,78 130,162 80,98 98,98 72,22" fill={`url(#${boltId})`} stroke="#00ffcc" strokeWidth="2" clipPath={`url(#${gid}-nsp-clip)`} />
      <polygon points="95,22 120,78 103,78 130,162 80,98 98,98 72,22" fill="#ffffff" opacity="0.25" clipPath={`url(#${gid}-nsp-clip)`} />
    </>
  );
}

function NeonStrikeProtoSVG({ gid }: { gid: string }) {
  const bgId = `${gid}-nspr-bg`;
  const chipId = `${gid}-nspr-chip`;
  return (
    <>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d1a14" />
          <stop offset="50%" stopColor="#060e0a" />
          <stop offset="100%" stopColor="#020605" />
        </radialGradient>
        <radialGradient id={chipId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#021208" />
          <stop offset="100%" stopColor="#020c0a" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${bgId})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#445544" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#00ffcc" strokeWidth="1.5" opacity="0.9" />
      <circle cx="100" cy="100" r="89" fill="none" stroke="#006644" strokeWidth="0.8" opacity="0.4" />
      <line x1="20" y1="40" x2="180" y2="40" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="70" x2="70" y2="70" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="70" x2="180" y2="70" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="100" x2="72" y2="100" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="128" y1="100" x2="180" y2="100" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="130" x2="70" y2="130" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="130" x2="180" y2="130" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="160" x2="180" y2="160" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="40" y1="20" x2="40" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="70" y1="20" x2="70" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="70" y1="128" x2="70" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="20" x2="100" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="128" x2="100" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="20" x2="130" y2="72" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="130" y1="128" x2="130" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <line x1="160" y1="20" x2="160" y2="180" stroke="#ff0088" strokeWidth="2" opacity="0.5" />
      <circle cx="70" cy="70" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="130" cy="70" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="70" cy="130" r="5" fill="#ff0088" opacity="0.6" />
      <circle cx="130" cy="130" r="5" fill="#ff0088" opacity="0.6" />
      <rect x="75" y="75" width="50" height="50" rx="4" fill={`url(#${chipId})`} stroke="#00ffcc" strokeWidth="2" />
      {([82, 91, 100, 109, 118] as number[]).map((x) => (
        <React.Fragment key={x}>
          <rect x={x - 2} y={70} width="4" height="5" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
          <rect x={x - 2} y={125} width="4" height="5" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
        </React.Fragment>
      ))}
      {([82, 91, 100, 109, 118] as number[]).map((y) => (
        <React.Fragment key={y}>
          <rect x={70} y={y - 2} width="5" height="4" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
          <rect x={125} y={y - 2} width="5" height="4" rx="0.5" fill="none" stroke="#00ffcc" strokeWidth="1" />
        </React.Fragment>
      ))}
      <text x="100" y="103" textAnchor="middle" fill="#00ffcc" fontFamily="monospace" fontSize="10" fontWeight="bold">PP-01</text>
    </>
  );
}

// ── Static face components ────────────────────────────────────────────────────

export function SolarFlareCoinFace({
  face,
  size = 56,
  uid,
}: {
  face: "PENTA" | "PROTO";
  size?: number;
  uid: string;
}) {
  const gid = `sf-static-${uid}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ borderRadius: "50%", display: "block" }}>
      {face === "PENTA" ? <SolarFlarePentaSVG gid={gid} /> : <SolarFlareProtoSVG gid={gid} />}
    </svg>
  );
}

export function VoidRiftCoinFace({
  face,
  size = 56,
  uid,
}: {
  face: "PENTA" | "PROTO";
  size?: number;
  uid: string;
}) {
  const gid = `vr-static-${uid}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ borderRadius: "50%", display: "block" }}>
      {face === "PENTA" ? <VoidRiftPentaSVG gid={gid} /> : <VoidRiftProtoSVG gid={gid} />}
    </svg>
  );
}

export function NeonStrikeCoinFace({
  face,
  size = 56,
  uid,
}: {
  face: "PENTA" | "PROTO";
  size?: number;
  uid: string;
}) {
  const gid = `ns-static-${uid}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ borderRadius: "50%", display: "block" }}>
      {face === "PENTA" ? <NeonStrikePentaSVG gid={gid} /> : <NeonStrikeProtoSVG gid={gid} />}
    </svg>
  );
}

export function NeonStrikePreview({ coinDiam = 120, compact = true }: PreviewProps) {
  const [cycle, setCycle] = useState(0);
  const [side, setSide] = useState<"PENTA" | "PROTO">("PENTA");
  useEffect(() => {
    const id = setInterval(() => {
      setCycle((c) => c + 1);
      setSide((s) => (s === "PENTA" ? "PROTO" : "PENTA"));
    }, 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <NeonStrikeCoinToss
      key={cycle}
      coinDiam={coinDiam}
      compact={compact}
      result={side}
      autostart
      showOutcomeText
    />
  );
}
