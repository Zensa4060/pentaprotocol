"use client";
import { useState } from "react";
import type { Screen, BoardMode } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { PATTERN_NAMES_7, type PatternName7 } from "@/lib/winChecker7";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onHoverAction?: () => void;
  onBoardModeAction?: (mode: BoardMode, patterns?: string[]) => void;
}

const PATTERN_INFO: Record<PatternName7, { label: string; desc: string; cells: [number, number][] }> = {
  H: {
    label: "H-SHAPE",
    desc: "Two vertical bars connected by a horizontal bridge",
    cells: [[0,0],[1,0],[2,0],[1,1],[0,2],[1,2],[2,2]],
  },
  L: {
    label: "L-SHAPE",
    desc: "A vertical bar turning 90° into a horizontal bar",
    cells: [[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3]],
  },
  W: {
    label: "W-SHAPE",
    desc: "Alternating diagonal zigzag forming a W wave",
    cells: [[0,0],[1,1],[2,2],[3,1],[4,2],[5,1],[6,0]],
  },
  V: {
    label: "V-SHAPE",
    desc: "Diagonal descent and ascent — a wide V chevron",
    cells: [[0,0],[1,1],[2,2],[3,3],[4,2],[5,1],[6,0]],
  },
  C: {
    label: "C-SHAPE",
    desc: "Open bracket — two horizontal bars with a left spine",
    cells: [[0,0],[0,1],[0,2],[1,0],[2,0],[1,2],[2,2]],
  },
  zigzag: {
    label: "ZIGZAG",
    desc: "Sharp alternating steps — teeth of a saw",
    cells: [[0,0],[1,1],[2,0],[3,1],[4,0],[5,1],[6,0]],
  },
};

