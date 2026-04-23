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
        padding: "24px 16px",
        fontFamily: t.fontBody,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          // On mobile the nav bar eats ~52px of vertical space and the title
          // was colliding with it at top:150 once the viewport became narrow.
          // Using a responsive offset keeps the desktop layout untouched
          // while pulling the title up on phones so the cards don't get
          // pushed off-screen below the fold.
          top: "clamp(80px, 14vh, 150px)",
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
            // clamp keeps the desktop 70px look intact at ≥ 900px viewport
            // width, but scales down to ~34px on a 360px phone so the heading
            // never triggers horizontal scroll.
            fontSize: "clamp(34px, 9vw, 70px)",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.04em",
            textShadow: "0 0 10px rgba(255,255,255,0.88), 0 0 26px rgba(255,255,255,0.5)",
          }}>
           TRAINING
          </div>
      </div>

      <div style={{ width: "min(900px, 96vw)", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ``minmax(min(300px, 100%), 1fr)`` (rather than a fixed 300px) lets
            the card column collapse on viewports < 300px wide — which
            happens on very narrow phones in landscape-to-portrait rotation —
            instead of overflowing the grid track. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 24 }}>
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
              // overflow:hidden prevents the hover shadow from being clipped
              // on narrow screens and also stops the oversize card title
              // from spilling past the rounded border.
              overflow: "hidden",
            }}
          >
            <div style={{
              fontFamily: t.fontMono,
              fontWeight: 700,
              letterSpacing: "0.08em",
              // clamp preserves the 44px desktop title while shrinking to
              // ~22px on a 360px phone so "SINGLEPLAYER" stops clipping.
              fontSize: "clamp(22px, 6.6vw, 44px)",
              color: hoveredCard === "tutorial" ? "#ff3a3a" : t.accent,
              textShadow: hoveredCard === "tutorial" ? "0 0 10px rgba(140,0,0,0.95), 0 0 22px rgba(90,0,0,0.9)" : "none",
              transition: "all 0.2s ease",
              overflowWrap: "anywhere",
            }}>
              TUTORIAL
            </div>
            <div style={{ marginTop: 8, color: t.textSecondary, lineHeight: 1.5, fontSize: "clamp(14px, 3.2vw, 23px)" }}>
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
              overflow: "hidden",
            }}
          >
            <div style={{
              fontFamily: t.fontMono,
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontSize: "clamp(22px, 6.6vw, 44px)",
              color: hoveredCard === "singleplayer" ? "#ff3a3a" : t.text,
              textShadow: hoveredCard === "singleplayer" ? "0 0 10px rgba(140,0,0,0.95), 0 0 22px rgba(90,0,0,0.9)" : "none",
              transition: "all 0.2s ease",
              overflowWrap: "anywhere",
            }}>
              SINGLEPLAYER
            </div>
            <div style={{ marginTop: 8, color: t.textMuted, lineHeight: 1.5, fontSize: "clamp(14px, 3.2vw, 23px)" }}>
              PRACTICE MODE
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
