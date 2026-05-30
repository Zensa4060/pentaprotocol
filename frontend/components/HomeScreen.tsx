"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { getRank, NavRankBadge } from "./NavBar";
import FriendsSidePanel from "./FriendsSidePanel";
import { openDiscordInvite, openRedditCommunity, openFeedbackEmail, openItchIoPage, openInstagramPage } from "@/lib/community";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onHoverAction?: () => void;
  onClickAction?: () => void;
  homeNotice?: string | null;
  /**
   * Optional handler invoked when the user clicks the home-notice
   * banner. Wired from AppShell — it persists the dismissal baseline,
   * clears the nav-bar friends badge, and hides the banner. We also
   * navigate the user to /friends so they can act on whatever was new.
   */
  onNoticeClickAction?: () => void;
}

const CARDS = [
  { key: "singleplayer" as Screen, title: "PASS & PLAY", sub: "" },
  { key: "lobby" as Screen, title: "1V1: ONLINE", sub: "" },
  { key: "ai" as Screen, title: "TRAINING BOT", sub: "" },
];

type Breakpoint = "mobile" | "tablet" | "desktop";

/** Deterministic 0..1 random helper used by the three hover-effect generators. */
function fxRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233 + 2.31) * 43758.5453;
  return x - Math.floor(x);
}

// ─── MULTIPLAYER: blood-red laser slashes ──────────────────────────────────
type LaserSlash = {
  top: string; left: string; w: string; h: number;
  rot: number; delay: number; dur: number; bright: boolean;
};

function generateLaserSlashes(seed: number): LaserSlash[] {
  const count = 5 + Math.floor(fxRand(seed, 0) * 3);
  const out: LaserSlash[] = [];
  for (let i = 0; i < count; i++) {
    const s = i * 17 + seed;
    out.push({
      top: `${5 + fxRand(seed, s + 1) * 78}%`,
      left: `${-26 + fxRand(seed, s + 2) * 28}%`,
      w: `${118 + fxRand(seed, s + 3) * 32}%`,
      h: 1 + Math.floor(fxRand(seed, s + 4) * 4),
      rot: -52 + fxRand(seed, s + 5) * 50,
      delay: fxRand(seed, s + 6) * 0.42,
      dur: 0.85 + fxRand(seed, s + 7) * 0.7,
      bright: fxRand(seed, s + 8) > 0.55,
    });
  }
  return out;
}

