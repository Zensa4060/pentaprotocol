"use client";
import { useState } from "react";
import type { Screen, BoardMode } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { 
  PATTERN_METADATA_5, 
  PATTERN_METADATA_6, 
  PATTERN_METADATA_7, 
  CORE_RULES_METADATA_5,
  CORE_RULES_METADATA_6,
  CORE_RULES_METADATA_7,
  PatternInfo 
} from "@/lib/patterns_metadata";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onHoverAction?: () => void;
  onBoardModeAction?: (mode: BoardMode, patterns?: string[]) => void;
}

function PatternDiagram({ info, accent, isSelected }: { info: PatternInfo; accent: string; isSelected: boolean }) {
  const { cells, gridSize } = info;
  const cellSize = gridSize === 7 ? 11 : gridSize === 6 ? 12 : 13;
  const gap = 2;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
      gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
      gap,
    }}>
      {Array.from({ length: gridSize }, (_, r) =>
        Array.from({ length: gridSize }, (_, c) => {
          const filled = cellSet.has(`${r},${c}`);
          return (
            <div key={`${r}-${c}`} style={{
              width: cellSize,
              height: cellSize,
              borderRadius: 3,
              background: filled
                ? isSelected ? accent : `${accent}88`
                : "rgba(255,255,255,0.06)",
              border: filled ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
              boxShadow: filled && isSelected ? `0 0 8px ${accent}44` : "none",
              transition: "all 0.2s",
            }} />
          );
        })
      )}
    </div>
  );
}

