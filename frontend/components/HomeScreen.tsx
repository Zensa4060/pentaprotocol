"use client";
import { useState } from "react";
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
  { key: "ai"    as Screen, title: "AI / BOT",         sub: "Practice vs Computer" },
];

export default function HomeScreen({ setScreen, themeId, onHover, onClick }: Props) {
  const t  = THEMES[themeId];
  const ip = themeId === "pixel";
  const [hovered, setHovered] = useState<Screen | null>(null);

  const cardStyle = (key: Screen) => {
    const isHov = hovered === key;
    return {
      background: isHov ? `linear-gradient(145deg, ${t.accent}18, ${t.bgCard})` : t.bgCard,
      border: `2px solid ${isHov ? t.accent : t.border}`,
      borderRadius: ip ? 2 : 16,
      padding: ip ? "44px 28px" : "40px 32px",
      cursor: "pointer", textAlign: "center" as const,
      transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
      transform: isHov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
      boxShadow: isHov ? `0 16px 48px ${t.accent}22` : "none",
      flex: 1, minWidth: 0,
    };
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, overflowY: "auto", background: t.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "80px 32px 48px", gap: 36,
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
          fontSize: ip ? "clamp(36px,6vw,88px)" : "clamp(28px,5.5vw,80px)",
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
        {themeId === "space" && (
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
      <div style={{ display: "flex", gap: ip ? 20 : 22, width: "100%", maxWidth: ip ? 1100 : 980 }}>
        {CARDS.map(card => (
          <button
            key={card.key}
            onClick={() => setScreen(card.key)}
            onMouseEnter={() => { onHover?.(); setHovered(card.key); }}
            onMouseLeave={() => setHovered(null)}
            style={cardStyle(card.key)}
          >
            <div style={{
              fontFamily: (themeId === "classic_light" || themeId === "classic_dark")
                ? "'Cinzel', serif"
                : t.fontDisplay,
              fontSize: ip ? 18 : 24,
              fontWeight: 700,
              color: hovered === card.key ? t.accent : t.text,
              marginBottom: 8, transition: "color 0.2s",
            }}>
              {card.title}
            </div>
            <div style={{ fontFamily: t.fontBody, fontSize: ip ? 13 : 15, color: t.textMuted }}>
              {card.sub}
            </div>
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 48, alignItems: "center" }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 26 : 32, fontWeight: 700, color: t.accent }}>
                {s.value}
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.16em", marginTop: 4 }}>
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