function LobbyLaserLayer({
  borderRadius,
  slashes,
}: {
  borderRadius: number | string;
  slashes: LaserSlash[];
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        borderRadius,
        overflow: "hidden",
      }}
    >
      {/* Soft red wash so the tile reads as "laser-charged" even between strikes. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,30,30,0.18) 0%, rgba(120,0,0,0.12) 42%, transparent 78%)",
        }}
      />
      {slashes.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: s.w,
            height: `${s.h}px`,
            transform: `rotate(${s.rot}deg)`,
            transformOrigin: "left center",
            background: s.bright
              ? "linear-gradient(90deg, transparent 0%, rgba(255,80,80,0.55) 18%, rgba(255,255,255,1) 50%, rgba(255,40,40,0.6) 82%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(255,40,40,0.55) 22%, rgba(255,28,28,1) 50%, rgba(170,0,0,0.62) 78%, transparent 100%)",
            boxShadow: s.bright
              ? "0 0 16px rgba(255,80,80,1), 0 0 38px rgba(255,0,0,0.7), 0 0 8px #ffffff"
              : "0 0 14px rgba(255,30,30,1), 0 0 32px rgba(180,0,0,0.6)",
            opacity: 0.95,
            animation: `laserSlashPulse ${s.dur}s ease-in-out ${s.delay}s infinite`,
            filter: "drop-shadow(0 0 4px rgba(255,40,40,0.95))",
          }}
        />
      ))}
    </div>
  );
}

// ─── TRAINING: heavy blue + yellow lightning bolts ─────────────────────────
type LightningBolt = {
  d: string; color: string; w: number;
  delay: number; dur: number; opacity: number;
};

function generateLightningBolts(seed: number): LightningBolt[] {
  const bolts: LightningBolt[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const yellow = fxRand(seed + i, 100) > 0.5;
    const startX = 8 + fxRand(seed + i, 1) * 84;
    const endX = 8 + fxRand(seed + i, 2) * 84;
    let d = `M ${startX} -8`;
    const segments = 9;
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const baseX = startX + (endX - startX) * t;
      const baseY = -8 + 116 * t;
      const jx = (fxRand(seed + i, 10 + j) - 0.5) * 18;
      const jy = (fxRand(seed + i, 50 + j) - 0.5) * 4;
      const nx = baseX + jx;
      const ny = baseY + jy;
      d += ` L ${nx} ${ny}`;
      // Branch off mid-bolt and (sometimes) near the tail to give it a
      // proper "heavy lightning" silhouette instead of a single zigzag.
      if (j === Math.floor(segments / 2) || (j === segments - 2 && fxRand(seed + i, 200) > 0.55)) {
        const bx = nx + (fxRand(seed + i, 300 + j) - 0.5) * 28;
        const by = ny + (4 + fxRand(seed + i, 400 + j) * 8) * (fxRand(seed + i, 500 + j) > 0.5 ? 1 : -1);
        d += ` M ${nx} ${ny} L ${bx} ${by} M ${nx} ${ny}`;
      }
    }
    bolts.push({
      d,
      color: yellow ? "#FFE600" : "#3B9CFF",
      w: 1.4 + fxRand(seed + i, 700) * 1.5,
      delay: fxRand(seed + i, 800) * 0.5,
      dur: 0.65 + fxRand(seed + i, 900) * 0.7,
      opacity: 0.78 + fxRand(seed + i, 1000) * 0.22,
    });
  }
  return bolts;
}

function TrainingLightningLayer({
  borderRadius,
  bolts,
}: {
  borderRadius: number | string;
  bolts: LightningBolt[];
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        borderRadius,
        overflow: "hidden",
      }}
    >
      {/* Blue+yellow haze so the tile feels like the storm is right behind it. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(80,160,255,0.22) 0%, rgba(255,225,90,0.12) 35%, rgba(20,40,90,0.18) 60%, transparent 80%)",
          animation: "lightningBgFlash 1.5s ease-in-out infinite",
        }}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {bolts.map((b, i) => (
          <g
            key={i}
            style={{ animation: `lightningBoltFlicker ${b.dur}s ease-in-out ${b.delay}s infinite` }}
          >
            {/* Outer halo (blurred), colored core, then a thin white-hot center. */}
            <path
              d={b.d}
              fill="none"
              stroke={b.color}
              strokeWidth={b.w * 2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
              style={{ filter: "blur(2.5px)" }}
            />
            <path
              d={b.d}
              fill="none"
              stroke={b.color}
              strokeWidth={b.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={b.opacity}
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 6px ${b.color}) drop-shadow(0 0 12px ${b.color})` }}
            />
            <path
              d={b.d}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={Math.max(0.4, b.w * 0.45)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── AI ENGINE: purple cosmic-void backdrop ───────────────────────────────
type VoidStar = {
  top: string; left: string; size: number;
  color: string; delay: number; dur: number;
};

function generateVoidStars(seed: number): VoidStar[] {
  const count = 22;
  const palette = ["#FFFFFF", "#E9D5FF", "#C084FC", "#A855F7", "#F0ABFC"];
  const stars: VoidStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      top: `${fxRand(seed + i, 1) * 92 + 4}%`,
      left: `${fxRand(seed + i, 2) * 92 + 4}%`,
      size: 1 + fxRand(seed + i, 3) * 3,
      color: palette[Math.floor(fxRand(seed + i, 4) * palette.length)],
      delay: fxRand(seed + i, 5) * 2.4,
      dur: 1.3 + fxRand(seed + i, 6) * 2.4,
    });
  }
  return stars;
}

function AIVoidLayer({
  borderRadius,
  stars,
}: {
  borderRadius: number | string;
  stars: VoidStar[];
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        borderRadius,
        overflow: "hidden",
      }}
    >
      {/* Deep void: violet core fading into near-black at the edges. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(76,29,149,0.55) 0%, rgba(46,16,101,0.78) 38%, rgba(15,5,30,0.95) 78%)",
        }}
      />
      {/* Slow conic spiral evokes the gravitational swirl of a singularity. */}
      <div
        style={{
          position: "absolute",
          inset: "-25%",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(168,85,247,0.22) 70deg, transparent 130deg, rgba(126,34,206,0.2) 200deg, transparent 270deg, rgba(217,70,239,0.18) 330deg, transparent 360deg)",
          animation: "voidSpiral 10s linear infinite",
          filter: "blur(10px)",
        }}
      />
      {/* Two pulsing nebula clouds offset asymmetrically for depth. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 70% 28%, rgba(217,70,239,0.32) 0%, transparent 38%), radial-gradient(circle at 25% 75%, rgba(96,38,158,0.28) 0%, transparent 42%)",
          filter: "blur(14px)",
          animation: "voidNebulaPulse 5.5s ease-in-out infinite",
        }}
      />
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 ${s.size * 3}px ${s.color}, 0 0 ${s.size * 6}px ${s.color}`,
            animation: `voidStarTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setBp("mobile");
      else if (w < 1024) setBp("tablet");
      else setBp("desktop");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return bp;
}

function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Fluid scaling: only start shrinking if we're actually running out of space
      // based on a more reasonable baseline (1280x800)
      const scaleW = vw < 1280 ? Math.max(0.65, vw / 1340) : 1;
      const scaleH = vh < 800 ? Math.max(0.65, (vh - 60) / 740) : 1;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

export default function HomeScreen({ setScreenAction, themeId, onHoverAction, onClickAction, homeNotice, onNoticeClickAction }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const isSp = themeId === "space";
  const BLOOD_RED = "#FF0000";
  const AI_PURPLE = "#A855F7";
  const bp = useBreakpoint();
  const scale = useScale();
  const [hovered, setHovered] = useState<Screen | null>(null);
  const [hovFooter, setHovFooter] = useState<string | null>(null);
  const [hovCommunity, setHovCommunity] = useState<"itch" | "reddit" | "discord" | "feedback" | "instagram" | null>(null);
  // Each card bumps its own seed on mouse-enter so the effect re-shuffles
  // every time you hover — keeps the interaction feeling alive instead of
  // showing the exact same slashes/bolts/stars on repeat hovers.
  const [lobbySlashSeed, setLobbySlashSeed] = useState(0);
  const [trainingBoltSeed, setTrainingBoltSeed] = useState(0);
  const [aiVoidSeed, setAiVoidSeed] = useState(0);

  const lobbySlashes = useMemo(() => generateLaserSlashes(lobbySlashSeed), [lobbySlashSeed]);
  const trainingBolts = useMemo(() => generateLightningBolts(trainingBoltSeed), [trainingBoltSeed]);
  const aiVoidStars = useMemo(() => generateVoidStars(aiVoidSeed), [aiVoidSeed]);

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const accent = themeId === "classic_light" || themeId === "classic_dark" ? "#CC0000" : t.accent;

  // Nav height must match NavBar.tsx exactly (isMobile:52 / isTablet:60 / desktop:64)
  const NAV_H = isMobile ? 52 : isTablet ? 60 : 64;

  const titleSize = isMobile ? "clamp(30px, 9vw, 50px)" : "clamp(36px, 5.6vw, 88px)";
  const cardTitleSize = isMobile ? "clamp(16px, 4.5vw, 24px)" : "clamp(18px, 1.9vw, 30px)";
  const cardSubSize = "clamp(12px, 1.1vw, 16px)";

  // paddingTop = exact nav height so content starts flush at nav bottom
  const outerPaddingTop = NAV_H;
  const outerPaddingX = isMobile ? 14 : "clamp(20px, 3vw, 52px)";
  const outerPaddingBottom = 16;

  // Cards: generous vertical padding so they feel impactful and spacious
  const cardPadding = isMobile ? "22px 18px" : "clamp(36px, 5.5vh, 64px) clamp(24px, 2.5vw, 42px)";

  const cardsLayout: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    flexWrap: isMobile ? "nowrap" : "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: isMobile ? 12 : "clamp(12px, 1.8vw, 22px)",
    width: "100%",
    maxWidth: 1280,
    marginTop: isMobile ? "1.5vh" : "clamp(16px, 3vh, 32px)",
  };

  const { user } = useAuthStore();
  const rank = getRank(user?.elo ?? 0);
  const isPlacement = (user as any)?.placement_matches < 5;
  const placementCol = "#FF33FF";

  const cardStyle = (key: Screen, _index: number): React.CSSProperties => {
    const isHov = hovered === key;
    const isMulti = key === "lobby";
    const isAI = key === "ai";
    const hovCol = isMulti ? BLOOD_RED : isAI ? AI_PURPLE : t.accent;

    const spaceBg = isHov
      ? "linear-gradient(145deg, rgba(58,120,212,0.18), rgba(8,15,40,0.72))"
      : "rgba(6,12,34,0.52)";

    // Per-mode hover aura — gives each card a distinct outer glow that
    // matches its in-card effect (blood-red lasers / blue-yellow lightning /
    // purple cosmic void).
    const lobbyAura = [
      "0 0 28px rgba(255,45,45,0.45)",
      "0 0 60px rgba(180,0,0,0.4)",
      "inset 0 0 36px rgba(0,0,0,0.42)",
      "inset 0 0 14px rgba(90,0,0,0.22)",
    ].join(", ");
    const trainingAura = [
      "0 0 28px rgba(80,160,255,0.45)",
      "0 0 60px rgba(255,225,90,0.32)",
      "inset 0 0 32px rgba(0,0,0,0.38)",
      "inset 0 0 12px rgba(20,40,90,0.25)",
    ].join(", ");
    const aiAura = [
      "0 0 28px rgba(168,85,247,0.5)",
      "0 0 60px rgba(126,34,206,0.4)",
      "inset 0 0 36px rgba(0,0,0,0.42)",
      "inset 0 0 14px rgba(46,16,101,0.28)",
    ].join(", ");

    let hoverShadow: string;
    if (isHov && isMulti) {
      hoverShadow = isSp
        ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08), ${lobbyAura}`
        : `0 24px 64px ${hovCol}38, 0 0 24px ${hovCol}18, ${lobbyAura}`;
    } else if (isHov && isAI) {
      hoverShadow = isSp
        ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08), ${aiAura}`
        : `0 24px 64px ${hovCol}38, 0 0 24px ${hovCol}18, ${aiAura}`;
    } else if (isHov) {
      // training (singleplayer) — no theme-accent fallback so lightning aura
      // shows in every theme.
      hoverShadow = isSp
        ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08), ${trainingAura}`
        : `0 24px 64px ${hovCol}33, 0 0 20px ${hovCol}11, ${trainingAura}`;
    } else {
      hoverShadow = isSp ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none";
    }

    return {
      background: isSp
        ? spaceBg
        : isHov
          ? `linear-gradient(145deg, ${hovCol}22, ${t.bgCard}dd)`
          : t.bgCard,
      border: `${isMobile ? "1.5px" : "2px"} solid ${
        isHov ? hovCol : isSp ? "rgba(58,120,212,0.25)" : t.border
      }`,
      borderRadius: ip ? 2 : isMobile ? 12 : 20,
      padding: cardPadding,
      cursor: "pointer",
      textAlign: "center" as const,
      transition:
        "transform 0.4s cubic-bezier(.22,.68,0,1.2), box-shadow 0.4s cubic-bezier(.22,.68,0,1.2), background 0.2s linear, border-color 0.2s linear, opacity 0.2s linear",
      // All three cards now share the same baseline so they sit on a
      // single horizontal line (previously training + AI engine were
      // pushed down 60px to form a curve, which left multiplayer
      // visually offset).
      transform: isMobile
        ? isHov
          ? "scale(1.02)"
          : "scale(1)"
        : isHov
          ? "translateY(-15px) scale(1.06)"
          : "translateY(0)",
      boxShadow: hoverShadow,
      flex: isMobile ? undefined : 1,
      width: isMobile ? "100%" : undefined,
      minWidth: 0,
      position: "relative",
      // Hovered card stays slightly above siblings so its glow isn't
      // clipped by the next card's z-stack.
      zIndex: isHov ? 10 : 1,
      // Effect layers paint inside the card; keep the box clipped so
      // slashes/bolts/stars don't bleed past the rounded corners.
      overflow: "hidden" as const,
      ...(isMobile ? { display: "flex", alignItems: "center", gap: 16, textAlign: "left" as const } : {}),
    };
  };

  const FOOTER_LINKS: { label: string; href: string }[] = [
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy",     href: "/privacy" },
    { label: "Refund Policy",      href: "/refund" },
  ];

  const openFooterDoc = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, overflowY: "auto",
      background: t.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      paddingTop: outerPaddingTop,
      paddingLeft: outerPaddingX,
      paddingRight: outerPaddingX,
      paddingBottom: outerPaddingBottom,
      transition: "background 0.4s",
    }}>

      <FriendsSidePanel themeId={themeId} onHoverAction={onHoverAction} />

      {/* ── Main content: vertically centered group ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flex: 1, width: "100%", maxWidth: 1440,
        transform: isMobile ? "none" : `scale(${scale})`,
        transformOrigin: "center center",
        transition: "transform 0.3s cubic-bezier(.22,.68,0,1.2)",
        gap: isMobile ? "clamp(14px, 2.5vh, 24px)" : "clamp(16px, 3vh, 32px)",
      }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');
          @keyframes starPulse { from { opacity:0.2; transform:scale(0.8); } to { opacity:0.9; transform:scale(1.2); } }
          @keyframes pixelBlink { 0%,100%{opacity:1} 50%{opacity:0.7} }
          @keyframes spaceCardIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          /* MULTIPLAYER laser-slash pulse: bright at the peak, dim between cuts. */
          @keyframes laserSlashPulse {
            0%, 100% { opacity: 0.78; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.45); }
          }
          /* TRAINING storm haze breathes so the tile looks electrically charged. */
          @keyframes lightningBgFlash {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
          /* TRAINING bolts flicker on/off twice per cycle for a stuttering strike. */
          @keyframes lightningBoltFlicker {
            0%, 18%, 30%, 60%, 100% { opacity: 1; }
            22% { opacity: 0.15; }
            64% { opacity: 0.4; }
            68% { opacity: 1; }
          }
          /* AI ENGINE conic spiral rotates slowly for the singularity look. */
          @keyframes voidSpiral {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          /* AI ENGINE nebula clouds breathe in/out over a few seconds. */
          @keyframes voidNebulaPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          /* AI ENGINE stars twinkle with an offset delay per star. */
          @keyframes voidStarTwinkle {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.18); }
          }
        `}</style>

        {/* ── Title ── */}
        <div style={{ position: "relative", textAlign: "center", width: "100%", marginTop: isMobile ? "1vh" : "2vh" }}>
          <h1 style={{
            fontFamily: "'Courier New', monospace",
            fontSize: titleSize,
            fontWeight: 900,
            letterSpacing: isMobile ? "0.08em" : "0.18em",
            textAlign: "center", lineHeight: 1,
            margin: 0,
          }}>
            <span style={{ display: "inline", filter: isSp ? "drop-shadow(0 0 18px rgba(80,140,255,0.55))" : "drop-shadow(0 0 8px rgba(255,255,255,0.4))" }}>
              <span style={{ background: isSp ? "linear-gradient(to bottom, #ffffff 0%, #a0c8ff 45%, #6090ff 100%)" : "linear-gradient(to bottom, #ffffff 0%, #999999 50%, #ffffff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline" }}>PENTA</span>
            </span>
            <br style={{ display: isMobile ? "block" : "none" }} />
            <span style={{ display: "inline", filter: "drop-shadow(0 0 12px rgba(255,30,0,0.7))" }}>
              <span style={{ background: "linear-gradient(to bottom, #FF2200 0%, #8B0000 45%, #FF1100 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline" }}>PROTOCOL</span>
            </span>
          </h1>

          {isSp && !isMobile && (
            <div style={{ fontFamily: t.fontBody, fontSize: 13, letterSpacing: "0.4em", color: "rgba(140,180,255,0.45)", textTransform: "uppercase", marginTop: 12 }}>
            </div>
          )}

          {isSp && !isMobile && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {["✦", "·", "✧", "★", "·", "✦", "✧", "·", "★"].map((star, i) => (
                <span key={i} style={{ position: "absolute", left: `${8 + i * 10}%`, top: `${20 + (i % 3) * 30}%`, color: ["#FFD060", "#60A8FF", "#00E87A", "#FFFFFF"][i % 4], fontSize: [8, 12, 6, 10, 14, 7, 11, 9, 13][i], opacity: 0.6, animation: `starPulse ${1.5 + i * 0.3}s ease-in-out infinite alternate`, animationDelay: `${i * 0.2}s` }}>{star}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Mode cards ── */}
        <div style={cardsLayout}>
          {CARDS.map((card, idx) => (
            <button
              key={card.key}
              type="button"
              aria-label={card.key === "ai" ? `${card.title}. ${card.sub}` : undefined}
              onClick={() => { onClickAction?.(); setScreenAction(card.key); }}
              onMouseEnter={() => {
                onHoverAction?.();
                setHovered(card.key);
                // Re-roll the effect's RNG seed each time the card is
                // entered so the slashes / bolts / star field never look
                // identical between hovers.
                if (card.key === "lobby") setLobbySlashSeed((s) => s + 1);
                else if (card.key === "singleplayer") setTrainingBoltSeed((s) => s + 1);
                else if (card.key === "ai") setAiVoidSeed((s) => s + 1);
              }}
              onMouseLeave={() => setHovered(null)}
              style={cardStyle(card.key, idx)}
            >
              {/* Hover effect layers — each card has its own backdrop:
                    - lobby: blood-red laser slashes
                    - singleplayer (training): blue+yellow heavy lightning
                    - ai: purple cosmic-void with twinkling stars
                  All are absolutely positioned at zIndex 1 so the title
                  div (zIndex 2) sits cleanly on top.  */}
              {card.key === "lobby" && hovered === "lobby" && (
                <LobbyLaserLayer
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  slashes={lobbySlashes}
                />
              )}
              {card.key === "singleplayer" && hovered === "singleplayer" && (
                <TrainingLightningLayer
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  bolts={trainingBolts}
                />
              )}
              {card.key === "ai" && hovered === "ai" && (
                <AIVoidLayer
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  stars={aiVoidStars}
                />
              )}

              {/* Title block — stays visible at all times now that the
                  break/shatter swap-out is gone. Its color shifts to the
                  card's accent on hover so the effect layer behind it
                  reads as "powering up" the label. */}
              <div
                style={{
                  flex: isMobile ? 1 : undefined,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div style={{
                  fontFamily: (themeId === "classic_light" || themeId === "classic_dark" || themeId === "space") ? "'Cinzel', serif" : t.fontDisplay,
                  fontSize: cardTitleSize, fontWeight: 700,
                  color: hovered === card.key ? (card.key === "lobby" ? BLOOD_RED : card.key === "ai" ? AI_PURPLE : t.accent) : t.text,
                  marginBottom: isMobile ? 4 : 8,
                  transition: "color 0.2s, text-shadow 0.2s",
                  position: "relative", zIndex: 2,
                  // Two-stage shadow: a tight dark halo (~3px) keeps the
                  // colored letters legible against the busy effect
                  // backdrop, then a wider colored bloom matches each
                  // card's palette so the label looks "charged" on
                  // hover (red lasers / blue+yellow lightning / purple
                  // cosmic glow).
                  textShadow: hovered === card.key
                    ? card.key === "lobby"
                      ? "0 0 3px rgba(0,0,0,0.95), 0 0 14px rgba(255,30,30,1), 0 0 28px rgba(255,30,30,0.55)"
                      : card.key === "ai"
                        ? "0 0 3px rgba(0,0,0,0.95), 0 0 14px rgba(192,132,252,1), 0 0 28px rgba(168,85,247,0.55)"
                        : "0 0 3px rgba(0,0,0,0.95), 0 0 14px rgba(150,210,255,1), 0 0 28px rgba(255,225,90,0.5)"
                    : "none",
                }}>
                  {card.title}
                </div>
                <div style={{
                  fontFamily: t.fontBody,
                  fontSize: cardSubSize,
                  color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted,
                  position: "relative", zIndex: 2,
                }}>
                  {card.sub}
                </div>
              </div>

              {isMobile && (
                <div style={{
                  fontFamily: t.fontMono, fontSize: 18,
                  color: hovered === card.key
                    ? (card.key === "lobby" ? BLOOD_RED : card.key === "ai" ? AI_PURPLE : t.accent)
                    : t.textMuted,
                  transition: "color 0.2s, transform 0.2s",
                  transform: hovered === card.key ? "translateX(4px)" : "translateX(0)",
                  flexShrink: 0,
                  position: "relative", zIndex: 2,
                }}>›</div>
              )}
            </button>
          ))}
        </div>

        {/* ── Rank + Community — fully centered, two stacked rows ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: isMobile ? 12 : 16,
          width: "100%",
          animation: "fadeUp 0.8s cubic-bezier(.22,.68,0,1.2) both",
        }}>

          {/* Row 1: Player chip — compact horizontal card, centered */}
          {user && (
            <div style={{
              display: "inline-flex", alignItems: "center",
              gap: isMobile ? 14 : 20,
              padding: isMobile ? "12px 20px" : "14px 28px",
              background: isSp
                ? "rgba(6,12,34,0.65)"
                : themeId === "classic_light"
                  ? "rgba(0,0,0,0.04)"
                  : "rgba(255,255,255,0.04)",
              border: `1px solid ${isPlacement ? `${placementCol}33` : `${rank.color}28`}`,
              borderRadius: ip ? 2 : 50, // pill shape
              backdropFilter: "blur(12px)",
              position: "relative", overflow: "hidden",
              transition: "filter 0.4s",
              filter: hovered === "lobby" ? `drop-shadow(0 0 16px ${BLOOD_RED}55)` : "none",
            }}>
              {/* Rank-colour ambient glow */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `radial-gradient(ellipse at 30% 50%, ${isPlacement ? placementCol : rank.color}0A 0%, transparent 65%)`,
              }} />
              <NavRankBadge rank={rank} size={isMobile ? 52 : 64} isPlacement={isPlacement} />

              {/* Thin divider */}
              <div style={{ width: 1, height: isMobile ? 36 : 44, background: `${t.border}55`, flexShrink: 0 }} />

              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                {(user as any)?.username && (
                  <div style={{
                    fontFamily: t.fontMono, fontSize: isMobile ? 9 : 10, fontWeight: 700,
                    color: t.textMuted, letterSpacing: "0.18em", textTransform: "uppercase",
                  }}>
                    {(user as any).username}
                  </div>
                )}
                <div style={{
                  fontFamily: t.fontDisplay,
                  fontSize: isMobile ? 16 : 20,
                  fontWeight: 900,
                  color: isPlacement ? placementCol : rank.color,
                  letterSpacing: "0.1em", lineHeight: 1,
                  textShadow: isPlacement ? `0 0 14px ${placementCol}66` : `0 0 14px ${rank.color}44`,
                }}>
                  {isPlacement ? "PLACEMENT" : rank.name}
                </div>
                <div style={{
                  fontFamily: t.fontMono, fontSize: isMobile ? 11 : 12,
                  color: t.textMuted, letterSpacing: "0.04em",
                }}>
                  <span style={{ color: isPlacement ? placementCol : t.accent, fontWeight: 800 }}>
                    {isPlacement ? "?" : (user?.elo ?? 0)}
                  </span>{" "}ELO
                </div>
              </div>

              {hovered === "lobby" && (
                <div style={{
                  fontFamily: t.fontMono, fontSize: 9, color: BLOOD_RED,
                  letterSpacing: "0.2em", animation: "pixelBlink 1s infinite",
                  fontWeight: 700, position: "relative", zIndex: 1,
                }}>
                  ⬤ TARGET
                </div>
              )}
            </div>
          )}

          {/* Row 2: Community links — centered row of equal buttons */}
          <div style={{
            display: "flex", flexWrap: "wrap" as const,
            gap: isMobile ? 7 : 9,
            alignItems: "center", justifyContent: "center",
            marginTop: isMobile ? 6 : 14,
          }}>
            {(
              [
                {
                  key: "itch" as const, label: "itch.io",
                  icon: <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 900, lineHeight: 1 }}>▶</span>,
                  hoverBg: "#FA5C5C", restBg: "rgba(250,92,92,0.1)",
                  restBorder: "rgba(250,92,92,0.4)", hoverBorder: "#FF7A7A",
                  restColor: "#FF8585", hoverColor: "#fff", onClick: openItchIoPage,
                },
                {
                  key: "reddit" as const, label: "Reddit",
                  icon: <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.04 1.604a3.4 3.4 0 0 1 .045.572c0 2.908-3.358 5.265-7.502 5.265-4.144 0-7.502-2.357-7.502-5.265 0-.193.015-.386.045-.572-.605-.271-1.04-.888-1.04-1.604 0-.968.786-1.754 1.754-1.754.477 0 .898.182 1.207.491 1.207-.864 2.879-1.42 4.74-1.488l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.111-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>,
                  hoverBg: "#FF4500", restBg: "rgba(255,69,0,0.1)",
                  restBorder: "rgba(255,69,0,0.4)", hoverBorder: "#FF6A33",
                  restColor: "#FF7A45", hoverColor: "#fff", onClick: openRedditCommunity,
                },
                {
                  key: "discord" as const, label: "Join Discord",
                  icon: <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" /></svg>,
                  hoverBg: "#5865F2", restBg: "rgba(88,101,242,0.88)",
                  restBorder: "#5865F2", hoverBorder: "#7983F5",
                  restColor: "#fff", hoverColor: "#fff", onClick: openDiscordInvite,
                },
                {
                  key: "feedback" as const, label: "Feedback",
                  icon: <img src="/Pentaprotocol_Logo_Transparent.png" alt="" aria-hidden="true" draggable={false} style={{ width: 14, height: 14, objectFit: "contain", filter: "drop-shadow(0 0 4px rgba(255,100,30,0.5))", flexShrink: 0, userSelect: "none", pointerEvents: "none" }} />,
                  hoverBg: `${accent}22`, restBg: `${accent}0D`,
                  restBorder: `${accent}50`, hoverBorder: accent,
                  restColor: t.textSecondary, hoverColor: accent, onClick: openFeedbackEmail,
                },
                {
                  key: "instagram" as const, label: "Instagram",
                  icon: <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>,
                  hoverBg: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)",
                  restBg: "rgba(225,48,108,0.1)", restBorder: "rgba(225,48,108,0.4)",
                  hoverBorder: "#E1306C", restColor: "#F26499", hoverColor: "#fff",
                  onClick: openInstagramPage,
                },
              ] as const
            ).map(({ key, label, icon, hoverBg, restBg, restBorder, hoverBorder, restColor, hoverColor, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={() => { onClickAction?.(); onClick(); }}
                onMouseEnter={() => { onHoverAction?.(); setHovCommunity(key); }}
                onMouseLeave={() => setHovCommunity(null)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: isMobile ? "7px 11px" : "8px 14px",
                  background: hovCommunity === key ? hoverBg : restBg,
                  border: `1px solid ${hovCommunity === key ? hoverBorder : restBorder}`,
                  borderRadius: ip ? 2 : 10,
                  color: hovCommunity === key ? hoverColor : restColor,
                  fontFamily: t.fontDisplay,
                  fontSize: isMobile ? 10 : 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  cursor: "pointer",
                  transform: hovCommunity === key ? "translateY(-2px)" : "translateY(0)",
                  boxShadow: hovCommunity === key ? `0 6px 18px rgba(0,0,0,0.38)` : "none",
                  transition: "background 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Home-notice banner ── */}
      {homeNotice && (
        <button
          type="button"
          onClick={() => {
            onClickAction?.();
            onNoticeClickAction?.();
            // Friend-related notices route to /friends so the user
            // can see what triggered the banner. Other notices just
            // dismiss in place.
            if (/\bfriend\b|\bmessage\b/i.test(homeNotice)) {
              setScreenAction("friends");
            }
          }}
          onMouseEnter={onHoverAction}
          aria-label={`${homeNotice} Click to dismiss and view friends.`}
          style={{
            position: "relative",
            zIndex: 3,
            marginTop: isMobile ? -4 : 0,
            marginBottom: 4,
            border: `1px solid ${t.border}66`,
            background: "rgba(0,0,0,0.45)",
            borderRadius: ip ? 2 : 10,
            padding: isMobile ? "8px 14px" : "9px 16px",
            fontFamily: t.fontMono,
            fontSize: isMobile ? 10 : 11,
            letterSpacing: "0.06em",
            color: t.textSecondary,
            textAlign: "center",
            maxWidth: "min(92vw, 760px)",
            cursor: "pointer",
            transition:
              "background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
            outline: "none",
            font: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = `${t.accent}cc`;
            e.currentTarget.style.color = t.accent;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `${t.border}66`;
            e.currentTarget.style.color = t.textSecondary;
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(0,0,0,0.6)";
            e.currentTarget.style.borderColor = `${t.accent}cc`;
            e.currentTarget.style.color = t.accent;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(0,0,0,0.45)";
            e.currentTarget.style.borderColor = `${t.border}66`;
            e.currentTarget.style.color = t.textSecondary;
          }}
        >
          <span>{homeNotice}</span>
          <span
            aria-hidden="true"
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.6,
              letterSpacing: "0.08em",
            }}
          >
            ▸
          </span>
        </button>
      )}

      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: isMobile ? 12 : 28,
        flexWrap: "wrap" as const,
        paddingTop: 12,
        paddingBottom: isMobile ? 10 : 8,
        width: "100%",
      }}>
        {FOOTER_LINKS.map((link, i) => (
          <React.Fragment key={link.href}>
            <button
              type="button"
              onClick={() => openFooterDoc(link.href)}
              onMouseEnter={() => setHovFooter(link.href)}
              onMouseLeave={() => setHovFooter(null)}
              style={{
                fontFamily: t.fontMono,
                fontSize: isMobile ? 9 : 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: hovFooter === link.href
                  ? accent
                  : isSp
                    ? "rgba(140,180,255,0.35)"
                    : t.textMuted,
                textDecoration: "none",
                padding: "4px 2px",
                transition: "color 0.2s",
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap" as const,
                cursor: "pointer",
                background: "transparent",
                border: "none",
              }}
            >
              {link.label}
            </button>
            {i < FOOTER_LINKS.length - 1 && (
              <span style={{
                color: isSp ? "rgba(140,180,255,0.2)" : t.border,
                fontSize: 10,
                userSelect: "none",
              }}>·</span>
            )}
          </React.Fragment>
        ))}
      </div>

    </div>
  );
}