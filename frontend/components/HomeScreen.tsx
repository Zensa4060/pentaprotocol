"use client";
import { useState, useEffect } from "react";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onHover?: () => void;
  onClick?: () => void;
}

const STATS = [
  { label: "SEASON", value: "BETA" },
];

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
    ? "clamp(28px, 9vw, 42px)"
    : isTablet
    ? "clamp(36px, 6vw, 60px)"
    : ip ? "clamp(36px,6vw,88px)" : "clamp(28px,5.5vw,80px)";

  const cardTitleSize = isMobile ? 15 : isTablet ? 18 : ip ? 18 : 24;
  const cardSubSize   = isMobile ? 12 : isTablet ? 13 : ip ? 13 : 15;

  const cardPadding = isMobile
    ? "24px 16px"
    : isTablet
    ? "32px 22px"
    : ip ? "44px 28px" : "40px 32px";

  const outerPadding = isMobile
    ? "72px 16px 32px"
    : isTablet
    ? "80px 24px 40px"
    : "80px 32px 48px";

  const outerGap = isMobile ? 24 : isTablet ? 28 : 36;

  // Cards: stack on mobile, row on tablet+
  const cardsLayout: React.CSSProperties = isMobile
    ? { display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 480 }
    : { display: "flex", flexDirection: "row", gap: ip ? 20 : 22, width: "100%", maxWidth: isTablet ? 800 : ip ? 1100 : 980 };

  const cardStyle = (key: Screen): React.CSSProperties => {
    const isHov = hovered === key;
    return {
      background: isHov ? `linear-gradient(145deg, ${t.accent}18, ${t.bgCard})` : t.bgCard,
      border: `${isMobile ? "1.5px" : "2px"} solid ${isHov ? t.accent : t.border}`,
      borderRadius: ip ? 2 : isMobile ? 12 : 16,
      padding: cardPadding,
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
      transform: isHov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
      boxShadow: isHov ? `0 16px 48px ${t.accent}22` : "none",
      // On mobile: full width; on tablet+: flex equal columns
      flex: isMobile ? undefined : 1,
      width: isMobile ? "100%" : undefined,
      minWidth: 0,
      // Mobile: horizontal layout with icon-left / text-right feel
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
      <div style={{ position: "relative", textAlign: "center" }}>
        <h1 style={{
          fontFamily: (themeId === "classic_light" || themeId === "classic_dark")
            ? "'Cinzel', serif"
            : t.fontDisplay,
          fontSize: titleSize,
          fontWeight: 900, color: t.accent,
          letterSpacing: (themeId === "classic_light" || themeId === "classic_dark")
            ? "0.12em"
            : ip ? "0.08em" : "0.06em",
          textAlign: "center", lineHeight: 1,
          textShadow: themeId === "space"
            ? `0 0 20px ${t.accentGlow}CC, 0 0 60px ${t.accentGlow}66, 0 0 120px ${t.accentGlow}33`
            : themeId === "pixel"
            ? `4px 4px 0px ${t.accentGlow}88, -2px -2px 0 #000`
            : (themeId === "classic_light" || themeId === "classic_dark")
            ? `0 2px 12px ${t.accentGlow}22`
            : `0 0 60px ${t.accentGlow}33`,
          margin: 0,
        }}>
          PENTAPROTOCOL
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
            style={cardStyle(card.key)}
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

      {/* Stats row */}
      <div style={{ display: "flex", gap: isMobile ? 24 : 48, alignItems: "center" }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: isMobile ? 24 : 48 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: t.fontDisplay,
                fontSize: isMobile ? 20 : isTablet ? 26 : ip ? 26 : 32,
                fontWeight: 700, color: t.accent,
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: t.fontMono,
                fontSize: isMobile ? 9 : 11,
                color: t.textMuted, letterSpacing: "0.16em", marginTop: 4,
              }}>
                {s.label}
              </div>
            </div>
            {i < STATS.length - 1 && <div style={{ width: 1, height: 32, background: t.border }} />}
          </div>
        ))}
      </div>

    </div>
  );
}