export default function SingleplayerScreen({ setScreenAction, themeId, onHoverAction, onBoardModeAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [step, setStep] = useState<"mode" | "patterns">("mode");

  const meta = boardMode === "7x7" ? PATTERN_METADATA_7 : boardMode === "6x6" ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const references = boardMode === "7x7" ? CORE_RULES_METADATA_7 : boardMode === "6x6" ? CORE_RULES_METADATA_6 : CORE_RULES_METADATA_5;
  const patternNames = Object.keys(meta);
  const referenceNames = Object.keys(references);

  const goBack = () => {
    if (step === "patterns") {
      setStep("mode");
    } else {
      setScreenAction("home");
    }
  };

  const proceedFromPatterns = () => {
    onBoardModeAction?.(boardMode, [...patternNames]);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, background: themeId === "space" ? "transparent" : t.bg, transition: "background 0.4s",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly",
      padding: "70px 24px 40px", overflowY: "auto",
    }}>
      <style>{`
        @keyframes cardFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .sp-card { will-change: transform; transition: all 0.3s cubic-bezier(.22,.68,0,1.2) !important; }
        .sp-card:hover {
          transform: translateY(-4px) scale(1.02) !important;
          box-shadow: 0 16px 48px var(--hover-glow) !important;
          background: linear-gradient(145deg, var(--hover-bg), var(--card-bg)) !important;
        }
        .sp-card.selected {
          border-color: var(--hover-color) !important;
          background: linear-gradient(145deg, var(--hover-bg), var(--card-bg)) !important;
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 16px 48px var(--hover-glow);
        }
      `}</style>

      {/* ── STEP 1: Board Mode Selection ── */}
      {step === "mode" && (
        <>
          <div style={{
            fontFamily: t.fontDisplay,
            fontSize: "clamp(32px,6vw,72px)",
            fontWeight: 900, color: t.accent, textAlign: "center",
            textShadow: `0 0 60px ${t.accentGlow}44`,
            letterSpacing: ip ? "0.08em" : "0.04em",
            lineHeight: 1.1,
          }}>
            GOT NO ONE TO PLAY WITH?
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 480 }}>
            {(["5x5", "6x6", "7x7"] as BoardMode[]).map((mode, i) => {
              const isSelected = boardMode === mode;
              const modeColor = mode === "5x5" ? "#60A8FF" : mode === "6x6" ? "#A78BFA" : "#FF6B35";
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setBoardMode(mode);
                    setStep("patterns");
                  }}
                  className={`sp-card ${isSelected ? "selected" : ""}`}
                  style={{
                    background: t.bgCard,
                    border: `2px solid ${t.border}`,
                    borderRadius: ip ? 2 : 16,
                    padding: ip ? "28px 24px" : "32px 28px",
                    cursor: "pointer", textAlign: "left",
                    animation: `cardFadeUp 0.45s cubic-bezier(.22,.68,0,1.2) ${i * 0.08}s both`,
                    ["--hover-color" as any]: modeColor,
                    ["--hover-bg" as any]: `${modeColor}18`,
                    ["--hover-glow" as any]: `${modeColor}22`,
                    ["--card-bg" as any]: t.bgCard,
                  } as any}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: modeColor, boxShadow: `0 0 12px ${modeColor}66`,
                    }} />
                    <div style={{
                      fontFamily: t.fontDisplay, fontSize: ip ? 20 : 26, fontWeight: 700,
                      color: isSelected ? modeColor : t.text, transition: "color 0.2s", letterSpacing: "0.06em",
                    }}>
                      {mode === "5x5" ? "5 × 5" : mode === "6x6" ? "6 × 6" : "7 × 7"}
                    </div>
                  </div>
                  <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, lineHeight: 1.5 }}>
                    {mode === "5x5"
                      ? ""
                      : mode === "6x6"
                        ? ""
                        : ""
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── STEP 2: Pattern reference (all patterns in play; view-only) ── */}
      {step === "patterns" && (
        <>
          <div style={{
            fontFamily: t.fontDisplay,
            fontSize: "clamp(24px,5vw,48px)",
            fontWeight: 900, color: t.accent, textAlign: "center",
            textShadow: `0 0 40px ${t.accentGlow}44`,
            letterSpacing: ip ? "0.08em" : "0.04em",
            lineHeight: 1.1,
          }}>
            WIN PATTERNS
          </div>

          <div style={{
            fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500,
            lineHeight: 1.6,
          }}>
            All <span style={{ color: t.accent, fontWeight: 700 }}>{patternNames.length}</span> patterns for {boardMode} are active in every game (no picking).
            {" "}Win conditions also include {boardMode === "7x7" ? "7" : boardMode === "6x6" ? "6" : "5"}-in-a-line and full-board chain rules.
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: boardMode === "7x7" ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8, width: "100%", maxWidth: boardMode === "7x7" ? 800 : 720,
          }}>
            {[...patternNames, ...referenceNames].map((name, i) => {
              const isReference = referenceNames.includes(name);
              const info = isReference ? (references as any)[name] : meta[name];

              return (
                <div
                  key={name}
                  className="sp-card"
                  style={{
                    background: t.bgCard,
                    border: isReference ? `2px dashed ${t.border}aa` : (info.isException ? `2px solid #B22222` : `2px solid ${t.border}`),
                    borderRadius: ip ? 2 : 14,
                    padding: "16px 14px",
                    cursor: "default",
                    textAlign: "left",
                    animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`,
                    ["--hover-color" as any]: isReference ? t.textMuted : (info.isException ? "#FF4444" : t.accent),
                    ["--hover-bg" as any]: isReference ? `${t.textSecondary}08` : (info.isException ? `#B222221A` : `${t.accent}1A`),
                    ["--hover-glow" as any]: isReference ? "transparent" : (info.isException ? `#B2222222` : `${t.accent}22`),
                    ["--card-bg" as any]: t.bgCard,
                    boxShadow: isReference ? "none" : (info.isException ? `0 0 20px #B2222222` : "none"),
                    opacity: isReference ? 0.8 : 1,
                  } as any}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{
                        fontFamily: t.fontDisplay, fontSize: ip ? 12 : 14, fontWeight: 700,
                        color: isReference ? t.textSecondary : (info.isException ? "#B22222" : t.text),
                        letterSpacing: "0.06em",
                      }}>
                        {info.label}
                      </div>
                      {isReference && (
                        <div style={{
                          fontFamily: t.fontMono, fontSize: 8, fontWeight: 900,
                          padding: "2px 6px", borderRadius: 4,
                          background: `${t.accent}15`, color: t.accent,
                          border: `1px solid ${t.accent}44`,
                          letterSpacing: "0.1em"
                        }}>CORE RULE</div>
                      )}
                    </div>
                    <div style={{
                      fontFamily: t.fontBody, fontSize: ip ? 10 : 11, color: t.textMuted,
                      lineHeight: 1.4, marginBottom: 4,
                    }}>
                      {info.desc}
                    </div>
                    <div style={{
                      fontFamily: t.fontMono, fontSize: 9, fontWeight: 700,
                      color: isReference ? t.textMuted : (info.isException ? "#FF4444" : t.accent),
                      letterSpacing: "0.08em", marginBottom: 10,
                      textTransform: "uppercase", opacity: 0.8
                    }}>
                      {isReference ? "FIXED RULE" : `${info.mirrorCount} MIRRORS${info.mirrorCount === 8 ? " HIGHLIGHTED" : ""}`}
                    </div>
                    <PatternDiagram info={info} accent={isReference ? t.textMuted : (info.isException ? "#B22222" : t.accent)} isSelected={false} />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onHoverAction?.();
              proceedFromPatterns();
            }}
            style={{
              background: t.accent,
              border: `2px solid ${t.accent}`,
              color: "#000",
              fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
              padding: ip ? "12px 32px" : "14px 52px", borderRadius: ip ? 2 : 10,
              cursor: "pointer",
              letterSpacing: "0.06em", transition: "all 0.3s",
              boxShadow: `0 0 24px ${t.accentGlow}44`,
            }}
          >
            START MATCH →
          </button>
        </>
      )}

      {/* Back button */}
      <button
        onClick={goBack}
        style={{
          background: "transparent", border: "none", color: t.textMuted, fontFamily: t.fontDisplay,
          fontSize: 16, cursor: "pointer", marginTop: 24, letterSpacing: "0.06em", transition: "color 0.2s",
        }}
        onMouseEnter={(e) => { onHoverAction?.(); e.currentTarget.style.color = t.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; }}
      >
        ← GO BACK
      </button>
    </div>
  );
}
