"use client";
import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
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
  { key: "singleplayer" as Screen, title: "TRAINING", sub: "" },
  { key: "lobby" as Screen, title: "MULTIPLAYER", sub: "" },
  { key: "ai" as Screen, title: "AI ENGINE", sub: "" },
];

type Breakpoint = "mobile" | "tablet" | "desktop";

/** Outer frame segments for each shard index (5×2 grid): top/bottom row + left/right column. */
function aiShardPerimeterBorder(
  index: number,
  color: string,
  width: string,
  cornerRadius: number,
): React.CSSProperties {
  const col = index % 5;
  const row = index < 5 ? 0 : 1;
  const side = `${width} solid ${color}`;
  return {
    boxSizing: "border-box",
    borderTop: row === 0 ? side : undefined,
    borderBottom: row === 1 ? side : undefined,
    borderLeft: col === 0 ? side : undefined,
    borderRight: col === 4 ? side : undefined,
    borderTopLeftRadius: row === 0 && col === 0 ? cornerRadius : 0,
    borderTopRightRadius: row === 0 && col === 4 ? cornerRadius : 0,
    borderBottomLeftRadius: row === 1 && col === 0 ? cornerRadius : 0,
    borderBottomRightRadius: row === 1 && col === 4 ? cornerRadius : 0,
  };
}

/** 10 shards: 5×2 grid (full tile coverage; motion is random per shard). */
const AI_GLASS_CLIPS = [
  "polygon(0% 0%, 20% 0%, 20% 50%, 0% 50%)",
  "polygon(20% 0%, 40% 0%, 40% 50%, 20% 50%)",
  "polygon(40% 0%, 60% 0%, 60% 50%, 40% 50%)",
  "polygon(60% 0%, 80% 0%, 80% 50%, 60% 50%)",
  "polygon(80% 0%, 100% 0%, 100% 50%, 80% 50%)",
  "polygon(0% 50%, 20% 50%, 20% 100%, 0% 100%)",
  "polygon(20% 50%, 40% 50%, 40% 100%, 20% 100%)",
  "polygon(40% 50%, 60% 50%, 60% 100%, 40% 100%)",
  "polygon(60% 50%, 80% 50%, 80% 100%, 60% 100%)",
  "polygon(80% 50%, 100% 50%, 100% 100%, 80% 100%)",
] as const;

/** Diagonal strikes (horizontal gradient along the bolt), ~+20% intensity. */
function trainingDiagonalStrikeStyle(palette: "white" | "blue" | "red"): { background: string; boxShadow: string } {
  switch (palette) {
    case "white":
      return {
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.42) 34%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.42) 66%, transparent 100%)",
        boxShadow: "0 0 12px rgba(255,255,255,1), 0 0 26px rgba(240,248,255,0.54)",
      };
    case "blue":
      return {
        background:
          "linear-gradient(90deg, transparent 0%, rgba(90,160,255,0.42) 38%, rgba(190,235,255,1) 50%, rgba(70,130,255,0.58) 64%, transparent 100%)",
        boxShadow: "0 0 14px rgba(150,210,255,1), 0 0 31px rgba(70,150,255,0.58)",
      };
    case "red":
      return {
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,130,130,0.54) 36%, rgba(255,85,105,1) 50%, rgba(210,40,60,0.62) 66%, transparent 100%)",
        boxShadow: "0 0 14px rgba(255,130,130,1), 0 0 31px rgba(255,60,80,0.58)",
      };
  }
}

const TRAINING_DIAGONAL_STRIKES = [
  { top: "7%", left: "-10%", w: "58%", h: 4, rot: -46, pal: "white" as const, dur: 0.88, delay: 0 },
  { top: "34%", left: "18%", w: "62%", h: 3, rot: 41, pal: "blue", dur: 1.05, delay: 0.18 },
  { top: "20%", left: "44%", w: "52%", h: 5, rot: -33, pal: "red", dur: 0.82, delay: 0.42 },
  { top: "56%", left: "2%", w: "64%", h: 4, rot: 36, pal: "white", dur: 0.95, delay: 0.1 },
  { top: "72%", left: "28%", w: "55%", h: 3, rot: -28, pal: "blue", dur: 1.12, delay: 0.55 },
] as const;

function lobbySlashRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233 + 2.31) * 43758.5453;
  return x - Math.floor(x);
}

/** New random blood sword slashes on each lobby hover (seed bumps in onMouseEnter). */
function generateLobbySlashes(seed: number): { top: string; left: string; w: string; h: number; rot: number; delay: number; dur: number }[] {
  const count = 4 + Math.floor(lobbySlashRand(seed, 0) * 3);
  const out: { top: string; left: string; w: string; h: number; rot: number; delay: number; dur: number }[] = [];
  for (let i = 0; i < count; i++) {
    const s = i * 17 + seed;
    out.push({
      top: `${10 + lobbySlashRand(seed, s + 1) * 62}%`,
      left: `${-26 + lobbySlashRand(seed, s + 2) * 24}%`,
      w: `${112 + lobbySlashRand(seed, s + 3) * 32}%`,
      h: 2 + Math.floor(lobbySlashRand(seed, s + 4) * 6),
      rot: -52 + lobbySlashRand(seed, s + 5) * 44,
      delay: lobbySlashRand(seed, s + 6) * 0.58,
      dur: 1.95 + lobbySlashRand(seed, s + 7) * 1.45,
    });
  }
  return out;
}

/** 10 shards: 5×2 grid (full tile coverage; motion is tailored per mode). */
function getShardScatter(i: number, mode: "ai" | "lobby" | "training"): { tx: number; ty: number; rot: number; delay: number } {
  const fract = (x: number) => x - Math.floor(x);
  const rand1 = fract(Math.sin(i * 12.9898) * 43758.5453);
  const rand2 = fract(Math.sin(i * 78.233 + 3.14159) * 43758.5453);
  const rand3 = fract(Math.sin(i * 45.164 + 2.71828) * 43758.5453);

  // Chaotic scatter for all (original challenge behavior)
  const tx = (rand1 - 0.5) * 76;
  const ty = (rand2 - 0.5) * 76;
  const rot = (rand3 - 0.5) * 40;
  const delay = i * 0.011 + fract(Math.sin(i * 91.714) * 43758.5453) * 0.045;
  return { tx, ty, rot, delay };
}

