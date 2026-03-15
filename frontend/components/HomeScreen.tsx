"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { getRank, NavRankBadge } from "./NavBar";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onHover?: () => void;
  onClick?: () => void;
}


const CARDS = [
  { key: "game"  as Screen, title: "SINGLEPLAYER", sub: "Local · Pass & Play · Bo3" },
  { key: "lobby" as Screen, title: "MULTIPLAYER",  sub: "Online · Ranked & Unranked" },
  { key: "ai"    as Screen, title: "AI / BOT",     sub: "Practice vs Computer" },
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

export default function HomeScreen({ setScreen, themeId, onHover, onClick }: Props) {
  const t  = THEMES[themeId];
  const ip = themeId === "pixel";
  const bp = useBreakpoint();
  const [hovered, setHovered] = useState<Screen | null>(null);

  const isMobile  = bp === "mobile";
  const isTablet  = bp === "tablet";
  const isDesktop = bp === "desktop";

  // ── Responsive tokens ─────────────────────────────────────────────────────
  const titleSize = isMobile
    ? "clamp(35px, 10vw, 49px)"
    : isTablet
    ? "clamp(43px, 7vw, 67px)"
    : ip ? "clamp(43px, 7vw, 95px)" : "clamp(43px, 7vw, 97px)";

  // Increased by 50% + another 5%
  const cardTitleSize = isMobile ? 24 : isTablet ? 28 : 34;
  const cardSubSize   = isMobile ? 18 : isTablet ? 20 : 22;

  // Made into vertical rectangles
  const cardPadding = isMobile
    ? "52px 26px"
    : "72px 40px";

  const outerPadding = isMobile
    ? "90px 16px 32px"
    : isTablet
    ? "100px 24px 40px"
    : "100px 32px 48px";

  const outerGap = isMobile ? 32 : isTablet ? 40 : 50;

  // Cards: stack vertically on mobile, horizontally on tablet+
  const cardsLayout: React.CSSProperties = { display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, width: "100%", maxWidth: 1380, marginTop: "10vh" };

  const { user } = useAuthStore();
  const rank = getRank(user?.elo ?? 0);

  const cardStyle = (key: Screen, index: number): React.CSSProperties => {
    const isHov = hovered === key;
    
    // Curved layout values for desktop
    let curveY = 0;
    if (!isMobile) {
      if (index === 0) { curveY = 60; } // Left box - deeper curve
      if (index === 2) { curveY = 60; } // Right box - deeper curve
      // index 1 (Multiplayer) stays at curveY=0
    }

    return {
      background: isHov ? `linear-gradient(145deg, ${t.accent}22, ${t.bgCard}dd)` : t.bgCard,
      border: `${isMobile ? "1.5px" : "2px"} solid ${isHov ? t.accent : t.border}`,
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
      boxShadow: isHov ? `0 24px 64px ${t.accent}33, 0 0 20px ${t.accent}11` : "none",
      flex: isMobile ? undefined : 1,
      width: isMobile ? "100%" : undefined,
      minWidth: 0,
      position: "relative",
      zIndex: isHov ? 10 : 1,
      ...(isMobile ? { display: "flex", alignItems: "center", gap: 16, textAlign: "left" as const } : {}),
    };
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, overflowY: "auto", background: t.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: outerPadding, gap: outerGap,
      transition: "background 0.4s",
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');
        @keyframes starPulse { from { opacity:0.2; transform:scale(0.8); } to { opacity:0.9; transform:scale(1.2); } }
        @keyframes pixelBlink { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>

      {/* Title */}
      <div style={{ position: "relative", textAlign: "center", width: "100%" }}>
        <h1 style={{
          fontFamily: "'Courier New', monospace",
          fontSize: titleSize,
          fontWeight: 900,
          letterSpacing: isMobile ? "0.1em" : "0.2em",
          textAlign: "center", lineHeight: 1,
          margin: 0,
        }}>
          <span style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #999999 50%, #ffffff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
            display: "inline",
          }}>PENTA</span>
          <br style={{ display: isMobile ? "block" : "none" }} />
          <span style={{
            background: "linear-gradient(to bottom, #FF2200 0%, #8B0000 45%, #FF1100 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 12px rgba(255,30,0,0.7))",
            display: "inline",
          }}>PROTOCOL</span>
        </h1>
        {themeId === "space" && !isMobile && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {["✦","·","✧","★","·","✦","✧","·","★"].map((star, i) => (
              <span key={i} style={{
                position: "absolute",
                left: `${8 + i * 10}%`,
                top: `${20 + (i % 3) * 30}%`,
                color: ["#FFD060","#60A8FF","#00E87A","#FFFFFF"][i % 4],
                fontSize: [8,12,6,10,14,7,11,9,13][i],
                opacity: 0.6,
                animation: `starPulse ${1.5 + i * 0.3}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.2}s`,
              }}>{star}</span>
            ))}
          </div>
        )}
      </div>

      {/* Game mode cards */}
      <div style={cardsLayout}>
        {CARDS.map(card => (
          <button
            key={card.key}
            onClick={() => { onClick?.(); setScreen(card.key); }}
            onMouseEnter={() => { onHover?.(); setHovered(card.key); }}
            onMouseLeave={() => setHovered(null)}
            style={cardStyle(card.key, CARDS.indexOf(card))}
          >
            {/* Mobile: left-aligned text block */}
            <div style={{ flex: isMobile ? 1 : undefined }}>
              <div style={{
                fontFamily: (themeId === "classic_light" || themeId === "classic_dark")
                  ? "'Cinzel', serif"
                  : t.fontDisplay,
                fontSize: cardTitleSize,
                fontWeight: 700,
                color: hovered === card.key ? t.accent : t.text,
                marginBottom: isMobile ? 4 : 8,
                transition: "color 0.2s",
              }}>
                {card.title}
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: cardSubSize, color: t.textMuted }}>
                {card.sub}
              </div>
            </div>
            {/* Mobile: right-pointing arrow */}
            {isMobile && (
              <div style={{
                fontFamily: t.fontMono, fontSize: 18,
                color: hovered === card.key ? t.accent : t.textMuted,
                transition: "color 0.2s, transform 0.2s",
                transform: hovered === card.key ? "translateX(4px)" : "translateX(0)",
                flexShrink: 0,
              }}>›</div>
            )}
          </button>
        ))}
      </div>

      {/* Rank Logo Space at Bottom */}
      {user && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          animation: "fadeUp 0.8s cubic-bezier(.22,.68,0,1.2) both",
          marginTop: "2vh"
        }}>
          <NavRankBadge rank={rank} size={isMobile ? 121 : 182} />
        </div>
      )}
    </div>
  );
}