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

type ParticleKind = "wisp" | "soul" | "chain";

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
  kind?: ParticleKind;
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

  const scene = 190;
  const scale = useMemo(() => coinDiam / scene, [coinDiam]);

  const revType = (result ?? side ?? "PENTA") as Face;
  const dominion = revType === "PENTA";

  // --- Spectral particle emitters ---
  const emit = useCallback(
    (cx: number, cy: number, n: number, pow = 1, hue = 275, sat = 80) => {
      for (let i = 0; i < n; i++) {
        const kind: ParticleKind = "wisp";
        parts.current.push({
          x: cx + (Math.random() - 0.5) * 50,
          y: cy + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 1.5 * pow,
          vy: -(Math.random() * 1.5 + 0.5) * pow,
          g: -0.012 - Math.random() * 0.008,
          life: 1,
          d: 0.003 + Math.random() * 0.002,
          size: Math.random() * 7 + 5,
          sh: 0.998,
          h: hue + Math.random() * 30 - 10,
          sat,
          a: 0.7 + Math.random() * 0.2,
          kind,
        });
      }
    },
    []
  );

  const burst = useCallback((cx: number, cy: number) => {
    // wisps
    for (let i = 0; i < 30; i++) {
      const ang = (i / 30) * Math.PI * 2;
      const spd = 0.8 + Math.random() * 2.5;
      parts.current.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 15,
        vx: Math.cos(ang) * spd * 0.6,
        vy: -Math.random() * 2 - 0.5,
        g: -0.015,
        life: 1,
        d: 0.004 + Math.random() * 0.003,
        size: 5 + Math.random() * 7,
        sh: 0.998,
        h: 270 + Math.random() * 30,
        sat: 75 + Math.random() * 20,
        a: 0.8,
        kind: "wisp",
      });
    }
    // souls — quick upward
    for (let i = 0; i < 20; i++) {
      parts.current.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -Math.random() * 6 - 2,
        g: 0.04,
        life: 1,
        d: 0.018 + Math.random() * 0.012,
        size: 2 + Math.random() * 2,
        sh: 0.985,
        h: 280 + Math.random() * 30,
        sat: 85 + Math.random() * 15,
        a: 0.9,
        kind: "soul",
      });
    }
    // chains — lateral scatter
    for (let i = 0; i < 10; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      parts.current.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy,
        vx: dir * (3 + Math.random() * 4),
        vy: -(Math.random() * 2 + 0.5),
        g: 0.12,
        life: 1,
        d: 0.022 + Math.random() * 0.01,
        size: 3 + Math.random() * 3,
        sh: 0.978,
        h: 250,
        sat: 20 + Math.random() * 20,
        a: 0.6,
        kind: "chain",
      });
    }
  }, []);

  // Particle canvas loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: true, willReadFrequently: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = particleW * 2 * dpr;
    c.height = particleH * 2 * dpr;
    c.style.width = `${particleW}px`;
    c.style.height = `${particleH}px`;

    ctx.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0);

    const draw = () => {
      const shouldRun =
        parts.current.length > 0 ||
        phase === "tossing-PENTA" ||
        phase === "tossing-PROTO" ||
        (enableAmbient && (revealed || phase === "done"));
      if (!shouldRun) {
        pRaf.current = null;
        return;
      }
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

        ctx.globalCompositeOperation = p.kind === "chain" ? "source-over" : "screen";
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        const brightness = p.kind === "soul" ? Math.round(70 + p.life * 25) : Math.round(50 + p.life * 25);
        gr.addColorStop(
          0,
          `hsla(${p.h},${p.sat}%,${brightness}%,${(p.life * p.a).toFixed(3)})`
        );
        gr.addColorStop(
          0.55,
          `hsla(${p.h + 10},${p.sat}%,35%,${(p.life * p.a * 0.4).toFixed(3)})`
        );
        gr.addColorStop(1, `hsla(${p.h},40%,15%,0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      pRaf.current = requestAnimationFrame(draw);
    };

    if (!pRaf.current) draw();
    return () => {
      if (pRaf.current) cancelAnimationFrame(pRaf.current);
    };
  }, [particleW, particleH, phase, enableAmbient, revealed]);

  // Start toss automatically
  const startToss = useCallback(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;

    const chosen: Face = pendingForSpin ?? (Math.random() > 0.5 ? "PENTA" : "PROTO");
    setSide(chosen);
    setShake(false);
    setSw(false);
    setGlow(1);

    setPhase(`tossing-${chosen}`);
    setSpinKey((k) => k + 1);

    const WK_INIT_VEL   = -30;
    const WK_GRAVITY    = 0.33;
    const WK_COR        = 0.58;
    const WK_MIN_BOUNCE = 2.2;

    let posY = 0;
    let velY = WK_INIT_VEL;
    let bounceN = 0;
    let settled = false;
    let settleTime = 0;
    let lastE = 0;
    const CX = particleCX;

    emit(CX, particleCY, compact ? 8 : 22, compact ? 1.1 : 1.6, 275, 80);

    let lastPaint = 0;
    const step = (now: number) => {
      const rawDelta = lastPaint > 0 ? now - lastPaint : 16.667;
      const dt = Math.min(rawDelta, 100) / 16.667;
      lastPaint = now;

      if (forceDoneRef.current && !settled) {
        settled = true; settleTime = now;
        velY = 0; posY = 0;
        setYOff(0); setGlow(0); setPhase("done");
        raf.current = requestAnimationFrame(step);
        return;
      }

      if (settled) {
        const st = Math.min(1, (now - settleTime) / 500);
        setScl(1 + Math.sin(st * Math.PI * 4) * (1 - st) * 0.07);
        if (st >= 1) {
          setScl(1); setPhase("done");
          emit(CX, particleCY - 25, compact ? 6 : 12, 0.35, 275, 70);
          raf.current = null;
          return;
        }
        raf.current = requestAnimationFrame(step);
        return;
      }

      velY += WK_GRAVITY * dt;
      posY += velY * dt;

      const heightFrac = Math.min(1, Math.abs(posY) / 280);
      const nextScl  = 1 - heightFrac * 0.08;
      const nextGlow = Math.max(0, 1 - heightFrac * 0.5);

      if (posY < -30 && now - lastE > 38) {
        emit(CX, particleCY + posY + 100, compact ? 1 : 2, 0.5, 275, 75);
        lastE = now;
      }

      if (posY >= 0 && velY > 0) {
        posY = 0;
        const impactVel = Math.abs(velY);
        const nextVel   = impactVel * WK_COR;
        if (nextVel < WK_MIN_BOUNCE) {
          settled = true; settleTime = now; velY = 0; posY = 0; setGlow(0);
        } else {
          velY = -nextVel;
          const impactPow = Math.min(impactVel / 12, 1.4);
          if (bounceN === 0) {
            burst(CX, particleCY);
            emit(CX, particleCY, compact ? 8 : 20, impactPow * 1.2, 275, 80);
            setShake(true); setSw(true);
            setTimeout(() => setShake(false), 380);
            setTimeout(() => setSw(false), 650);
          } else {
            emit(CX, particleCY, compact ? 3 : 6, impactPow * 0.7, 275, 75);
          }
          bounceN++;
        }
      }

      setScl(nextScl); setGlow(nextGlow); setYOff(posY);
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
  }, [compact, emit, burst, pendingForSpin, particleCX, particleCY]);

  useEffect(() => {
    if (!autostart) return;
    if (phase !== "idle") return;
    startToss();
  }, [autostart, phase, startToss]);

  const didRevealFxRef = useRef(false);
  useEffect(() => {
    if (!revealed || !result) return;

    setSide(result);
    didRevealFxRef.current = false;
    forceDoneRef.current = true;

    if (!didRevealFxRef.current) {
      didRevealFxRef.current = true;
      burst(particleCX, particleCY);
      emit(particleCX, particleCY, compact ? 10 : 15, 1.2, 275, 80);
      setShake(true);
      setSw(true);
      setTimeout(() => setShake(false), 380);
      setTimeout(() => setSw(false), 650);
    }
  }, [revealed, result, burst, emit, particleCX, particleCY, compact]);

  useEffect(() => {
    if (!enableAmbient) return;
    if (!revealed && phase !== "done") return;
    const iv = setInterval(
      () => emit(particleCX, particleCY, compact ? 1 : 1, compact ? 0.15 : 0.15, 285, 60),
      600
    );
    return () => clearInterval(iv);
  }, [enableAmbient, revealed, phase, emit, particleCX, particleCY, compact]);

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
      ? `drop-shadow(0 0 ${glowPx}px rgba(160,80,255,${(glow * 0.6).toFixed(2)})) drop-shadow(0 0 ${Math.round(glowPx * 1.8)}px rgba(100,20,200,${(glow * 0.24).toFixed(2)}))`
      : "none";

  const dominionText = "DOMINION";
  const servitudeText = "SERVITUDE";

  // Precompute rim diamonds
  const rimDiamonds = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const r = 95.5;
    const cx = 100 + Math.cos(angle) * r;
    const cy = 100 + Math.sin(angle) * r;
    const s = 2.2;
    const perpX = -Math.sin(angle) * s;
    const perpY = Math.cos(angle) * s;
    const fwdX = Math.cos(angle) * s;
    const fwdY = Math.sin(angle) * s;
    return { cx, cy, perpX, perpY, fwdX, fwdY, key: i };
  });

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

        .wk-rb-spin-h { animation: wkRbSpinH 5.15s cubic-bezier(0.05, 0.7, 0.98, 1) forwards; }
        @keyframes wkRbSpinH { from { transform: rotateY(0deg); } to { transform: rotateY(5040deg); } }
        .wk-rb-spin-t { animation: wkRbSpinT 5.15s cubic-bezier(0.05, 0.7, 0.98, 1) forwards; }
        @keyframes wkRbSpinT { from { transform: rotateY(0deg); } to { transform: rotateY(5220deg); } }

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
            {/* ====== PENTA FACE — DOMINION / THE CROWNED SKULL ====== */}
            <div className="wk-rb-face">
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                <defs>
                  {/* Main background */}
                  <radialGradient id={`${gid}-wk-bg`} cx="50%" cy="40%" r="58%">
                    <stop offset="0%" stopColor="#1e0835" />
                    <stop offset="25%" stopColor="#120520" />
                    <stop offset="60%" stopColor="#080218" />
                    <stop offset="100%" stopColor="#020108" />
                  </radialGradient>
                  {/* Secondary inner accent */}
                  <radialGradient id={`${gid}-wk-bg2`} cx="45%" cy="35%" r="30%">
                    <stop offset="0%" stopColor="#6622aa" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#6622aa" stopOpacity="0" />
                  </radialGradient>
                  {/* Skull gradient */}
                  <radialGradient id={`${gid}-wk-sk`} cx="48%" cy="38%" r="52%">
                    <stop offset="0%" stopColor="#f0e8d8" />
                    <stop offset="30%" stopColor="#d4c8b4" />
                    <stop offset="65%" stopColor="#b0a090" />
                    <stop offset="100%" stopColor="#887060" />
                  </radialGradient>
                  {/* Crown bar gradient */}
                  <linearGradient id={`${gid}-wk-crown`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c89020" />
                    <stop offset="50%" stopColor="#f0c040" />
                    <stop offset="100%" stopColor="#c89020" />
                  </linearGradient>
                  {/* Gem gradient */}
                  <radialGradient id={`${gid}-wk-gem`} cx="35%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="20%" stopColor="#ee88ff" />
                    <stop offset="55%" stopColor="#9933cc" />
                    <stop offset="100%" stopColor="#440066" />
                  </radialGradient>
                  {/* Iris gradient */}
                  <radialGradient id={`${gid}-wk-iris`} cx="40%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="15%" stopColor="#ee88ff" />
                    <stop offset="50%" stopColor="#aa44dd" />
                    <stop offset="100%" stopColor="#550088" />
                  </radialGradient>
                </defs>

                {/* Base coin disc */}
                <circle cx="100" cy="100" r="99" fill={`url(#${gid}-wk-bg)`} />
                <circle cx="100" cy="100" r="99" fill={`url(#${gid}-wk-bg2)`} />

                {/* Ornate rim — layered */}
                <circle cx="100" cy="100" r="97" fill="none" stroke="#7722bb" strokeWidth="4.5" />
                <circle cx="100" cy="100" r="94" fill="none" stroke="#cc8822" strokeWidth="1" opacity="0.85" />
                <circle cx="100" cy="100" r="91" fill="none" stroke="#440088" strokeWidth="0.7" opacity="0.4" />

                {/* 16 rim diamonds */}
                {rimDiamonds.map(({ cx, cy, perpX, perpY, fwdX, fwdY, key }) => (
                  <polygon
                    key={key}
                    points={`${(cx + fwdX).toFixed(2)},${(cy + fwdY).toFixed(2)} ${(cx + perpX).toFixed(2)},${(cy + perpY).toFixed(2)} ${(cx - fwdX).toFixed(2)},${(cy - fwdY).toFixed(2)} ${(cx - perpX).toFixed(2)},${(cy - perpY).toFixed(2)}`}
                    fill="#cc8822"
                    opacity="0.85"
                  />
                ))}

                {/* Crown base bar */}
                <line x1="48" y1="72" x2="152" y2="72" stroke="#d4a030" strokeWidth="3.5" />
                <rect x="48" y="69" width="104" height="6" rx="2" fill={`url(#${gid}-wk-crown)`} />

                {/* Left short prong */}
                <path d="M58,72 L54,56 L64,56 L62,48 L68,42 L74,48 L72,56 L78,56 L76,72" fill="#d4a030" stroke="#f0c050" strokeWidth="1" />
                {/* Left tall prong */}
                <path d="M74,72 L70,52 L76,52 L74,44 L78,35 L82,35 L86,26 L90,35 L94,35 L92,44 L90,52 L96,52 L94,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.2" />
                {/* Center tallest prong */}
                <path d="M88,72 L84,48 L88,48 L86,38 L90,28 L94,22 L100,16 L106,22 L110,28 L114,38 L112,48 L116,48 L112,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.5" />
                {/* Right tall prong (mirror of left tall) */}
                <path d="M126,72 L130,52 L124,52 L126,44 L122,35 L118,35 L114,26 L110,35 L106,35 L108,44 L110,52 L104,52 L106,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.2" />
                {/* Right short prong (mirror of left short) */}
                <path d="M142,72 L146,56 L136,56 L138,48 L132,42 L126,48 L128,56 L122,56 L124,72" fill="#d4a030" stroke="#f0c050" strokeWidth="1" />

                {/* Crown gem glows */}
                <ellipse cx="82" cy="38" rx="9" ry="10.5" fill="none" stroke="#cc66ff" strokeWidth="3" opacity="0.3" />
                <ellipse cx="100" cy="28" rx="10.5" ry="12" fill="none" stroke="#cc66ff" strokeWidth="3" opacity="0.3" />
                <ellipse cx="118" cy="38" rx="9" ry="10.5" fill="none" stroke="#cc66ff" strokeWidth="3" opacity="0.3" />

                {/* Crown gems */}
                <ellipse cx="82" cy="38" rx="5" ry="6.5" fill={`url(#${gid}-wk-gem)`} stroke="#cc66ff" strokeWidth="0.8" />
                <ellipse cx="100" cy="28" rx="6.5" ry="8" fill={`url(#${gid}-wk-gem)`} stroke="#cc66ff" strokeWidth="1" />
                <ellipse cx="118" cy="38" rx="5" ry="6.5" fill={`url(#${gid}-wk-gem)`} stroke="#cc66ff" strokeWidth="0.8" />

                {/* Gem highlights */}
                <ellipse cx="79.5" cy="35" rx="2" ry="1.5" fill="white" opacity="0.8" />
                <ellipse cx="97.5" cy="24.5" rx="2.5" ry="1.8" fill="white" opacity="0.8" />
                <ellipse cx="115.5" cy="35" rx="2" ry="1.5" fill="white" opacity="0.8" />

                {/* ---- SKULL ---- */}
                {/* Cranium */}
                <path d="M64,76 Q60,62 62,54 Q68,36 100,30 Q132,36 138,54 Q140,62 136,76 Z" fill={`url(#${gid}-wk-sk)`} stroke="#a09080" strokeWidth="1.2" />
                {/* Cheekbones */}
                <path d="M64,96 Q62,88 66,84 Q70,80 74,82" stroke="#a09080" strokeWidth="2" fill="none" opacity="0.7" />
                <path d="M136,96 Q138,88 134,84 Q130,80 126,82" stroke="#a09080" strokeWidth="2" fill="none" opacity="0.7" />
                {/* Jaw */}
                <path d="M72,118 Q70,130 74,140 Q84,152 100,156 Q116,152 126,140 Q130,130 128,118 Z" fill={`url(#${gid}-wk-sk)`} stroke="#a09080" strokeWidth="1.1" />
                {/* Join skull base to jaw */}
                <path d="M64,76 L72,118 M136,76 L128,118" stroke="#a09080" strokeWidth="1" fill="none" opacity="0.5" />

                {/* Cranial suture lines */}
                <path d="M100,32 Q97,45 99,58 Q100,65 100,76" stroke="#c0b0a0" strokeWidth="0.6" fill="none" opacity="0.35" />
                <path d="M72,45 Q82,52 90,60 Q95,65 98,72" stroke="#c0b0a0" strokeWidth="0.5" fill="none" opacity="0.3" />
                <path d="M128,45 Q118,52 110,60 Q105,65 102,72" stroke="#c0b0a0" strokeWidth="0.5" fill="none" opacity="0.3" />

                {/* Nasal cavity */}
                <path d="M96,108 L100,103 L104,108 L102,116 Q100,120 98,116 Z" fill="#2a1030" />

                {/* Teeth */}
                <rect x="78" y="140" width="8" height="12" rx="2" fill="#e8e0d0" stroke="#b0a890" strokeWidth="0.5" />
                <rect x="87" y="142" width="7" height="11" rx="2" fill="#eae2d2" stroke="#b0a890" strokeWidth="0.5" />
                <rect x="95" y="143" width="10" height="10" rx="2" fill="#ece4d4" stroke="#b0a890" strokeWidth="0.5" />
                <rect x="106" y="142" width="7" height="11" rx="2" fill="#eae2d2" stroke="#b0a890" strokeWidth="0.5" />
                <rect x="114" y="140" width="8" height="12" rx="2" fill="#e8e0d0" stroke="#b0a890" strokeWidth="0.5" />

                {/* Eye socket voids */}
                <ellipse cx="83" cy="88" rx="14" ry="16" fill="#0a0418" stroke="#706050" strokeWidth="1" />
                <ellipse cx="117" cy="88" rx="14" ry="16" fill="#0a0418" stroke="#706050" strokeWidth="1" />

                {/* Brow ridges */}
                <path d="M68,74 Q83,70 98,74" stroke="#b0a090" strokeWidth="2" fill="none" opacity="0.8" />
                <path d="M102,74 Q117,70 132,74" stroke="#b0a090" strokeWidth="2" fill="none" opacity="0.8" />

                {/* Eye animated glow rings */}
                <ellipse cx="83" cy="88" rx="12" ry="13" fill="none" stroke="#9933cc" strokeWidth="1.5" opacity="0.4">
                  <animate attributeName="opacity" values="0.4;0.9;0.2;0.7;0.4" dur="2.8s" repeatCount="indefinite" />
                  <animate attributeName="rx" values="12;14;12;13;12" dur="2.8s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="117" cy="88" rx="12" ry="13" fill="none" stroke="#9933cc" strokeWidth="1.5" opacity="0.4">
                  <animate attributeName="opacity" values="0.4;0.9;0.2;0.7;0.4" dur="2.8s" repeatCount="indefinite" />
                  <animate attributeName="rx" values="12;14;12;13;12" dur="2.8s" repeatCount="indefinite" />
                </ellipse>

                {/* Iris */}
                <ellipse cx="83" cy="88" rx="10" ry="11" fill={`url(#${gid}-wk-iris)`} />
                <ellipse cx="117" cy="88" rx="10" ry="11" fill={`url(#${gid}-wk-iris)`} />
                {/* Iris inner ring */}
                <ellipse cx="83" cy="88" rx="7" ry="8" fill="none" stroke="#cc66ff" strokeWidth="0.8" opacity="0.6" />
                <ellipse cx="117" cy="88" rx="7" ry="8" fill="none" stroke="#cc66ff" strokeWidth="0.8" opacity="0.6" />
                {/* Pupils */}
                <ellipse cx="83" cy="88" rx="4.5" ry="5" fill="#010008" />
                <ellipse cx="117" cy="88" rx="4.5" ry="5" fill="#010008" />
                {/* Iris highlights */}
                <ellipse cx="80" cy="84.5" rx="2.5" ry="1.8" fill="white" opacity="0.75" />
                <ellipse cx="114" cy="84.5" rx="2.5" ry="1.8" fill="white" opacity="0.75" />

                {/* 4 rune circles near rim at 45° angles */}
                {[45, 135, 225, 315].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  const rx = 100 + Math.cos(rad) * 82;
                  const ry = 100 + Math.sin(rad) * 82;
                  return (
                    <g key={deg} opacity="0.55">
                      <circle cx={rx} cy={ry} r="5" fill="none" stroke="#6622aa" strokeWidth="1" />
                      <line x1={rx - 4} y1={ry} x2={rx + 4} y2={ry} stroke="#8844cc" strokeWidth="0.7" />
                      <line x1={rx} y1={ry - 4} x2={rx} y2={ry + 4} stroke="#8844cc" strokeWidth="0.7" />
                      <circle cx={rx} cy={ry} r="1.2" fill="#8844cc" />
                    </g>
                  );
                })}

                {/* 8 bone/thorn marks at r=70 */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  const tx = 100 + Math.cos(rad) * 70;
                  const ty = 100 + Math.sin(rad) * 70;
                  const tip = { x: tx + Math.cos(rad) * 4, y: ty + Math.sin(rad) * 4 };
                  const l = { x: tx + Math.cos(rad + 1.6) * 3, y: ty + Math.sin(rad + 1.6) * 3 };
                  const r = { x: tx + Math.cos(rad - 1.6) * 3, y: ty + Math.sin(rad - 1.6) * 3 };
                  return (
                    <polygon
                      key={deg}
                      points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`}
                      fill="#887060"
                      opacity="0.5"
                    />
                  );
                })}
              </svg>
            </div>

            {/* ====== PROTO FACE — SERVITUDE / SOUL PORTAL ====== */}
            <div className="wk-rb-face wk-rb-back">
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                <defs>
                  <radialGradient id={`${gid}-wk-pbg`} cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#180428" />
                    <stop offset="30%" stopColor="#0c0218" />
                    <stop offset="65%" stopColor="#040110" />
                    <stop offset="100%" stopColor="#010008" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-portal`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.063" />
                    <stop offset="15%" stopColor="#cc66ff" stopOpacity="0.267" />
                    <stop offset="35%" stopColor="#7722bb" stopOpacity="1" />
                    <stop offset="60%" stopColor="#330055" stopOpacity="1" />
                    <stop offset="85%" stopColor="#0d0018" stopOpacity="1" />
                    <stop offset="100%" stopColor="#020006" stopOpacity="1" />
                  </radialGradient>
                  {/* Spectral haze gradients */}
                  <radialGradient id={`${gid}-wk-haze1`} cx="35%" cy="30%" r="45%">
                    <stop offset="0%" stopColor="#660088" stopOpacity="0.13" />
                    <stop offset="100%" stopColor="#660088" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-haze2`} cx="65%" cy="70%" r="40%">
                    <stop offset="0%" stopColor="#440066" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#440066" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id={`${gid}-wk-haze3`} cx="20%" cy="65%" r="35%">
                    <stop offset="0%" stopColor="#552299" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#552299" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Base coin disc */}
                <circle cx="100" cy="100" r="99" fill={`url(#${gid}-wk-pbg)`} />

                {/* Spectral hazes */}
                <ellipse cx="70" cy="60" rx="55" ry="45" fill={`url(#${gid}-wk-haze1)`} />
                <ellipse cx="130" cy="140" rx="50" ry="40" fill={`url(#${gid}-wk-haze2)`} />
                <ellipse cx="40" cy="130" rx="40" ry="35" fill={`url(#${gid}-wk-haze3)`} />

                {/* Same ornate rim */}
                <circle cx="100" cy="100" r="97" fill="none" stroke="#7722bb" strokeWidth="4.5" />
                <circle cx="100" cy="100" r="94" fill="none" stroke="#cc8822" strokeWidth="1" opacity="0.85" />
                <circle cx="100" cy="100" r="91" fill="none" stroke="#440088" strokeWidth="0.7" opacity="0.4" />
                {rimDiamonds.map(({ cx, cy, perpX, perpY, fwdX, fwdY, key }) => (
                  <polygon
                    key={key}
                    points={`${(cx + fwdX).toFixed(2)},${(cy + fwdY).toFixed(2)} ${(cx + perpX).toFixed(2)},${(cy + perpY).toFixed(2)} ${(cx - fwdX).toFixed(2)},${(cy - fwdY).toFixed(2)} ${(cx - perpX).toFixed(2)},${(cy - perpY).toFixed(2)}`}
                    fill="#cc8822"
                    opacity="0.85"
                  />
                ))}

                {/* Chains from corners converging toward portal */}
                <path d="M25,25 C50,50 75,75 88,90" stroke="#a090b8" strokeWidth="3.5" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.65" />
                <path d="M175,25 C150,50 125,75 112,90" stroke="#a090b8" strokeWidth="3.5" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.65" />
                <path d="M25,175 C50,150 75,125 88,112" stroke="#a090b8" strokeWidth="3.2" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.6" />
                <path d="M175,175 C150,150 125,125 112,112" stroke="#a090b8" strokeWidth="3.2" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.6" />

                {/* Portal outer glow rings (build up) */}
                <circle cx="100" cy="100" r="55" fill="none" stroke="#660088" strokeWidth="8" opacity="0.15" />
                <circle cx="100" cy="100" r="52" fill="none" stroke="#8833aa" strokeWidth="5" opacity="0.22" />
                <circle cx="100" cy="100" r="48" fill="none" stroke="#aa44cc" strokeWidth="3" opacity="0.4" />
                <circle cx="100" cy="100" r="44" fill="none" stroke="#cc66ff" strokeWidth="2" opacity="0.7" />
                <circle cx="100" cy="100" r="42" fill="none" stroke="#ee99ff" strokeWidth="1.5" opacity="0.95" />

                {/* Soul hands reaching from portal — top */}
                <g opacity="0.6">
                  <path d="M92,59 C88,48 84,40 86,32" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M100,58 C100,46 100,38 102,30" stroke="#9090b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M108,59 C112,48 116,40 114,32" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <animate attributeName="opacity" values="0.6;0.9;0.4;0.75;0.6" dur="3.5s" repeatCount="indefinite" />
                </g>
                {/* Bottom fingers */}
                <g opacity="0.55">
                  <path d="M92,141 C88,152 84,160 86,168" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M100,142 C100,154 100,162 102,170" stroke="#9090b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M108,141 C112,152 116,160 114,168" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <animate attributeName="opacity" values="0.55;0.8;0.35;0.65;0.55" dur="3.8s" repeatCount="indefinite" />
                </g>
                {/* Left fingers */}
                <g opacity="0.5">
                  <path d="M59,92 C48,88 40,84 32,86" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M58,100 C46,100 38,100 30,102" stroke="#9090b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M59,108 C48,112 40,116 32,114" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <animate attributeName="opacity" values="0.5;0.75;0.3;0.6;0.5" dur="4.1s" repeatCount="indefinite" />
                </g>
                {/* Right fingers */}
                <g opacity="0.5">
                  <path d="M141,92 C152,88 160,84 168,86" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M142,100 C154,100 162,100 170,102" stroke="#9090b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M141,108 C152,112 160,116 168,114" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <animate attributeName="opacity" values="0.5;0.75;0.3;0.6;0.5" dur="3.9s" repeatCount="indefinite" />
                </g>

                {/* Portal disc */}
                <circle cx="100" cy="100" r="41" fill={`url(#${gid}-wk-portal)`} />

                {/* Portal swirl rings */}
                <ellipse cx="100" cy="100" rx="30" ry="28" fill="none" stroke="#9933cc" strokeWidth="0.8" opacity="0.5" transform="rotate(15 100 100)">
                  <animateTransform attributeName="transform" type="rotate" from="15 100 100" to="375 100 100" dur="6s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="100" cy="100" rx="22" ry="20" fill="none" stroke="#7722aa" strokeWidth="0.7" opacity="0.45" transform="rotate(-20 100 100)">
                  <animateTransform attributeName="transform" type="rotate" from="-20 100 100" to="-380 100 100" dur="8s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="100" cy="100" rx="14" ry="12" fill="none" stroke="#bb44ee" strokeWidth="0.6" opacity="0.4" transform="rotate(5 100 100)">
                  <animateTransform attributeName="transform" type="rotate" from="5 100 100" to="365 100 100" dur="4s" repeatCount="indefinite" />
                </ellipse>

                {/* Singularity center */}
                <circle cx="100" cy="100" r="8" fill="#010004" />
                <circle cx="100" cy="100" r="6" fill="none" stroke="#cc66ff" strokeWidth="0.6" opacity="0.5" />
                <circle cx="100" cy="100" r="3" fill="white" opacity="0.6" />

                {/* Corner rune glyphs */}
                {/* Top-left: triangle + stem */}
                <g opacity="0.55" stroke="#9966cc" strokeWidth="1.5" fill="none">
                  <path d="M22,28 L32,28 L27,18 Z" />
                  <line x1="27" y1="28" x2="27" y2="34" />
                </g>
                {/* Top-right: circle with cross */}
                <g opacity="0.55" stroke="#9966cc" strokeWidth="1.5" fill="none">
                  <circle cx="173" cy="26" r="6" />
                  <line x1="167" y1="26" x2="179" y2="26" />
                  <line x1="173" y1="20" x2="173" y2="32" />
                </g>
                {/* Bottom-left: star/asterisk */}
                <g opacity="0.55" stroke="#9966cc" strokeWidth="1.5" fill="none">
                  <line x1="27" y1="167" x2="27" y2="179" />
                  <line x1="21" y1="170" x2="33" y2="176" />
                  <line x1="33" y1="170" x2="21" y2="176" />
                </g>
                {/* Bottom-right: diamond */}
                <g opacity="0.55" stroke="#9966cc" strokeWidth="1.5" fill="none">
                  <polygon points="173,167 179,173 173,179 167,173" />
                  <circle cx="173" cy="173" r="2" stroke="none" fill="#9966cc" opacity="0.6" />
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

// ── Static coin face (both sides) ─────────────────────────────────────────────
export function WraithKingCoinFace({ face, size = 56, uid }: { face: "PENTA" | "PROTO"; size?: number; uid: string }) {
  const gid = `wk-face-${uid}`;
  const rd = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2, r = 95.5, s = 2.2;
    return { cx: 100 + Math.cos(a) * r, cy: 100 + Math.sin(a) * r, perpX: -Math.sin(a) * s, perpY: Math.cos(a) * s, fwdX: Math.cos(a) * s, fwdY: Math.sin(a) * s, key: i };
  });
  if (face === "PENTA") return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ borderRadius: "50%", display: "block" }}>
      <defs>
        <radialGradient id={`${gid}-bg`} cx="50%" cy="40%" r="58%"><stop offset="0%" stopColor="#1e0835"/><stop offset="25%" stopColor="#120520"/><stop offset="60%" stopColor="#080218"/><stop offset="100%" stopColor="#020108"/></radialGradient>
        <radialGradient id={`${gid}-sk`} cx="48%" cy="38%" r="52%"><stop offset="0%" stopColor="#f0e8d8"/><stop offset="30%" stopColor="#d4c8b4"/><stop offset="65%" stopColor="#b0a090"/><stop offset="100%" stopColor="#887060"/></radialGradient>
        <linearGradient id={`${gid}-crown`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#c89020"/><stop offset="50%" stopColor="#f0c040"/><stop offset="100%" stopColor="#c89020"/></linearGradient>
        <radialGradient id={`${gid}-gem`} cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="20%" stopColor="#ee88ff"/><stop offset="55%" stopColor="#9933cc"/><stop offset="100%" stopColor="#440066"/></radialGradient>
        <radialGradient id={`${gid}-iris`} cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="15%" stopColor="#ee88ff"/><stop offset="50%" stopColor="#aa44dd"/><stop offset="100%" stopColor="#550088"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="99" fill={`url(#${gid}-bg)`}/>
      <circle cx="100" cy="100" r="97" fill="none" stroke="#7722bb" strokeWidth="4.5"/>
      <circle cx="100" cy="100" r="94" fill="none" stroke="#cc8822" strokeWidth="1" opacity="0.85"/>
      {rd.map(({cx,cy,perpX,perpY,fwdX,fwdY,key})=><polygon key={key} points={`${(cx+fwdX).toFixed(2)},${(cy+fwdY).toFixed(2)} ${(cx+perpX).toFixed(2)},${(cy+perpY).toFixed(2)} ${(cx-fwdX).toFixed(2)},${(cy-fwdY).toFixed(2)} ${(cx-perpX).toFixed(2)},${(cy-perpY).toFixed(2)}`} fill="#cc8822" opacity="0.85"/>)}
      <line x1="48" y1="72" x2="152" y2="72" stroke="#d4a030" strokeWidth="3.5"/>
      <rect x="48" y="69" width="104" height="6" rx="2" fill={`url(#${gid}-crown)`}/>
      <path d="M58,72 L54,56 L64,56 L62,48 L68,42 L74,48 L72,56 L78,56 L76,72" fill="#d4a030" stroke="#f0c050" strokeWidth="1"/>
      <path d="M74,72 L70,52 L76,52 L74,44 L78,35 L82,35 L86,26 L90,35 L94,35 L92,44 L90,52 L96,52 L94,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.2"/>
      <path d="M88,72 L84,48 L88,48 L86,38 L90,28 L94,22 L100,16 L106,22 L110,28 L114,38 L112,48 L116,48 L112,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.5"/>
      <path d="M126,72 L130,52 L124,52 L126,44 L122,35 L118,35 L114,26 L110,35 L106,35 L108,44 L110,52 L104,52 L106,72" fill="#c89020" stroke="#e8b040" strokeWidth="1.2"/>
      <path d="M142,72 L146,56 L136,56 L138,48 L132,42 L126,48 L128,56 L122,56 L124,72" fill="#d4a030" stroke="#f0c050" strokeWidth="1"/>
      <ellipse cx="82" cy="38" rx="5" ry="6.5" fill={`url(#${gid}-gem)`} stroke="#cc66ff" strokeWidth="0.8"/>
      <ellipse cx="100" cy="28" rx="6.5" ry="8" fill={`url(#${gid}-gem)`} stroke="#cc66ff" strokeWidth="1"/>
      <ellipse cx="118" cy="38" rx="5" ry="6.5" fill={`url(#${gid}-gem)`} stroke="#cc66ff" strokeWidth="0.8"/>
      <ellipse cx="79.5" cy="35" rx="2" ry="1.5" fill="white" opacity="0.8"/>
      <ellipse cx="97.5" cy="24.5" rx="2.5" ry="1.8" fill="white" opacity="0.8"/>
      <ellipse cx="115.5" cy="35" rx="2" ry="1.5" fill="white" opacity="0.8"/>
      <path d="M64,76 Q60,62 62,54 Q68,36 100,30 Q132,36 138,54 Q140,62 136,76 Z" fill={`url(#${gid}-sk)`} stroke="#a09080" strokeWidth="1.2"/>
      <path d="M72,118 Q70,130 74,140 Q84,152 100,156 Q116,152 126,140 Q130,130 128,118 Z" fill={`url(#${gid}-sk)`} stroke="#a09080" strokeWidth="1.1"/>
      <path d="M64,76 L72,118 M136,76 L128,118" stroke="#a09080" strokeWidth="1" fill="none" opacity="0.5"/>
      <path d="M96,108 L100,103 L104,108 L102,116 Q100,120 98,116 Z" fill="#2a1030"/>
      <rect x="78" y="140" width="8" height="12" rx="2" fill="#e8e0d0" stroke="#b0a890" strokeWidth="0.5"/>
      <rect x="87" y="142" width="7" height="11" rx="2" fill="#eae2d2" stroke="#b0a890" strokeWidth="0.5"/>
      <rect x="95" y="143" width="10" height="10" rx="2" fill="#ece4d4" stroke="#b0a890" strokeWidth="0.5"/>
      <rect x="106" y="142" width="7" height="11" rx="2" fill="#eae2d2" stroke="#b0a890" strokeWidth="0.5"/>
      <rect x="114" y="140" width="8" height="12" rx="2" fill="#e8e0d0" stroke="#b0a890" strokeWidth="0.5"/>
      <ellipse cx="83" cy="88" rx="14" ry="16" fill="#0a0418" stroke="#706050" strokeWidth="1"/>
      <ellipse cx="117" cy="88" rx="14" ry="16" fill="#0a0418" stroke="#706050" strokeWidth="1"/>
      <path d="M68,74 Q83,70 98,74" stroke="#b0a090" strokeWidth="2" fill="none" opacity="0.8"/>
      <path d="M102,74 Q117,70 132,74" stroke="#b0a090" strokeWidth="2" fill="none" opacity="0.8"/>
      <ellipse cx="83" cy="88" rx="10" ry="11" fill={`url(#${gid}-iris)`}/>
      <ellipse cx="117" cy="88" rx="10" ry="11" fill={`url(#${gid}-iris)`}/>
      <ellipse cx="83" cy="88" rx="4.5" ry="5" fill="#010008"/>
      <ellipse cx="117" cy="88" rx="4.5" ry="5" fill="#010008"/>
      <ellipse cx="80" cy="84.5" rx="2.5" ry="1.8" fill="white" opacity="0.75"/>
      <ellipse cx="114" cy="84.5" rx="2.5" ry="1.8" fill="white" opacity="0.75"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ borderRadius: "50%", display: "block" }}>
      <defs>
        <radialGradient id={`${gid}-pbg`} cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#180428"/><stop offset="30%" stopColor="#0c0218"/><stop offset="65%" stopColor="#040110"/><stop offset="100%" stopColor="#010008"/></radialGradient>
        <radialGradient id={`${gid}-portal`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.063"/><stop offset="15%" stopColor="#cc66ff" stopOpacity="0.267"/><stop offset="35%" stopColor="#7722bb"/><stop offset="60%" stopColor="#330055"/><stop offset="85%" stopColor="#0d0018"/><stop offset="100%" stopColor="#020006"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="99" fill={`url(#${gid}-pbg)`}/>
      <circle cx="100" cy="100" r="97" fill="none" stroke="#7722bb" strokeWidth="4.5"/>
      <circle cx="100" cy="100" r="94" fill="none" stroke="#cc8822" strokeWidth="1" opacity="0.85"/>
      {rd.map(({cx,cy,perpX,perpY,fwdX,fwdY,key})=><polygon key={key} points={`${(cx+fwdX).toFixed(2)},${(cy+fwdY).toFixed(2)} ${(cx+perpX).toFixed(2)},${(cy+perpY).toFixed(2)} ${(cx-fwdX).toFixed(2)},${(cy-fwdY).toFixed(2)} ${(cx-perpX).toFixed(2)},${(cy-perpY).toFixed(2)}`} fill="#cc8822" opacity="0.85"/>)}
      <path d="M25,25 C50,50 75,75 88,90" stroke="#a090b8" strokeWidth="3.5" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.65"/>
      <path d="M175,25 C150,50 125,75 112,90" stroke="#a090b8" strokeWidth="3.5" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.65"/>
      <path d="M25,175 C50,150 75,125 88,112" stroke="#a090b8" strokeWidth="3.2" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.6"/>
      <path d="M175,175 C150,150 125,125 112,112" stroke="#a090b8" strokeWidth="3.2" fill="none" strokeDasharray="8,4" strokeLinecap="round" opacity="0.6"/>
      <circle cx="100" cy="100" r="55" fill="none" stroke="#660088" strokeWidth="8" opacity="0.15"/>
      <circle cx="100" cy="100" r="52" fill="none" stroke="#8833aa" strokeWidth="5" opacity="0.22"/>
      <circle cx="100" cy="100" r="48" fill="none" stroke="#aa44cc" strokeWidth="3" opacity="0.4"/>
      <circle cx="100" cy="100" r="44" fill="none" stroke="#cc66ff" strokeWidth="2" opacity="0.7"/>
      <circle cx="100" cy="100" r="42" fill="none" stroke="#ee99ff" strokeWidth="1.5" opacity="0.95"/>
      <circle cx="100" cy="100" r="41" fill={`url(#${gid}-portal)`}/>
      <circle cx="100" cy="100" r="8" fill="#010004"/>
      <circle cx="100" cy="100" r="3" fill="white" opacity="0.6"/>
      <g opacity="0.6" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M92,59 C88,48 84,40 86,32"/><path d="M100,58 C100,46 100,38 102,30"/><path d="M108,59 C112,48 116,40 114,32"/>
      </g>
      <g opacity="0.55" stroke="#8888aa" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M92,141 C88,152 84,160 86,168"/><path d="M100,142 C100,154 100,162 102,170"/><path d="M108,141 C112,152 116,160 114,168"/>
      </g>
    </svg>
  );
}

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
