"use client";
import { useState } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import { THEMES } from "@/lib/themes";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onSelectDifficulty: (d: Difficulty) => void;
  onHover?: () => void;
}

const DIFFICULTIES: { id: Difficulty; label: string; sub: string; color: string }[] = [
  { id: "easy",   label: "EASY",   sub: "Random moves — great for learning the rules",      color: "#22C55E" },
  { id: "medium", label: "MEDIUM", sub: "Strategic play — a fair challenge for most players", color: "#EAB308" },
  { id: "hard",   label: "HARD",   sub: "Elite AI — deep search, near-perfect play",          color: "#EF4444" },
];

export default function AIScreen({ setScreen, themeId, onSelectDifficulty, onHover }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const [hovered, setHovered] = useState<Difficulty | null>(null);

  const handleSelect = (d: Difficulty) => {
    onSelectDifficulty(d);
    setScreen("aiGame");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, background: t.bg, transition: "background 0.4s",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "84px 24px 48px", gap: 32, overflowY: "auto",
    }}>
      <style>{`
        @keyframes cardFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Title */}
      <div style={{
        fontFamily: t.fontDisplay,
        fontSize: "clamp(32px,6vw,72px)",
        fontWeight: 900, color: t.accent, textAlign: "center",
        textShadow: `0 0 60px ${t.accentGlow}44`,
        letterSpacing: ip ? "0.08em" : "0.04em",
        lineHeight: 1.1,
      }}>
        VS COMPUTER
      </div>

      <div style={{ fontFamily: t.fontBody, fontSize: 16, color: t.textMuted, textAlign: "center", maxWidth: 440 }}>
        Choose your difficulty and challenge the AI
      </div>

      {/* Difficulty cards */}
      <div style={{ display: "flex", gap: ip ? 16 : 20, width: "100%", maxWidth: 820, flexWrap: "wrap", justifyContent: "center" }}>
        {DIFFICULTIES.map((d, i) => {
          const isHov = hovered === d.id;
          return (
            <button
              key={d.id}
              onClick={() => handleSelect(d.id)}
              onMouseEnter={() => { onHover?.(); setHovered(d.id); }}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1, minWidth: 200,
                background: isHov ? `linear-gradient(145deg, ${d.color}18, ${t.bgCard})` : t.bgCard,
                border: `2px solid ${isHov ? d.color : t.border}`,
                borderRadius: ip ? 2 : 16,
                padding: ip ? "36px 24px" : "40px 28px",
                cursor: "pointer", textAlign: "left",
                transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
                transform: isHov ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
                boxShadow: isHov ? `0 16px 48px ${d.color}22` : "none",
                animation: `cardFadeUp 0.45s cubic-bezier(.22,.68,0,1.2) ${i * 0.08}s both`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: d.color, boxShadow: `0 0 12px ${d.color}66`,
                }} />
                <div style={{
                  fontFamily: t.fontDisplay, fontSize: ip ? 18 : 22, fontWeight: 700,
                  color: isHov ? d.color : t.text, transition: "color 0.2s", letterSpacing: "0.06em",
                }}>
                  {d.label}
                </div>
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, lineHeight: 1.5 }}>
                {d.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Back button */}
      <button onClick={() => setScreen("home")} style={{
        background: `${t.accent}18`, border: `2px solid ${t.accent}`,
        color: t.accent, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
        padding: "14px 44px", borderRadius: ip ? 2 : 10,
        cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s", marginTop: 8,
      }}
        onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
      >
        GO BACK
      </button>
    </div>
  );
}