function PatternDiagram({ cells, accent, isSelected }: { cells: [number, number][]; accent: string; isSelected: boolean }) {
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const rows = maxR + 1;
  const cols = maxC + 1;
  const cellSize = 16;
  const gap = 2;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
      gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
      gap,
    }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
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
  const [hovered, setHovered] = useState<BoardMode | null>(null);
  const [step, setStep] = useState<"mode" | "patterns">("mode");
  const [selectedPatterns, setSelectedPatterns] = useState<Set<PatternName7>>(new Set());
  const [hoveredPattern, setHoveredPattern] = useState<PatternName7 | null>(null);

  const togglePattern = (name: PatternName7) => {
    setSelectedPatterns(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else if (next.size < 6) {
        next.add(name);
      }
      return next;
    });
  };

  const goBack = () => {
    if (step === "patterns") {
      setStep("mode");
      setSelectedPatterns(new Set());
    } else {
      setScreenAction("home");
    }
  };

  const proceedFromPatterns = () => {
    if (selectedPatterns.size >= 1) {
      onBoardModeAction?.("7x7", Array.from(selectedPatterns));
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, background: themeId === "space" ? "transparent" : t.bg, transition: "background 0.4s",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly",
      padding: "90px 24px 40px", overflowY: "auto",
    }}>
      <style>{`
        @keyframes cardFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
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
            SINGLEPLAYER
          </div>

          <div style={{ fontFamily: t.fontBody, fontSize: 16, color: t.textMuted, textAlign: "center", maxWidth: 440 }}>
            Choose your board size
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 480 }}>
            {(["5x5", "7x7"] as BoardMode[]).map((mode, i) => {
              const isSelected = boardMode === mode;
              const isHov = hovered === mode;
              const modeColor = mode === "5x5" ? "#60A8FF" : "#FF6B35";
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setBoardMode(mode);
                    if (mode === "7x7") {
                      setStep("patterns");
                    } else {
                      onBoardModeAction?.("5x5");
                    }
                  }}
                  onMouseEnter={() => { onHoverAction?.(); setBoardMode(mode); setHovered(mode); }}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: isSelected ? `linear-gradient(145deg, ${modeColor}18, ${t.bgCard})` : t.bgCard,
                    border: `2px solid ${isSelected ? modeColor : t.border}`,
                    borderRadius: ip ? 2 : 16,
                    padding: ip ? "28px 24px" : "32px 28px",
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
                    transform: isSelected ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
                    boxShadow: isSelected ? `0 16px 48px ${modeColor}22` : "none",
                    animation: `cardFadeUp 0.45s cubic-bezier(.22,.68,0,1.2) ${i * 0.08}s both`,
                  }}
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
                      {mode === "5x5" ? "5 × 5 CLASSIC" : "7 × 7 EXPANDED"}
                    </div>
                  </div>
                  <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, lineHeight: 1.5 }}>
                    {mode === "5x5"
                      ? "Standard board — 5-in-a-line, V/L/W patterns, 10-cell chain. Local pass-and-play."
                      : "Larger board — 7-in-a-line, choose 3 of 6 special patterns, 20-cell chain. Local pass-and-play."
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── STEP 2: Pattern Selection (7×7 only) ── */}
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
            SELECT PATTERNS
          </div>

          <div style={{
            fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500,
            lineHeight: 1.6,
          }}>
            Choose <span style={{ color: t.accent, fontWeight: 700 }}>1 to 6</span> special winning patterns for this game.
            These patterns (plus 7-in-a-line, diagonals, and 20-cell chain) will be the win conditions.
          </div>

          <div style={{
            fontFamily: t.fontMono, fontSize: 12, color: selectedPatterns.size >= 1 ? "#22C55E" : t.textMuted,
            letterSpacing: "0.1em", transition: "color 0.2s",
          }}>
            {selectedPatterns.size} SELECTED
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12, width: "100%", maxWidth: 660,
          }}>
            {PATTERN_NAMES_7.map((name, i) => {
              const info = PATTERN_INFO[name];
              const isSelected = selectedPatterns.has(name);
              const isHov = hoveredPattern === name;
              const patColor = isSelected ? t.accent : isHov ? `${t.accent}AA` : t.textMuted;

              return (
                <button
                  key={name}
                  onClick={() => togglePattern(name)}
                  onMouseEnter={() => { onHoverAction?.(); setHoveredPattern(name); }}
                  onMouseLeave={() => setHoveredPattern(null)}
                  style={{
                    background: isSelected
                      ? `linear-gradient(145deg, ${t.accent}1A, ${t.bgCard})`
                      : t.bgCard,
                    border: `2px solid ${isSelected ? t.accent : isHov ? `${t.accent}55` : t.border}`,
                    borderRadius: ip ? 2 : 14,
                    padding: "16px 14px",
                    cursor: selectedPatterns.size >= 6 && !isSelected ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.25s cubic-bezier(.22,.68,0,1.2)",
                    transform: isSelected ? "scale(1.03)" : isHov ? "scale(1.01)" : "scale(1)",
                    boxShadow: isSelected ? `0 8px 32px ${t.accent}22` : "none",
                    opacity: selectedPatterns.size >= 6 && !isSelected ? 0.5 : 1,
                    animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                      border: `2px solid ${isSelected ? t.accent : t.border}`,
                      background: isSelected ? t.accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}>
                      {isSelected && <span style={{ color: "#000", fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: t.fontDisplay, fontSize: ip ? 12 : 14, fontWeight: 700,
                        color: isSelected ? t.accent : t.text, transition: "color 0.2s",
                        letterSpacing: "0.06em", marginBottom: 4,
                      }}>
                        {info.label}
                      </div>
                      <div style={{
                        fontFamily: t.fontBody, fontSize: ip ? 10 : 11, color: t.textMuted,
                        lineHeight: 1.4, marginBottom: 10,
                      }}>
                        {info.desc}
                      </div>
                      <PatternDiagram cells={info.cells} accent={t.accent} isSelected={isSelected} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={proceedFromPatterns}
            disabled={selectedPatterns.size < 1}
            style={{
              background: selectedPatterns.size >= 1 ? t.accent : `${t.accent}33`,
              border: `2px solid ${selectedPatterns.size >= 1 ? t.accent : t.border}`,
              color: selectedPatterns.size >= 1 ? "#000" : t.textMuted,
              fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
              padding: "14px 52px", borderRadius: ip ? 2 : 10,
              cursor: selectedPatterns.size >= 1 ? "pointer" : "not-allowed",
              letterSpacing: "0.06em", transition: "all 0.3s",
              boxShadow: selectedPatterns.size >= 1 ? `0 0 24px ${t.accentGlow}44` : "none",
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
