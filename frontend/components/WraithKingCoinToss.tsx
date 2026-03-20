"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";

type Face = "PENTA" | "PROTO";

type Props = {
  revealed?: boolean;
  result?: Face | null;
  pendingForSpin?: Face | null;
  coinDiam?: number;
  compact?: boolean;
  autostart?: boolean;
  enableAmbient?: boolean;
  showOutcomeText?: boolean;
  p1Name?: string;
  p2Name?: string;
  winCol?: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  d: number;
  size: number;
  sh: number;
  h: number;
  sat: number;
  a: number;
};

export function WraithKingCoinToss({
  revealed = false,
  result = null,
  pendingForSpin = null,
  coinDiam = 240,
  compact = false,
  autostart = true,
  enableAmbient = false,
  showOutcomeText = false,
  p1Name = "P1",
  p2Name = "P2",
  winCol = "#cc88ff",
}: Props) {
  const gid = useId().replace(/:/g, "");
  const [phase, setPhase] = useState<
    "idle" | "tossing-PENTA" | "tossing-PROTO" | "done"
  >("idle");
  const [side, setSide] = useState<Face | null>(null);
  const [yOff, setYOff] = useState(0);
  const [scl, setScl] = useState(1);
  const [shake, setShake] = useState(false);
  const [sw, setSw] = useState(false);
  const [glow, setGlow] = useState(0);

  const [spinKey, setSpinKey] = useState(0);

  const raf = useRef<number | null>(null);
  const parts = useRef<Particle[]>([]);
  const pRaf = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const didStartRef = useRef(false);
  const forceDoneRef = useRef(false);

  const particleW = compact ? 220 : 380;
  const particleH = compact ? 320 : 560;
  const particleCX = particleW / 2;
  const particleCY = compact ? particleH * 0.65 : 370;

  const scene = 190; // 3D coin scene size
  const scale = useMemo(() => coinDiam / scene, [coinDiam]);

  const revType = (result ?? side ?? "PENTA") as Face;
  const dominion = revType === "PENTA";

  const emit = useCallback(
    (cx: number, cy: number, n: number, pow = 1, hue = 275, sat = 80) => {
      for (let i = 0; i < n; i++) {
        parts.current.push({
          x: cx + (Math.random() - 0.5) * 50,
          y: cy + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 3.5 * pow,
          vy: -Math.random() * 5.5 * pow - 1,
          g: 0.05 + Math.random() * 0.035,
          life: 1,
          d: 0.006 + Math.random() * 0.01,
          size: Math.random() * 5.5 + 2,
          sh: 0.994,
          h: hue + Math.random() * 20 - 10,
          sat,
          a: 0.6 + Math.random() * 0.4,
        });
      }
    },
    []
  );

  const burst = useCallback((cx: number, cy: number) => {
    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI * 2;
      const spd = 2 + Math.random() * 6;
      parts.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.5 - 2,
        g: 0.065,
        life: 1,
        d: 0.013 + Math.random() * 0.01,
        size: Math.random() * 5 + 2.5,
        sh: 0.975,
        h: 270 + Math.random() * 30,
        sat: 70 + Math.random() * 30,
        a: 0.85,
      });
    }
  }, []);

  // Particle canvas loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = particleW * 2 * dpr;
    c.height = particleH * 2 * dpr;
    c.style.width = `${particleW}px`;
    c.style.height = `${particleH}px`;

    ctx.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0);

    const draw = () => {
      ctx.clearRect(0, 0, particleW, particleH);
      for (let i = parts.current.length - 1; i >= 0; i--) {
        const p = parts.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.life -= p.d;
        p.size *= p.sh;
        if (p.life <= 0 || p.size < 0.1) {
          parts.current.splice(i, 1);
          continue;
        }

        ctx.globalCompositeOperation = "lighter";
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gr.addColorStop(
          0,
          `hsla(${p.h},${p.sat}%,${Math.round(50 + p.life * 25)}%,${(
            p.life * p.a
          ).toFixed(3)})`
        );
        gr.addColorStop(
          0.6,
          `hsla(${p.h + 10},${p.sat}%,35%,${(p.life * p.a * 0.35).toFixed(
            3
          )})`
        );
        gr.addColorStop(1, `hsla(${p.h},50%,20%,0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      pRaf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (pRaf.current) cancelAnimationFrame(pRaf.current);
    };
  }, [particleW, particleH]);

  // Start toss automatically (toss up from ground)
  const startToss = useCallback(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;

    const chosen: Face = pendingForSpin ?? (Math.random() > 0.5 ? "PENTA" : "PROTO");
    setSide(chosen);
    setShake(false);
    setSw(false);
    setGlow(1);

    setPhase(`tossing-${chosen}`);
    // Spin key forces the CSS animation to restart cleanly
    setSpinKey((k) => k + 1);

    let posY = 0;
    let velY = -24;
    const grav = 0.28;
    let bounceN = 0;
    let settled = false;
    let settleTime = 0;
    let lastE = 0;
    const CX = particleCX;

    // Start burst above ground
    emit(CX, particleCY, compact ? 10 : 30, compact ? 1.2 : 2.0, 275, 80);

    const step = (now: number) => {
      if (forceDoneRef.current && !settled) {
        settled = true;
        settleTime = now;
        velY = 0;
        posY = 0;
        setYOff(0);
        setGlow(0);
        setPhase("done");
        raf.current = requestAnimationFrame(step);
        return;
      }

      if (settled) {
        const st = Math.min(1, (now - settleTime) / 400);
        setScl(1 + 0.04 * Math.sin(st * Math.PI * 3) * (1 - st));
        if (st >= 1) {
          setScl(1);
          setPhase("done");
          emit(CX, particleCY - 25, compact ? 6 : 10, 0.3, 275, 70);
          raf.current = null;
          return;
        }
        raf.current = requestAnimationFrame(step);
        return;
      }

      velY += grav;
      posY += velY;

      const hN = Math.min(1, Math.abs(posY) / 340);
      setScl(1 - hN * 0.08);
      setGlow(Math.max(0, 1 - hN * 0.5));

      if (posY < -30 && now - lastE > 40) {
        emit(CX, particleCY + posY + 100, compact ? 2 : 3, 0.5, 275, 75);
        lastE = now;
      }

      if (posY >= 0 && velY > 0) {
        posY = 0;
        if (bounceN === 0) {
          velY = -10;
          burst(CX, particleCY);
          emit(CX, particleCY, compact ? 9 : 15, compact ? 1.0 : 1.2, 275, 80);
          setShake(true);
          setSw(true);
          setTimeout(() => setShake(false), 380);
          setTimeout(() => setSw(false), 650);
          bounceN++;
        } else if (bounceN === 1) {
          velY = -5;
          emit(CX, particleCY, compact ? 5 : 6, 0.4, 275, 70);
          bounceN++;
        } else if (bounceN === 2) {
          velY = -2;
          bounceN++;
        } else if (bounceN === 3) {
          velY = -0.6;
          bounceN++;
        } else {
          settled = true;
          settleTime = now;
          velY = 0;
          posY = 0;
          setGlow(0);
        }
      }

      setYOff(posY);
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
  }, [compact, emit, burst, pendingForSpin, particleCX, particleCY]);

  useEffect(() => {
    if (!autostart) return;
    if (phase !== "idle") return;
    startToss();
  }, [autostart, phase, startToss]);

  // Force final face when result arrives (and stop motion if needed)
  const didRevealFxRef = useRef(false);
  useEffect(() => {
    if (!revealed || !result) return;

    setSide(result);
    didRevealFxRef.current = false;
    forceDoneRef.current = true;

    if (!didRevealFxRef.current) {
      didRevealFxRef.current = true;
      // If we land naturally right before reveal, these still look fine.
      burst(particleCX, particleCY);
      emit(particleCX, particleCY, compact ? 10 : 15, 1.2, 275, 80);
      setShake(true);
      setSw(true);
      setTimeout(() => setShake(false), 380);
      setTimeout(() => setSw(false), 650);
    }
    // If still running, allow the RAF loop to hit done quickly
  }, [revealed, result, burst, emit, particleCX, particleCY, compact]);

  // Optional ambient particles once done
  useEffect(() => {
    if (!enableAmbient) return;
    if (!revealed && phase !== "done") return;
    const iv = setInterval(() => emit(particleCX, particleCY, compact ? 2 : 2, compact ? 0.15 : 0.15, 275, 60), 450);
    return () => clearInterval(iv);
  }, [enableAmbient, revealed, phase, emit, particleCX, particleCY, compact]);

  // Derived visuals
  const isTossing = phase === "tossing-PENTA" || phase === "tossing-PROTO";
  const chosenSide = side ?? "PENTA";
  const spinClass =
    phase === "tossing-PENTA" ? " wk-rb-spin-h" : phase === "tossing-PROTO" ? " wk-rb-spin-t" : "";
  const doneClass =
    phase === "done"
      ? chosenSide === "PENTA"
        ? " wk-rb-done-h"
        : " wk-rb-done-t"
      : "";

  const coinY = isTossing || phase === "done" ? yOff : 0;
  const shS = isTossing ? 0.12 + 0.88 * (1 - Math.min(1, Math.abs(yOff) / 340)) : 1;
  const shO = isTossing ? 0.04 + 0.31 * (1 - Math.min(1, Math.abs(yOff) / 340)) : 0.35;

  const glowPx = glow > 0.15 ? Math.round(6 + glow * 25) : 0;
  const glowFilter =
    glowPx > 0
      ? `drop-shadow(0 0 ${glowPx}px rgba(160,80,255,${(glow * 0.6).toFixed(2)}))`
      : "none";

  const dominionText = "DOMINION";
  const servitudeText = "SERVITUDE";

  return (
    <div
      style={{
        width: compact ? 220 : "100%",
        maxWidth: compact ? 220 : 380,
        height: compact ? Math.max(160, coinDiam + 70) : Math.max(420, coinDiam + 180),
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "'Georgia',serif",
        overflow: "hidden",
        animation: shake ? "wkRbShake .38s ease-out" : "none",
      }}
    >
      <style>{`
        .wk-rb-scene { perspective: 900px; width: ${scene}px; height: ${scene}px; }
        .wk-rb-coin {
          width: 100%; height: 100%; position: relative;
          transform-style: preserve-3d;
          will-change: transform;
          border-radius: 50%;
          box-shadow: 0 12px 48px rgba(0,0,0,0.65);
        }
        .wk-rb-face {
          position: absolute; width: 100%; height: 100%;
          border-radius: 50%; backface-visibility: hidden;
          -webkit-backface-visibility: hidden; overflow: hidden;
        }
        .wk-rb-back { transform: rotateY(180deg); }

        /* Toss spins — match GameScreen flip duration */
        .wk-rb-spin-h { animation: wkRbSpinH 5.15s cubic-bezier(.12,.55,.22,1) forwards; }
        @keyframes wkRbSpinH { from { transform: rotateY(0deg); } to { transform: rotateY(5040deg); } }
        .wk-rb-spin-t { animation: wkRbSpinT 5.15s cubic-bezier(.12,.55,.22,1) forwards; }
        @keyframes wkRbSpinT { from { transform: rotateY(0deg); } to { transform: rotateY(5220deg); } }

        /* Done: hold final face */
        .wk-rb-done-h { transform: rotateY(0deg); }
        .wk-rb-done-t { transform: rotateY(180deg); }

        @keyframes wkRbShake{
          0% { transform: translate(0,0); }
          8% { transform: translate(-6px,3px); }
          18% { transform: translate(5px,-5px); }
          28% { transform: translate(-4px,2px); }
          40% { transform: translate(3px,-2px); }
          55% { transform: translate(-2px,1px); }
          75% { transform: translate(1px,-0.5px); }
          100% { transform: translate(0,0); }
        }
        @keyframes wkRbSw{
          0% { transform: translate(-50%,-50%) scale(0); opacity:.8; }
          35% { opacity:.4; }
          100% { transform: translate(-50%,-50%) scale(1); opacity:0; }
        }
        @keyframes wkRbFi{from{opacity:0;transform:translateY(16px) scale(.88)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes wkRbGlow{
          0%,100%{text-shadow:0 0 20px rgba(160,80,255,.5),0 2px 8px rgba(0,0,0,.8)}
          50%{text-shadow:0 0 45px rgba(160,80,255,.9),0 0 80px rgba(120,40,220,.3),0 2px 8px rgba(0,0,0,.8)}
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      {/* Shadow */}
      <div
        style={{
          position: "absolute",
          bottom: compact ? 18 : 58,
          width: compact ? 130 : 170,
          height: compact ? 18 : 28,
          borderRadius: "50%",
          background: "radial-gradient(ellipse,rgba(120,40,200,.35) 0%,transparent 70%)",
          transform: `scale(${shS})`,
          opacity: shO,
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {sw && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: compact ? "69%" : "72%",
            width: compact ? 150 : 260,
            height: compact ? 42 : 80,
            borderRadius: "50%",
            border: `2.5px solid rgba(160,80,255,.5)`,
            animation: "wkRbSw .65s ease-out forwards",
            zIndex: 15,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          transform: `translateY(${coinY}px) scale(${scl})`,
          transformOrigin: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 10,
          filter: glowFilter,
        }}
      >
        <div className="wk-rb-scene">
          <div
            key={spinKey}
            className={`wk-rb-coin${spinClass}${doneClass}`}
          >
            <div className="wk-rb-face">
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                <defs>
                  <radialGradient id={`${gid}-wk-rb-fg`} cx="48%" cy="42%" r="58%">
                    <stop offset="0%" stopColor="#2a1a3a" />
                    <stop offset="40%" stopColor="#1a0e28" />
                    <stop offset="80%" stopColor="#0e0618" />
                    <stop offset="100%" stopColor="#06020c" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-rb-sk`} cx="50%" cy="38%" r="48%">
                    <stop offset="0%" stopColor="#e8ddd0" />
                    <stop offset="50%" stopColor="#c0b0a0" />
                    <stop offset="100%" stopColor="#807060" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-rb-gem`} cx="40%" cy="35%" r="55%">
                    <stop offset="0%" stopColor="#dd88ff" />
                    <stop offset="50%" stopColor="#9944cc" />
                    <stop offset="100%" stopColor="#441166" />
                  </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="97" fill={`url(#${gid}-wk-rb-fg)`} stroke="#8855bb" strokeWidth="3" />
                <circle cx="100" cy="100" r="89" fill="none" stroke="rgba(140,80,200,.25)" strokeWidth="1" />
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(100,50,160,.15)" strokeWidth="0.5" />

                {/* Crown */}
                <path
                  d="M60,60 L63,38 L74,52 L82,30 L92,54 L100,26 L108,54 L118,30 L126,52 L137,38 L140,60Z"
                  fill="#c4a030"
                  stroke="#e0c050"
                  strokeWidth="1.2"
                />
                <line x1="60" y1="60" x2="140" y2="60" stroke="#d4b040" strokeWidth="2.5" />
                {/* Crown gems */}
                <circle cx="82" cy="36" r="3" fill={`url(#${gid}-wk-rb-gem)`} stroke="#8844bb" strokeWidth="0.5" />
                <circle cx="100" cy="32" r="4" fill={`url(#${gid}-wk-rb-gem)`} stroke="#8844bb" strokeWidth="0.5" />
                <circle cx="118" cy="36" r="3" fill={`url(#${gid}-wk-rb-gem)`} stroke="#8844bb" strokeWidth="0.5" />

                {/* Skull */}
                <path
                  d="M67,78 Q67,58 100,52 Q133,58 133,78 L133,100 Q130,115 118,120 Q108,124 100,126 Q92,124 82,120 Q70,115 67,100Z"
                  fill={`url(#${gid}-wk-rb-sk)`}
                  stroke="#a09080"
                  strokeWidth="1.2"
                />
                {/* Eye sockets */}
                <ellipse cx="86" cy="84" rx="11" ry="12" fill="#0e0618" stroke="#605050" strokeWidth="0.8" />
                <ellipse cx="114" cy="84" rx="11" ry="12" fill="#0e0618" stroke="#605050" strokeWidth="0.8" />
                {/* Amethyst eyes */}
                <ellipse cx="86" cy="84" rx="6" ry="7" fill={`url(#${gid}-wk-rb-gem)`} opacity="0.85" />
                <ellipse cx="114" cy="84" rx="6" ry="7" fill={`url(#${gid}-wk-rb-gem)`} opacity="0.85" />

                {/* Minimal rim ornaments */}
                <circle cx="100" cy="12" r="2.5" fill="#8855bb" opacity="0.5" />
                <circle cx="100" cy="188" r="2.5" fill="#8855bb" opacity="0.5" />
              </svg>
            </div>

            <div className="wk-rb-face wk-rb-back">
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                <defs>
                  <radialGradient id={`${gid}-wk-rb-bg`} cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#221232" />
                    <stop offset="40%" stopColor="#160a24" />
                    <stop offset="80%" stopColor="#0a0414" />
                    <stop offset="100%" stopColor="#040208" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-rb-portal`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#cc88ff" />
                    <stop offset="30%" stopColor="#7733bb" />
                    <stop offset="70%" stopColor="#331166" />
                    <stop offset="100%" stopColor="#0a0414" />
                  </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="97" fill={`url(#${gid}-wk-rb-bg)`} stroke="#8855bb" strokeWidth="3" />
                {/* Portal */}
                <circle cx="100" cy="100" r="35" fill={`url(#${gid}-wk-rb-portal)`} opacity="0.7" />
                <circle cx="100" cy="100" r="28" fill="none" stroke="rgba(180,120,255,.3)" strokeWidth="0.8" />
                <circle cx="100" cy="100" r="10" fill="#06020c" />
                {/* Chains crossing (simplified) */}
                <g stroke="#a090b0" strokeWidth="2.8" fill="none" strokeLinecap="round">
                  <path d="M30,30 Q42,38 48,48" />
                  <path d="M170,30 Q158,38 152,48" />
                  <path d="M30,170 Q40,160 48,152" />
                  <path d="M170,170 Q160,160 152,152" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {showOutcomeText && revealed && result && (
          <div style={{ marginTop: 26, animation: "wkRbFi .65s ease-out", transformOrigin: "center top" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 8,
                color: dominion ? "#cc88ff" : "#88aadd",
                animation: "wkRbGlow 2.2s ease-in-out infinite",
                textAlign: "center",
              }}
            >
              {dominion ? dominionText : servitudeText}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: winCol, marginTop: 6, letterSpacing: "0.12em", textAlign: "center" }}>
              {dominion ? p1Name : p2Name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type PreviewProps = {
  coinDiam?: number;
  compact?: boolean;
};

export function WraithKingCoinTossPreview({ coinDiam = 70, compact = true }: PreviewProps) {
  const [cycle, setCycle] = useState(0);
  const [pending, setPending] = useState<Face>("PENTA");

  useEffect(() => {
    const iv = setInterval(() => {
      setPending(Math.random() < 0.5 ? "PENTA" : "PROTO");
      setCycle((c) => c + 1);
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  return (
    <WraithKingCoinToss
      key={cycle}
      revealed={false}
      result={null}
      pendingForSpin={pending}
      coinDiam={coinDiam}
      compact={compact}
      autostart={true}
      enableAmbient={false}
      showOutcomeText={false}
    />
  );
}

