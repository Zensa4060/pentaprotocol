"use client";
import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { getRank, NavRankBadge } from "./NavBar";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

const CARDS = [
  { key: "game" as Screen, title: "SINGLEPLAYER", sub: "Local · Pass & Play · Bo3" },
  { key: "lobby" as Screen, title: "MULTIPLAYER", sub: "Online · Ranked & Unranked" },
  { key: "ai" as Screen, title: "AI / BOT", sub: "Practice vs Computer" },
];

type Breakpoint = "mobile" | "tablet" | "desktop";

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
      const scaleW = vw < 1300 ? vw / 1380 : 1;
      const scaleH = vh < 850 ? (vh - 100) / 750 : 1;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

export default function HomeScreen({ setScreenAction, themeId, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const isSp = themeId === "space";
  const bp = useBreakpoint();
  const scale = useScale();
  const [hovered, setHovered] = useState<Screen | null>(null);
  const [hovFooter, setHovFooter] = useState<string | null>(null);

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const accent = themeId === "classic_light" || themeId === "classic_dark" ? "#CC0000" : t.accent;

  const titleSize = isMobile
    ? "clamp(35px, 10vw, 49px)"
    : isTablet
      ? "clamp(43px, 7vw, 67px)"
      : ip ? "clamp(43px, 7vw, 95px)" : "clamp(43px, 7vw, 97px)";

  const cardTitleSize = isMobile ? 24 : isTablet ? 28 : 34;
  const cardSubSize = isMobile ? 18 : isTablet ? 20 : 22;
  const cardPadding = isMobile ? "32px 26px" : "72px 40px";
  const outerPadding = isMobile ? "30px 16px 30px" : isTablet ? "100px 24px 40px" : "80px 32px 48px";
  const outerGap = isMobile ? 32 : isTablet ? 40 : 50;

  const cardsLayout: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    gap: isMobile ? 12 : 24,
    width: "100%",
    maxWidth: 1380,
    marginTop: isMobile ? "5vh" : "8vh",
  };

  const { user } = useAuthStore();
  const rank = getRank(user?.elo ?? 0);

  const cardStyle = (key: Screen, index: number): React.CSSProperties => {
    const isHov = hovered === key;
    let curveY = 0;
    if (!isMobile) {
      if (index === 0) curveY = 60;
      if (index === 2) curveY = 60;
    }

    const spaceBg = isHov
      ? "linear-gradient(145deg, rgba(58,120,212,0.18), rgba(8,15,40,0.72))"
      : "rgba(6,12,34,0.52)";

    return {
      background: isSp ? spaceBg : (isHov ? `linear-gradient(145deg, ${t.accent}22, ${t.bgCard}dd)` : t.bgCard),
      border: `${isMobile ? "1.5px" : "2px"} solid ${isHov ? t.accent : (isSp ? "rgba(58,120,212,0.25)" : t.border)}`,
      borderRadius: ip ? 2 : isMobile ? 12 : 20,
      padding: cardPadding,
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 0.4s cubic-bezier(.22,.68,0,1.2)",
      transform: isMobile
        ? (isHov ? "scale(1.02)" : "scale(1)")
        : isHov
          ? `translateY(${curveY - 15}px) scale(1.06)`
          : `translateY(${curveY}px)`,
      boxShadow: isHov
        ? isSp
          ? `0 24px 64px rgba(58,120,212,0.35), 0 0 30px rgba(96,168,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`
          : `0 24px 64px ${t.accent}33, 0 0 20px ${t.accent}11`
        : isSp
          ? "inset 0 1px 0 rgba(255,255,255,0.04)"
          : "none",
      backdropFilter: isSp ? "blur(12px)" : undefined,
      WebkitBackdropFilter: isSp ? "blur(12px)" : undefined,
      flex: isMobile ? undefined : 1,
      width: isMobile ? "100%" : undefined,
      minWidth: 0,
      position: "relative",
      zIndex: isHov ? 10 : 1,
      ...(isMobile ? { display: "flex", alignItems: "center", gap: 16, textAlign: "left" as const } : {}),
    };
  };

  const FOOTER_LINKS: { label: string; screen: Screen }[] = [
    { label: "Terms & Conditions", screen: "terms" },
    { label: "Privacy Policy",     screen: "privacy" },
    { label: "Refund Policy",      screen: "refund" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, overflowY: "auto",
      background: themeId === "pixel" ? "url(/bg-pixel-hills.png) center/cover no-repeat" : isSp ? "url(/bg-earth.png) center/cover no-repeat" : t.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: outerPadding, gap: outerGap,
      transition: "background 0.4s",
    }}>

      {/* ── Darkening overlay ── */}
      {isSp && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 4, 20, 0.50)",
          pointerEvents: "none", zIndex: 1,
        }} />
      )}

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
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&family=Exo+2:ital,wght@0,300;0,400;0,600;0,800;1,300&display=swap');
          @keyframes starPulse { from { opacity:0.2; transform:scale(0.8); } to { opacity:0.9; transform:scale(1.2); } }
          @keyframes pixelBlink { 0%,100%{opacity:1} 50%{opacity:0.7} }
          @keyframes spaceCardIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        `}</style>

        {/* ── Title ── */}
        <div style={{ position: "relative", textAlign: "center", width: "100%" }}>
          <h1 style={{
            fontFamily: isSp ? "'Orbitron', sans-serif" : "'Courier New', monospace",
            fontSize: titleSize,
            fontWeight: 900,
            letterSpacing: isMobile ? "0.1em" : isSp ? "0.28em" : "0.2em",
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
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, letterSpacing: "0.4em", color: "rgba(140,180,255,0.45)", textTransform: "uppercase", marginTop: 12 }}>
              Best of 3 · 5×5 · Rulebreaker
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
              onClick={() => { onClickAction?.(); setScreenAction(card.key); }}
              onMouseEnter={() => { onHoverAction?.(); setHovered(card.key); }}
              onMouseLeave={() => setHovered(null)}
              style={cardStyle(card.key, idx)}
            >
              <div style={{ flex: isMobile ? 1 : undefined }}>
                <div style={{
                  fontFamily: isSp ? "'Orbitron', sans-serif" : (themeId === "classic_light" || themeId === "classic_dark") ? "'Cinzel', serif" : t.fontDisplay,
                  fontSize: cardTitleSize, fontWeight: 700,
                  letterSpacing: isSp ? "0.18em" : undefined,
                  color: hovered === card.key ? t.accent : t.text,
                  marginBottom: isMobile ? 4 : 8, transition: "color 0.2s",
                }}>
                  {card.title}
                </div>
                <div style={{
                  fontFamily: isSp ? "'Rajdhani', sans-serif" : t.fontBody,
                  fontSize: cardSubSize,
                  letterSpacing: isSp ? "0.12em" : undefined,
                  color: isSp ? "rgba(140,180,255,0.5)" : t.textMuted,
                }}>
                  {card.sub}
                </div>
              </div>
              {isMobile && (
                <div style={{ fontFamily: t.fontMono, fontSize: 18, color: hovered === card.key ? t.accent : t.textMuted, transition: "color 0.2s, transform 0.2s", transform: hovered === card.key ? "translateX(4px)" : "translateX(0)", flexShrink: 0 }}>›</div>
              )}
            </button>
          ))}
        </div>

        {/* ── Rank badge ── */}
        {user && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "fadeUp 0.8s cubic-bezier(.22,.68,0,1.2) both", marginTop: "2.3vh" }}>
            <NavRankBadge rank={rank} size={isMobile ? 85 : 182} />
          </div>
        )}

      </div>

      {/* ── Footer legal links ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: isMobile ? 16 : 28,
        flexWrap: "wrap" as const,
        paddingTop: 12,
        paddingBottom: isMobile ? 16 : 8,
        width: "100%",
        borderTop: `1px solid ${isSp ? "rgba(58,120,212,0.15)" : t.border}`,
      }}>
        {FOOTER_LINKS.map((link, i) => (
          <React.Fragment key={link.screen}>
            <button
              onClick={() => setScreenAction(link.screen)}
              onMouseEnter={() => setHovFooter(link.screen)}
              onMouseLeave={() => setHovFooter(null)}
              style={{
                background: "transparent",
                border: "none",
                fontFamily: t.fontMono,
                fontSize: isMobile ? 9 : 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: hovFooter === link.screen
                  ? accent
                  : isSp
                    ? "rgba(140,180,255,0.35)"
                    : t.textMuted,
                cursor: "pointer",
                padding: "4px 2px",
                transition: "color 0.2s",
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap" as const,
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