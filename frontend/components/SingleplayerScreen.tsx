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
  PatternInfo,
  DEFAULT_PATTERNS_6,
  DEFAULT_PATTERNS_7,
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

const ALL_5X5_PATTERNS = Object.keys(PATTERN_METADATA_5);  // 6 total

function randomFive(): string[] {
  const shuffled = [...ALL_5X5_PATTERNS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

export default function SingleplayerScreen({ setScreenAction, themeId, onHoverAction, onBoardModeAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [step, setStep] = useState<"mode" | "patterns" | "splash">("mode");
  // 5x5 pattern selection — must pick exactly 5 of 6
  const [selected5, setSelected5] = useState<string[]>(randomFive);

  const meta = boardMode === "7x7" ? PATTERN_METADATA_7 : boardMode === "6x6" ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const references = boardMode === "7x7" ? CORE_RULES_METADATA_7 : boardMode === "6x6" ? CORE_RULES_METADATA_6 : CORE_RULES_METADATA_5;
  const patternNames = Object.keys(meta);
  const referenceNames = Object.keys(references);

  const toggle5Pattern = (id: string) => {
    setSelected5(prev => {
      if (prev.includes(id)) {
        // Don't deselect if already at minimum (4)
        if (prev.length <= 4) return prev;
        return prev.filter(p => p !== id);
      } else {
        // Don't add if already at 5
        if (prev.length >= 5) return prev;
        return [...prev, id];
      }
    });
  };

  const goBack = () => {
    if (step === "splash") {
      setStep("patterns");
    } else if (step === "patterns") {
      setStep("mode");
    } else {
      setScreenAction("home");
    }
  };

  const proceedToSplash = () => {
    setStep("splash");
  };

  const confirmStartFromSplash = () => {
    if (boardMode === "5x5") {
      onBoardModeAction?.(boardMode, selected5);
    } else if (boardMode === "6x6") {
      onBoardModeAction?.(boardMode, DEFAULT_PATTERNS_6);
    } else {
      onBoardModeAction?.(boardMode, DEFAULT_PATTERNS_7);
    }
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

      {/* ── STEP 3: Confirm before navigating to game (was GameScreen splash) ── */}
      {step === "splash" && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: t.bg, gap: 32, userSelect: "none",
        }}>
          <div style={{
            fontFamily: t.fontDisplay, fontSize: "clamp(24px,5vw,72px)", fontWeight: 900, color: t.accent,
            textShadow: `0 0 60px ${t.accentGlow}55`, letterSpacing: "0.06em", textAlign: "center",
          }}>SOLO</div>
          <div style={{ fontFamily: t.fontBody, fontSize: "clamp(13px,1.6vw,18px)", color: t.textSecondary, letterSpacing: "0.04em" }}>
            Local · Pass & Play · First to 3
          </div>
          <button
            type="button"
            onClick={() => { onHoverAction?.(); confirmStartFromSplash(); }}
            style={{
              marginTop: 8,
              padding: "36px 128px",
              background: `linear-gradient(135deg,${t.accent},${t.accentGlow})`,
              border: "none",
              borderRadius: ip ? 2 : 16,
              color: "#0A0A0A",
              fontFamily: t.fontDisplay,
              fontSize: "clamp(28px,4vw,44px)",
              fontWeight: 900,
              cursor: "pointer",
              letterSpacing: "0.15em",
              boxShadow: `0 0 64px ${t.accentGlow}55`,
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => {
              onHoverAction?.();
              (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 96px ${t.accentGlow}88`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 64px ${t.accentGlow}55`;
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; }}
          >PLAY</button>
          <button
            type="button"
            onClick={() => { onHoverAction?.(); goBack(); }}
            style={{
              padding: "18px 64px",
              background: "transparent",
              border: `2px solid ${t.border}`,
              borderRadius: ip ? 2 : 12,
              color: t.text,
              fontFamily: t.fontDisplay,
              fontSize: "clamp(14px,2vw,22px)",
              fontWeight: 900,
              cursor: "pointer",
              letterSpacing: "0.15em",
              transition: "transform 0.2s cubic-bezier(.22,.68,0,1.2), box-shadow 0.2s cubic-bezier(.22,.68,0,1.2), border-color 0.2s linear, color 0.2s linear",
              boxShadow: `0 0 20px ${t.border}22`,
            }}
            onMouseEnter={e => {
              onHoverAction?.();
              e.currentTarget.style.borderColor = t.accent;
              e.currentTarget.style.color = t.accent;
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.boxShadow = `0 0 40px ${t.accent}44`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.color = t.text;
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = `0 0 20px ${t.border}22`;
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
          >GO BACK</button>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>
            P1 goes first · Click any cell to begin
          </div>
        </div>
      )}

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

      {/* ── STEP 2: Pattern selection / reference ── */}
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
            {boardMode === "5x5" ? "PICK YOUR PATTERNS" : "WIN PATTERNS"}
          </div>

          {boardMode === "5x5" ? (
            /* ── 5×5: interactive picker — select exactly 5 of 6 ── */
            <>
              <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500, lineHeight: 1.6 }}>
                Choose exactly <span style={{ color: t.accent, fontWeight: 700 }}>5 of 6</span> patterns for this game.
                {" "}The deselected pattern will not be a win condition.
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>
                  SELECTED: <span style={{ color: selected5.length === 5 ? t.accent : "#ef4444", fontWeight: 700 }}>{selected5.length}/5</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected5(randomFive())}
                  style={{
                    background: "transparent", border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6,
                    color: t.textMuted, fontFamily: t.fontMono, fontSize: 10, padding: "4px 10px",
                    cursor: "pointer", letterSpacing: "0.08em",
                  }}
                >
                  RANDOMIZE
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, width: "100%", maxWidth: 720 }}>
                {ALL_5X5_PATTERNS.map((name, i) => {
                  const info = PATTERN_METADATA_5[name];
                  const isChosen = selected5.includes(name);
                  const wouldDeselect = isChosen && selected5.length <= 4;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle5Pattern(name)}
                      disabled={wouldDeselect}
                      className="sp-card"
                      style={{
                        background: isChosen ? `${t.accent}15` : t.bgCard,
                        border: isChosen ? `2px solid ${t.accent}` : `2px solid ${t.border}`,
                        borderRadius: ip ? 2 : 14,
                        padding: "14px 12px",
                        cursor: wouldDeselect ? "not-allowed" : "pointer",
                        textAlign: "left",
                        animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`,
                        opacity: isChosen ? 1 : 0.5,
                        transition: "all 0.2s",
                        ["--hover-color" as any]: t.accent,
                        ["--hover-bg" as any]: `${t.accent}1A`,
                        ["--hover-glow" as any]: `${t.accent}22`,
                        ["--card-bg" as any]: t.bgCard,
                      } as any}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 11 : 13, fontWeight: 700, color: isChosen ? t.accent : t.textSecondary, letterSpacing: "0.06em" }}>
                          {info.label}
                        </div>
                        <div style={{
                          width: 14, height: 14, borderRadius: "50%",
                          border: `2px solid ${isChosen ? t.accent : t.border}`,
                          background: isChosen ? t.accent : "transparent",
                          flexShrink: 0,
                        }} />
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 10, color: t.textMuted, lineHeight: 1.4, marginBottom: 8 }}>
                        {info.desc}
                      </div>
                      <PatternDiagram info={info} accent={isChosen ? t.accent : t.textMuted} isSelected={isChosen} />
                    </button>
                  );
                })}
              </div>

              {/* Core rules info row */}
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, textAlign: "center", maxWidth: 480, lineHeight: 1.6 }}>
                Core rule always active: <span style={{ color: t.accent }}>10+ connected stones wins</span>
              </div>
            </>
          ) : (
            /* ── 6×6 / 7×7: view-only, all patterns active ── */
            <>
              <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500, lineHeight: 1.6 }}>
                All <span style={{ color: t.accent, fontWeight: 700 }}>{patternNames.length}</span> patterns are active for {boardMode}.
                {" "}Core rule: {boardMode === "7x7" ? "20" : "15"}+ connected stones.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, width: "100%", maxWidth: boardMode === "7x7" ? 800 : 720 }}>
                {[...patternNames, ...referenceNames].map((name, i) => {
                  const isRef = referenceNames.includes(name);
                  const info = isRef ? (references as any)[name] : meta[name];
                  return (
                    <div key={name} className="sp-card" style={{
                      background: t.bgCard,
                      border: isRef ? `2px dashed ${t.border}aa` : `2px solid ${t.border}`,
                      borderRadius: ip ? 2 : 14, padding: "14px 12px", cursor: "default", textAlign: "left",
                      animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`, opacity: isRef ? 0.75 : 1,
                      ["--hover-color" as any]: t.accent, ["--hover-bg" as any]: `${t.accent}1A`,
                      ["--hover-glow" as any]: `${t.accent}22`, ["--card-bg" as any]: t.bgCard,
                    } as any}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 11 : 13, fontWeight: 700, color: isRef ? t.textSecondary : t.text, letterSpacing: "0.06em" }}>{info.label}</div>
                        {isRef && <div style={{ fontFamily: t.fontMono, fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 4, background: `${t.accent}15`, color: t.accent, border: `1px solid ${t.accent}44`, letterSpacing: "0.1em" }}>CORE</div>}
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 10, color: t.textMuted, lineHeight: 1.4, marginBottom: 8 }}>{info.desc}</div>
                      <PatternDiagram info={info} accent={isRef ? t.textMuted : t.accent} isSelected={!isRef} />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => { onHoverAction?.(); proceedToSplash(); }}
            disabled={boardMode === "5x5" && selected5.length !== 5}
            style={{
              background: boardMode === "5x5" && selected5.length !== 5 ? "rgba(255,255,255,0.1)" : t.accent,
              border: `2px solid ${boardMode === "5x5" && selected5.length !== 5 ? "rgba(255,255,255,0.2)" : t.accent}`,
              color: boardMode === "5x5" && selected5.length !== 5 ? t.textMuted : "#000",
              fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
              padding: ip ? "12px 32px" : "14px 52px", borderRadius: ip ? 2 : 10,
              cursor: boardMode === "5x5" && selected5.length !== 5 ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", transition: "all 0.3s",
              boxShadow: boardMode === "5x5" && selected5.length !== 5 ? "none" : `0 0 24px ${t.accentGlow}44`,
            }}
          >
            START MATCH →
          </button>
        </>
      )}

      {/* Back button (hidden on splash — splash has its own GO BACK) */}
      {step !== "splash" && (
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
      )}
    </div>
  );
}