function HoverShatterLayer(props: {
  borderRadius: number | string;
  cornerRadius: number;
  cardPadding: string;
  background: string;
  backdropBlur?: string;
  isMobile: boolean;
  titleBlock: React.ReactNode;
  chevron: React.ReactNode;
  borderColor: string;
  borderWidth: string;
  mode: "ai" | "lobby" | "training";
}) {
  const {
    borderRadius,
    cornerRadius,
    cardPadding,
    background,
    backdropBlur,
    isMobile,
    titleBlock,
    chevron,
    borderColor,
    borderWidth,
    mode
  } = props;
  const dur = "0.48s";
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
  const [burst, setBurst] = useState(false);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setBurst(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        pointerEvents: "none",
        borderRadius,
        overflow: "visible",
      }}
    >
      {AI_GLASS_CLIPS.map((clip, i) => {
        const sc = getShardScatter(i, mode);
        return (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            clipPath: clip,
            WebkitClipPath: clip,
            background,
            backdropFilter: backdropBlur,
            WebkitBackdropFilter: backdropBlur,
            ...aiShardPerimeterBorder(i, borderColor, borderWidth, cornerRadius),
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.05)",
            transition: burst ? `transform ${dur} ${easing} ${sc.delay}s` : "none",
            transform: burst
              ? `translate3d(${sc.tx}px, ${sc.ty}px, 0) rotate(${sc.rot}deg)`
              : "translate3d(0,0,0) rotate(0deg)",
            willChange: "transform",
          }}
        >
          <div
            style={{
              padding: cardPadding,
              height: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? 16 : 0,
              textAlign: "center",
            }}
          >
            <div style={{ flex: isMobile ? 1 : undefined, minWidth: 0 }}>{titleBlock}</div>
            {chevron}
          </div>
        </div>
        );
      })}
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
  const [lobbySlashSeed, setLobbySlashSeed] = useState(0);

  const lobbySlashes = useMemo(() => generateLobbySlashes(lobbySlashSeed), [lobbySlashSeed]);

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const accent = themeId === "classic_light" || themeId === "classic_dark" ? "#CC0000" : t.accent;

  const titleSize = "clamp(32px, 6.5vw, 92px)";
  const cardTitleSize = "clamp(20px, 2.4vw, 34px)";
  const cardSubSize = "clamp(15px, 1.4vw, 22px)";
  
  // Fluid padding and spacing
  const cardPadding = isMobile ? "24px 20px" : "clamp(40px, 6vh, 72px) clamp(24px, 2.5vw, 40px)";
  const outerPaddingTop = isMobile ? 20 : "clamp(60px, 10vh, 100px)";
  const outerPaddingX = isMobile ? 16 : "clamp(20px, 3vw, 48px)";
  const outerPaddingBottom = isMobile ? 8 : 12;
  const outerGap = "clamp(24px, 5vh, 50px)";

  const cardsLayout: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    flexWrap: isMobile ? "nowrap" : "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: "clamp(12px, 2vw, 24px)",
    width: "100%",
    maxWidth: 1400,
    marginTop: isMobile ? "2vh" : "5vh",
  };

  const { user } = useAuthStore();
  const rank = getRank(user?.elo ?? 0);
  const isPlacement = (user as any)?.placement_matches < 5;
  const placementCol = "#FF33FF";

  const cardStyle = (key: Screen, index: number): React.CSSProperties => {
    const isHov = hovered === key;
    const isMulti = key === "lobby";
    const isAI = key === "ai";
    const hovCol = isMulti ? BLOOD_RED : isAI ? AI_PURPLE : t.accent;
    let curveY = 0;
    if (!isMobile) {
      if (index === 0) curveY = 60;
      if (index === 2) curveY = 60;
    }

    const spaceBg = isHov
      ? "linear-gradient(145deg, rgba(58,120,212,0.18), rgba(8,15,40,0.72))"
      : "rgba(6,12,34,0.52)";

    /** Sword-slash blood: crimson edges + dark void (no drip) */
    const lobbySlashAura = [
      "0 0 28px rgba(255,45,45,0.42)",
      "0 0 52px rgba(160,0,0,0.38)",
      "0 0 88px rgba(0,0,0,0.55)",
      "inset 0 0 36px rgba(0,0,0,0.4)",
      "inset 0 0 12px rgba(90,0,0,0.22)",
    ].join(", ");

    let hoverShadow: string;
    if (isHov && isMulti) {
      hoverShadow = isSp
        ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08), ${lobbySlashAura}`
        : `0 24px 64px ${hovCol}38, 0 0 24px ${hovCol}18, ${lobbySlashAura}`;
    } else if (isHov) {
      hoverShadow = isSp
        ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`
        : `0 24px 64px ${hovCol}33, 0 0 20px ${hovCol}11`;
    } else {
      hoverShadow = isSp ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none";
    }

    const shatterActive = isHov;

    return {
      background: shatterActive
        ? "transparent"
        : isSp
          ? spaceBg
          : isHov
            ? `linear-gradient(145deg, ${hovCol}22, ${t.bgCard}dd)`
            : t.bgCard,
      border: `${isMobile ? "1.5px" : "2px"} solid ${
        shatterActive
          ? "transparent"
          : isHov
            ? hovCol
            : isSp
              ? "rgba(58,120,212,0.25)"
              : t.border
      }`,
      borderRadius: ip ? 2 : isMobile ? 12 : 20,
      padding: cardPadding,
      cursor: "pointer",
      textAlign: "center" as const,
      transition:
        "transform 0.4s cubic-bezier(.22,.68,0,1.2), box-shadow 0.4s cubic-bezier(.22,.68,0,1.2), background 0.2s linear, border-color 0.2s linear, opacity 0.2s linear",
      transform: isMobile
        ? (isHov ? "scale(1.02)" : "scale(1)")
        : isHov
          ? `translateY(${curveY - 15}px) scale(1.06)`
          : `translateY(${curveY}px)`,
      boxShadow: shatterActive ? "none" : hoverShadow,
      flex: isMobile ? undefined : 1,
      width: isMobile ? "100%" : undefined,
      minWidth: 0,
      position: "relative",
      zIndex: isHov ? 10 : 1,
      ...(isHov ? { overflow: "visible" as const } : {}),
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
      gap: outerGap,
      transition: "background 0.4s",
    }}>

      <FriendsSidePanel themeId={themeId} onHoverAction={onHoverAction} />

      {/* ── Main content ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flex: 1, width: "100%", maxWidth: 1440,
        transform: isMobile ? "none" : `scale(${scale})`,
        transformOrigin: "center center",
        transition: "transform 0.3s cubic-bezier(.22,.68,0,1.2)",
      }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');
          @keyframes starPulse { from { opacity:0.2; transform:scale(0.8); } to { opacity:0.9; transform:scale(1.2); } }
          @keyframes pixelBlink { 0%,100%{opacity:1} 50%{opacity:0.7} }
          @keyframes spaceCardIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          @keyframes purpleSmokeSlashPulse {
            0%, 100% { opacity: 0.68; filter: brightness(1) blur(0.45px); }
            50% { opacity: 1; filter: brightness(1.2) blur(0.3px); }
          }
          @keyframes lightningFlash {
            0%, 4%, 100% { opacity: 0; }
            5% { opacity: 0.95; }
            6% { opacity: 0.15; }
            7% { opacity: 0.85; }
            9% { opacity: 0; }
            62% { opacity: 0; }
            63% { opacity: 0.7; }
            64% { opacity: 0.1; }
            65% { opacity: 0.55; }
            68% { opacity: 0; }
          }
          @keyframes lightningEdgeGlow {
            0%, 100% { opacity: 0.35; filter: brightness(1); }
            50% { opacity: 0.9; filter: brightness(1.15); }
          }
          @keyframes bloodSlashPulse {
            0%, 100% { opacity: 0.72; filter: brightness(1) blur(0.4px); }
            50% { opacity: 1; filter: brightness(1.18) blur(0.25px); }
          }
          @keyframes bloodRiverShift {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
        `}</style>

        {/* ── Title ── */}
        <div style={{ position: "relative", textAlign: "center", width: "100%" }}>
          <h1 style={{
            fontFamily: "'Courier New', monospace",
            fontSize: titleSize,
            fontWeight: 900,
            letterSpacing: isMobile ? "0.1em" : "0.2em",
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
                if (card.key === "lobby") setLobbySlashSeed((s) => s + 1);
              }}
              onMouseLeave={() => setHovered(null)}
              style={cardStyle(card.key, idx)}
            >
              {card.key === "lobby" && hovered === "lobby" && (
                <HoverShatterLayer
                  mode="lobby"
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  cornerRadius={ip ? 2 : isMobile ? 12 : 20}
                  cardPadding={cardPadding}
                  background={`linear-gradient(145deg, ${BLOOD_RED}22, ${t.bgCard}dd)`}
                  isMobile={isMobile}
                  borderColor={BLOOD_RED}
                  borderWidth={isMobile ? "1.5px" : "2px"}
                  titleBlock={
                    <>
                      <div style={{ fontFamily: (themeId === "classic_light" || themeId === "classic_dark" || themeId === "space") ? "'Cinzel', serif" : t.fontDisplay, fontSize: cardTitleSize, fontWeight: 700, color: BLOOD_RED, marginBottom: isMobile ? 4 : 8, position: "relative", zIndex: 2 }}>{card.title}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: cardSubSize, color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted }}>{card.sub}</div>
                    </>
                  }
                  chevron={isMobile ? <div style={{ fontFamily: t.fontMono, fontSize: 18, color: BLOOD_RED, flexShrink: 0 }}>›</div> : null}
                />
              )}
              {card.key === "singleplayer" && hovered === "singleplayer" && (
                <HoverShatterLayer
                  mode="training"
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  cornerRadius={ip ? 2 : isMobile ? 12 : 20}
                  cardPadding={cardPadding}
                  background={`linear-gradient(145deg, #00C8FF22, ${t.bgCard}dd)`}
                  isMobile={isMobile}
                  borderColor="#00C8FF"
                  borderWidth={isMobile ? "1.5px" : "2px"}
                  titleBlock={
                    <>
                      <div style={{ fontFamily: (themeId === "classic_light" || themeId === "classic_dark" || themeId === "space") ? "'Cinzel', serif" : t.fontDisplay, fontSize: cardTitleSize, fontWeight: 700, color: "#00C8FF", marginBottom: isMobile ? 4 : 8, position: "relative", zIndex: 2 }}>{card.title}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: cardSubSize, color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted }}>{card.sub}</div>
                    </>
                  }
                  chevron={isMobile ? <div style={{ fontFamily: t.fontMono, fontSize: 18, color: "#00C8FF", flexShrink: 0 }}>›</div> : null}
                />
              )}
              <div
                style={{
                  flex: isMobile ? 1 : undefined,
                  position: "relative",
                  zIndex: 2,
                  opacity: hovered === card.key ? 0 : 1,
                  transition: "opacity 0.08s ease",
                  visibility: hovered === card.key ? "hidden" : "visible",
                  pointerEvents: hovered === card.key ? "none" : "auto",
                }}
              >
                <div style={{
                  fontFamily: (themeId === "classic_light" || themeId === "classic_dark" || themeId === "space") ? "'Cinzel', serif" : t.fontDisplay,
                  fontSize: cardTitleSize, fontWeight: 700,
                  color: hovered === card.key ? (card.key === "lobby" ? BLOOD_RED : card.key === "ai" ? AI_PURPLE : t.accent) : t.text,
                  marginBottom: isMobile ? 4 : 8, transition: "color 0.2s",
                  position: "relative", zIndex: 2,
                }}>
                  {card.title}
                </div>
                <div style={{
                  fontFamily: t.fontBody,
                  fontSize: cardSubSize,
                  color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted,
                }}>
                  {card.sub}
                </div>
              </div>
              {card.key === "ai" && hovered === "ai" && (
                <HoverShatterLayer
                  mode="ai"
                  borderRadius={ip ? 2 : isMobile ? 12 : 20}
                  cornerRadius={ip ? 2 : isMobile ? 12 : 20}
                  cardPadding={cardPadding}
                  background={
                    isSp
                      ? "linear-gradient(145deg, rgba(58,120,212,0.18), rgba(8,15,40,0.72))"
                      : `linear-gradient(145deg, ${AI_PURPLE}22, ${t.bgCard}dd)`
                  }
                  backdropBlur={undefined}
                  isMobile={isMobile}
                  borderColor={AI_PURPLE}
                  borderWidth={isMobile ? "1.5px" : "2px"}
                  titleBlock={
                    <>
                      <div
                        style={{
                          fontFamily:
                            themeId === "classic_light" || themeId === "classic_dark" || themeId === "space"
                              ? "'Cinzel', serif"
                              : t.fontDisplay,
                          fontSize: cardTitleSize,
                          fontWeight: 700,
                          color: AI_PURPLE,
                          marginBottom: isMobile ? 4 : 8,
                          position: "relative",
                          zIndex: 2,
                        }}
                      >
                        {card.title}
                      </div>
                      <div
                        style={{
                          fontFamily: t.fontBody,
                          fontSize: cardSubSize,
                          color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted,
                        }}
                      >
                        {card.sub}
                      </div>
                    </>
                  }
                  chevron={
                    isMobile ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 18, color: AI_PURPLE, flexShrink: 0 }}>›</div>
                    ) : null
                  }
                />
              )}
              {isMobile && !(card.key === "ai" && hovered === "ai") && (
                <div style={{ fontFamily: t.fontMono, fontSize: 18, color: hovered === card.key ? (card.key === "lobby" ? BLOOD_RED : card.key === "ai" ? AI_PURPLE : t.accent) : t.textMuted, transition: "color 0.2s, transform 0.2s", transform: hovered === card.key ? "translateX(4px)" : "translateX(0)", flexShrink: 0 }}>›</div>
              )}
            </button>
          ))}
        </div>

        {/* ── Rank badge ── */}
        {user && (
          <div style={{ 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8, 
            animation: "fadeUp 0.8s cubic-bezier(.22,.68,0,1.2) both", marginTop: isMobile ? "0.8vh" : "2.3vh",
            transition: "all 0.4s cubic-bezier(.22,.68,0,1.2)",
            filter: hovered === "lobby" ? `drop-shadow(0 0 25px ${BLOOD_RED}44)` : "none",
          }}>
            <NavRankBadge rank={rank} size={isMobile ? 85 : 182} isPlacement={isPlacement} />
            
            <div style={{
              fontFamily: t.fontDisplay, fontSize: isMobile ? 18 : 28, fontWeight: 800,
              color: isPlacement ? placementCol : rank.color, letterSpacing: "0.1em",
              textShadow: isPlacement ? `0 0 20px ${placementCol}66` : `0 0 20px ${rank.color}44`,
              marginTop: isMobile ? 4 : 8,
              textAlign: "center"
            }}>
              {isPlacement ? "PLACEMENT" : rank.name}
            </div>
            
            <div style={{
              fontFamily: t.fontMono, fontSize: isMobile ? 12 : 16, fontWeight: 700,
              color: t.textMuted
            }}>
              <span style={{ color: isPlacement ? placementCol : t.accent }}>{isPlacement ? "?" : (user?.elo ?? 0)}</span> ELO
            </div>


            {hovered === "lobby" && (
              <div style={{ 
                fontFamily: t.fontMono, fontSize: 12, color: BLOOD_RED, letterSpacing: "0.2em", 
                animation: "pixelBlink 1s infinite", fontWeight: 700,
                position: "absolute", bottom: -24, left: "50%", transform: "translateX(-50%)",
                width: "max-content",
                pointerEvents: "none",
                zIndex: 10,
              }}>
                RANKED TARGET ACQUIRED
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Home-notice banner ──────────────────────────────────────────
          Rendered as a real <button> so it is clickable + keyboard
          accessible. Clicking it (a) dismisses the banner immediately,
          (b) clears the friends nav-bar badge and persists a baseline
          so it won't re-arm until a *new* notification arrives, and
          (c) navigates the user to /friends so they can act on
          whatever was new. The dismiss work is done by the parent
          (`onNoticeClickAction`); see `dismissHomeNotice` in
          AppShell.tsx. */}
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
      {/* ── Community CTA row ──────────────────────────────────────────────
          itch.io · Reddit · Discord (anchor) · Feedback email · Instagram.
          All five open in a new tab / launch the OS mail client; URLs
          live in lib/community.ts so every entry point stays in sync.
          The Discord button is the visual anchor (brand colour fill);
          the others are ghost / tinted variants so they read as
          secondary. */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          marginTop: "auto",
          marginBottom: 4,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          gap: isMobile ? 8 : 12,
          flexWrap: "wrap" as const,
          width: "100%",
          maxWidth: 1100,
        }}
      >
        {/* itch.io (far left) — links out to the public itch.io page so
            external visitors can rate / follow / find the dev's other
            games. itch.io's brand red is #FA5C5C. */}
        <button
          type="button"
          onClick={() => { onClickAction?.(); openItchIoPage(); }}
          onMouseEnter={() => { onHoverAction?.(); setHovCommunity("itch"); }}
          onMouseLeave={() => setHovCommunity(null)}
          aria-label="View PentaProtocol on itch.io (opens in a new tab)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "10px 14px" : "12px 18px",
            background: hovCommunity === "itch" ? "#FA5C5C" : "rgba(250,92,92,0.14)",
            border: `1px solid ${hovCommunity === "itch" ? "#FF7A7A" : "rgba(250,92,92,0.65)"}`,
            borderRadius: ip ? 2 : 12,
            color: hovCommunity === "itch" ? "#fff" : "#FF8585",
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 11 : 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
            boxShadow: hovCommunity === "itch"
              ? "0 0 22px rgba(250,92,92,0.55), 0 4px 14px rgba(0,0,0,0.4)"
              : "0 0 10px rgba(250,92,92,0.18)",
            transform: hovCommunity === "itch" ? "translateY(-1px)" : "translateY(0)",
            transition: "background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          {/* No SVG path — itch.io's mascot logo is fiddly and easy to
              corrupt at small sizes. The wordmark itself is the brand,
              so we render a styled pill instead: a small "►" play
              chevron (indie-game shorthand) + the literal "itch.io"
              text in itch.io's brand red. */}
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: isMobile ? 18 : 20,
              height: isMobile ? 18 : 20,
              fontSize: isMobile ? 11 : 13,
              fontWeight: 900,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ▶
          </span>
          <span>itch.io</span>
        </button>

        {/* Reddit */}
        <button
          type="button"
          onClick={() => { onClickAction?.(); openRedditCommunity(); }}
          onMouseEnter={() => { onHoverAction?.(); setHovCommunity("reddit"); }}
          onMouseLeave={() => setHovCommunity(null)}
          aria-label="Visit r/PentaProtocol on Reddit (opens in a new tab)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "10px 14px" : "12px 18px",
            background: hovCommunity === "reddit" ? "#FF4500" : "rgba(255,69,0,0.14)",
            border: `1px solid ${hovCommunity === "reddit" ? "#FF6A33" : "rgba(255,69,0,0.65)"}`,
            borderRadius: ip ? 2 : 12,
            color: hovCommunity === "reddit" ? "#fff" : "#FF7A45",
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 11 : 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
            boxShadow: hovCommunity === "reddit"
              ? "0 0 22px rgba(255,69,0,0.55), 0 4px 14px rgba(0,0,0,0.4)"
              : "0 0 10px rgba(255,69,0,0.18)",
            transform: hovCommunity === "reddit" ? "translateY(-1px)" : "translateY(0)",
            transition: "background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <svg
            aria-hidden="true"
            width={isMobile ? 18 : 20}
            height={isMobile ? 18 : 20}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.04 1.604a3.4 3.4 0 0 1 .045.572c0 2.908-3.358 5.265-7.502 5.265-4.144 0-7.502-2.357-7.502-5.265 0-.193.015-.386.045-.572-.605-.271-1.04-.888-1.04-1.604 0-.968.786-1.754 1.754-1.754.477 0 .898.182 1.207.491 1.207-.864 2.879-1.42 4.74-1.488l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.111-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
          </svg>
          <span>Reddit</span>
        </button>

        {/* Discord (center) — visual anchor */}
        <button
          type="button"
          onClick={() => { onClickAction?.(); openDiscordInvite(); }}
          onMouseEnter={() => { onHoverAction?.(); setHovCommunity("discord"); }}
          onMouseLeave={() => setHovCommunity(null)}
          aria-label="Join the PentaProtocol Discord community (opens in a new tab)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: isMobile ? 8 : 10,
            padding: isMobile ? "10px 16px" : "12px 22px",
            background: hovCommunity === "discord" ? "#5865F2" : "rgba(88,101,242,0.92)",
            border: `1px solid ${hovCommunity === "discord" ? "#7983F5" : "#5865F2"}`,
            borderRadius: ip ? 2 : 12,
            color: "#fff",
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 12 : 14,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
            boxShadow: hovCommunity === "discord"
              ? "0 0 24px rgba(88,101,242,0.65), 0 6px 20px rgba(0,0,0,0.45)"
              : "0 0 14px rgba(88,101,242,0.4), 0 4px 14px rgba(0,0,0,0.35)",
            transform: hovCommunity === "discord" ? "translateY(-1px)" : "translateY(0)",
            transition: "background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <svg
            aria-hidden="true"
            width={isMobile ? 18 : 20}
            height={isMobile ? 18 : 20}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ flexShrink: 0 }}
          >
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
          </svg>
          {/* Single-line label keeps Discord compact enough that all
              five buttons (itch.io · Reddit · Discord · Feedback ·
              Instagram) fit on one row at desktop width without the
              last button wrapping. */}
          <span>Join Discord</span>
          <span aria-hidden="true" style={{ fontSize: isMobile ? 12 : 14, opacity: 0.85, letterSpacing: "0.08em" }}>↗</span>
        </button>

        {/* Feedback email (right) — uses the PentaProtocol logo as its
            icon, since this opens a direct line to the dev team. Uses the
            theme accent so it visually reads as "ours" (vs. Reddit /
            Discord which use external brand colours). */}
        <button
          type="button"
          onClick={() => { onClickAction?.(); openFeedbackEmail(); }}
          onMouseEnter={() => { onHoverAction?.(); setHovCommunity("feedback"); }}
          onMouseLeave={() => setHovCommunity(null)}
          aria-label="Send feedback to the PentaProtocol team via email"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "10px 14px" : "12px 18px",
            background: hovCommunity === "feedback" ? `${accent}26` : `${accent}14`,
            border: `1px solid ${hovCommunity === "feedback" ? accent : `${accent}88`}`,
            borderRadius: ip ? 2 : 12,
            color: hovCommunity === "feedback" ? accent : t.text,
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 11 : 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
            boxShadow: hovCommunity === "feedback"
              ? `0 0 22px ${accent}66, 0 4px 14px rgba(0,0,0,0.4)`
              : `0 0 10px ${accent}22`,
            transform: hovCommunity === "feedback" ? "translateY(-1px)" : "translateY(0)",
            transition: "background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <img
            src="/Pentaprotocol_Logo_Transparent.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              width: isMobile ? 20 : 24,
              height: isMobile ? 20 : 24,
              objectFit: "contain",
              filter: "drop-shadow(0 0 8px rgba(255,100,30,0.45))",
              flexShrink: 0,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          <span>Feedback</span>
        </button>

        {/* Instagram (far right) — sits to the right of Feedback so the
            row reads itch.io · Reddit · Discord · Feedback · Instagram.
            We use Instagram's signature pink #E1306C; on hover the fill
            shifts to the brand gradient (purple → pink → orange) so the
            button visibly comes "alive" the way the IG app icon does. */}
        <button
          type="button"
          onClick={() => { onClickAction?.(); openInstagramPage(); }}
          onMouseEnter={() => { onHoverAction?.(); setHovCommunity("instagram"); }}
          onMouseLeave={() => setHovCommunity(null)}
          aria-label="Follow @pentaprotocol on Instagram (opens in a new tab)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "10px 14px" : "12px 18px",
            background: hovCommunity === "instagram"
              ? "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)"
              : "rgba(225,48,108,0.14)",
            border: `1px solid ${hovCommunity === "instagram" ? "#E1306C" : "rgba(225,48,108,0.65)"}`,
            borderRadius: ip ? 2 : 12,
            color: hovCommunity === "instagram" ? "#fff" : "#F26499",
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 11 : 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
            boxShadow: hovCommunity === "instagram"
              ? "0 0 22px rgba(225,48,108,0.55), 0 4px 14px rgba(0,0,0,0.4)"
              : "0 0 10px rgba(225,48,108,0.18)",
            transform: hovCommunity === "instagram" ? "translateY(-1px)" : "translateY(0)",
            transition: "background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <svg
            aria-hidden="true"
            width={isMobile ? 18 : 20}
            height={isMobile ? 18 : 20}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
          </svg>
          <span>Instagram</span>
        </button>
      </div>

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