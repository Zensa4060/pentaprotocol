"use client";
import { useState } from "react";
import { useApp } from "@/components/AppShell";
import SingleplayerScreen from "@/components/SingleplayerScreen";
import type { BoardMode } from "@/lib/types";
import { buildGameUrl } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/themes";

export default function TrainingPage() {
  const ctx = useApp();
  const router = useRouter();
  const t = THEMES[ctx.themeId] ?? THEMES.classic_dark;
  const [mode, setMode] = useState<"menu" | "singleplayer">("menu");
  const [hoveredCard, setHoveredCard] = useState<"tutorial" | "singleplayer" | null>(null);

  const handleBoardMode = (mode: BoardMode, patterns?: string[]) => {
    ctx.setBoardMode(mode);
    ctx.setSelectedPatterns(patterns || []);
    router.push(buildGameUrl(mode));
  };

  if (mode === "singleplayer") {
    return (
      <SingleplayerScreen
        setScreenAction={ctx.navigate}
        themeId={ctx.themeId}
        onHoverAction={ctx.sfx.hover}
        onBoardModeAction={handleBoardMode}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: t.bg,
        color: t.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: t.fontBody,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 150,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(900px, 96vw)",
          textAlign: "center",
          padding: "4px 8px 2px",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
          <div style={{
            fontFamily: t.fontDisplay,
            fontSize: 70,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.04em",
            textShadow: "0 0 10px rgba(255,255,255,0.88), 0 0 26px rgba(255,255,255,0.5)",
          }}>
           TRAINING
          </div>
      </div>

      <div style={{ width: "min(900px, 96vw)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <button
            onMouseEnter={() => { ctx.sfx.hover?.(); setHoveredCard("tutorial"); }}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("pp_replay_tutorial"));
              }
            }}
            style={{
              textAlign: "center",
              border: `1px solid ${hoveredCard === "tutorial" ? "#7a0000" : `${t.accent}88`}`,
              borderRadius: 12,
              background: hoveredCard === "tutorial" ? "rgba(122,0,0,0.28)" : `${t.accent}14`,
              color: t.text,
              padding: "21px 21px",
              cursor: "pointer",
              transform: hoveredCard === "tutorial" ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
              boxShadow: hoveredCard === "tutorial" ? "0 0 20px rgba(120,0,0,0.78)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{
              fontFamily: t.fontMono,
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontSize: 44,
              color: hoveredCard === "tutorial" ? "#ff3a3a" : t.accent,
              textShadow: hoveredCard === "tutorial" ? "0 0 10px rgba(140,0,0,0.95), 0 0 22px rgba(90,0,0,0.9)" : "none",
              transition: "all 0.2s ease",
            }}>
              TUTORIAL
            </div>
            <div style={{ marginTop: 8, color: t.textSecondary, lineHeight: 1.5, fontSize: 23 }}>
              Replay the guided walkthrough.
            </div>
          </button>

          <button
            onMouseEnter={() => { ctx.sfx.hover?.(); setHoveredCard("singleplayer"); }}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => setMode("singleplayer")}
            style={{
              textAlign: "center",
              border: `1px solid ${hoveredCard === "singleplayer" ? "#7a0000" : t.border}`,
              borderRadius: 12,
              background: hoveredCard === "singleplayer" ? "rgba(122,0,0,0.22)" : t.bgCard,
              color: t.text,
              padding: "21px 21px",
              cursor: "pointer",
              transform: hoveredCard === "singleplayer" ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
              boxShadow: hoveredCard === "singleplayer" ? "0 0 20px rgba(120,0,0,0.78)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{
              fontFamily: t.fontMono,
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontSize: 44,
              color: hoveredCard === "singleplayer" ? "#ff3a3a" : t.text,
              textShadow: hoveredCard === "singleplayer" ? "0 0 10px rgba(140,0,0,0.95), 0 0 22px rgba(90,0,0,0.9)" : "none",
              transition: "all 0.2s ease",
            }}>
              SINGLEPLAYER
            </div>
            <div style={{ marginTop: 8, color: t.textMuted, lineHeight: 1.5, fontSize: 23 }}>
              PRACTICE MODE
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
