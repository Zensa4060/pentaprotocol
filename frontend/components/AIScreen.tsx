"use client";
import { useState } from "react";
import type { Screen, BoardMode } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
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
import { useAuthStore } from "@/lib/store";
import {
  BOT_CHAINS,
  BOT_LABEL,
  type BotBoardMode,
  type BotId,
  formatXpPrize,
  hasDefeated,
  isBoardModeUnlocked,
  isBotUnlocked,
  lockedByLabel,
  rewardPrizeLabel,
} from "@/lib/botRewards";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onSelectDifficultyAction: (d: Difficulty, boardMode: BoardMode) => void;
  onHoverAction?: () => void;
  onBoardModeAction?: (mode: BoardMode, patterns?: string[]) => void;
}

type DifficultyCard = { id: Difficulty; label: string; sub: string; color: string; botId: BotId };

const DIFFICULTIES_5X5: DifficultyCard[] = [
  { id: "easy",   label: "BALTAZAR", sub: "LEVEL 1",   color: "#22C55E", botId: "baltazar" },
  { id: "medium", label: "SALAZAR",  sub: "LEVEL 10",  color: "#FF0",    botId: "salazar"  },
  { id: "hard",   label: "JR.",      sub: "LEVEL 100", color: "#700B0B", botId: "jr"       },
];
/** 7×7 Mindbreaker grid — own roster; no medium tier (no medium search on 7×7). */
const DIFFICULTIES_7X7: DifficultyCard[] = [
  { id: "easy",   label: "SERAPHINA", sub: "LEVEL 1",   color: "#22C55E", botId: "seraphina" },
  { id: "hard",   label: "REGINA",    sub: "LEVEL 10",  color: "#700B0B", botId: "regina"    },
  { id: "danger", label: "HER",       sub: "LEVEL 100", color: "#CC0000", botId: "her"       },
];
const DIFFICULTIES_6X6: DifficultyCard[] = [
  { id: "hard",        label: "VALDORIN", sub: "LEVEL 1",   color: "#000FFF", botId: "valdorin" },
  { id: "normal",      label: "ELDORIN",  sub: "LEVEL 10",  color: "#FF0",    botId: "eldorin"  },
  { id: "machine_god", label: "HIM",      sub: "LEVEL 100", color: "#CC0000", botId: "him"      },
];

/** Mini grid diagram component */
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

const ALL_5X5_AI = Object.keys(PATTERN_METADATA_5);

function randomFiveAI(): string[] {
  return [...ALL_5X5_AI].sort(() => Math.random() - 0.5).slice(0, 5);
}

export default function AIScreen({ setScreenAction, themeId, onSelectDifficultyAction, onHoverAction, onBoardModeAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [step, setStep] = useState<"mode" | "patterns" | "difficulty">("mode");
  const [selected5, setSelected5] = useState<string[]>(randomFiveAI);

  // Server-persisted bot-defeat set, fetched from the logged-in user's
  // profile. Progression still renders — XP is awarded server-side on
  // first-defeat events via the mission claim flow.
  const user = useAuthStore((s) => s.user) as any;
  const defeats: Record<string, boolean> = (user?.bot_defeats as any) || {};
  const [lockMsg, setLockMsg] = useState<string | null>(null);

  const meta = boardMode === "7x7" ? PATTERN_METADATA_7 : boardMode === "6x6" ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const references = boardMode === "7x7" ? CORE_RULES_METADATA_7 : boardMode === "6x6" ? CORE_RULES_METADATA_6 : CORE_RULES_METADATA_5;
  const patternNames = Object.keys(meta);
  const referenceNames = Object.keys(references);

  const toggle5AI = (id: string) => {
    setSelected5(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 4) return prev;
        return prev.filter(p => p !== id);
      } else {
        if (prev.length >= 5) return prev;
        return [...prev, id];
      }
    });
  };

  const getSelectedPatterns = () => {
    if (boardMode === "5x5") return selected5;
    if (boardMode === "6x6") return DEFAULT_PATTERNS_6;
    return DEFAULT_PATTERNS_7;
  };

  const handleSelect = (d: Difficulty) => {
    const chain = BOT_CHAINS[boardMode as BotBoardMode];
    const card = (boardMode === "5x5" ? DIFFICULTIES_5X5 : boardMode === "6x6" ? DIFFICULTIES_6X6 : DIFFICULTIES_7X7).find((c) => c.id === d);
    const botId = (card?.botId ?? chain[0]) as BotId;
    if (!isBotUnlocked(defeats, botId)) {
      const prevLabel = lockedByLabel(botId);
      setLockMsg(prevLabel ? `Defeat ${prevLabel} to unlock ${BOT_LABEL[botId]}.` : "This bot is locked.");
      setTimeout(() => setLockMsg(null), 2500);
      return;
    }
    onBoardModeAction?.(boardMode, getSelectedPatterns());
    onSelectDifficultyAction(d, boardMode);
    setScreenAction("aiGame");
  };

  const goBack = () => {
    if (step === "difficulty") {
      setStep("patterns");
    } else if (step === "patterns") {
      setStep("mode");
    } else {
      setScreenAction("home");
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
        .ai-card { will-change: transform; transition: all 0.3s cubic-bezier(.22,.68,0,1.2) !important; }
        .ai-card:hover {
          transform: translateY(-4px) scale(1.02) !important;
          box-shadow: 0 16px 48px var(--hover-glow) !important;
          background: linear-gradient(145deg, var(--hover-bg), var(--card-bg)) !important;
        }
        .ai-card.selected {
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
            CHOOSE YOUR DEMISE
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 480 }}>
            {(["5x5", "6x6", "7x7"] as BoardMode[]).map((mode, i) => {
              const isSelected = boardMode === mode;
              const modeColor = mode === "5x5" ? "#60A8FF" : mode === "6x6" ? "#A78BFA" : "#FF6B35";
              const modeUnlocked = isBoardModeUnlocked(defeats, mode);
              const gateLabel = mode === "6x6" ? BOT_LABEL.jr : mode === "7x7" ? BOT_LABEL.him : null;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    if (!modeUnlocked) {
                      if (gateLabel) {
                        setLockMsg(`Defeat ${gateLabel} to unlock ${mode === "6x6" ? "6×6" : "7×7"} bots.`);
                        setTimeout(() => setLockMsg(null), 2500);
                      }
                      return;
                    }
                    setBoardMode(mode);
                    setStep("patterns");
                  }}
                  className={`ai-card ${isSelected ? "selected" : ""}`}
                  style={{
                    background: t.bgCard,
                    border: `2px solid ${modeUnlocked ? t.border : "rgba(255,255,255,0.08)"}`,
                    borderRadius: ip ? 2 : 16,
                    padding: ip ? "28px 24px" : "32px 28px",
                    cursor: modeUnlocked ? "pointer" : "not-allowed",
                    textAlign: "left",
                    opacity: modeUnlocked ? 1 : 0.55,
                    animation: `cardFadeUp 0.45s cubic-bezier(.22,.68,0,1.2) ${i * 0.08}s both`,
                    ["--hover-color" as any]: modeColor,
                    ["--hover-bg" as any]: `${modeColor}18`,
                    ["--hover-glow" as any]: `${modeColor}22`,
                    ["--card-bg" as any]: t.bgCard,
                  } as any}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                    {!modeUnlocked && (
                      <div style={{ fontFamily: t.fontMono, fontSize: 10, fontWeight: 900, color: "#B91C1C", letterSpacing: "0.12em", padding: "3px 8px", border: "1px solid #B91C1C44", borderRadius: 6, background: "#B91C1C18" }}>
                        LOCKED
                      </div>
                    )}
                  </div>
                  {!modeUnlocked && gateLabel && (
                    <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.05em" }}>
                      Defeat <span style={{ color: "#FCD34D", fontWeight: 700 }}>{gateLabel}</span> to unlock.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── STEP 2: Pattern picker (5×5 interactive) / reference (6×6, 7×7) ── */}
      {step === "patterns" && (
        <>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(24px,5vw,48px)", fontWeight: 900, color: t.accent, textAlign: "center", textShadow: `0 0 40px ${t.accentGlow}44`, letterSpacing: ip ? "0.08em" : "0.04em", lineHeight: 1.1 }}>
            {boardMode === "5x5" ? "PICK YOUR PATTERNS" : "WIN PATTERNS"}
          </div>

          {boardMode === "5x5" ? (
            <>
              <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500, lineHeight: 1.6 }}>
                Choose exactly <span style={{ color: t.accent, fontWeight: 700 }}>5 of 6</span> patterns for this match.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>
                  SELECTED: <span style={{ color: selected5.length === 5 ? t.accent : "#ef4444", fontWeight: 700 }}>{selected5.length}/5</span>
                </div>
                <button type="button" onClick={() => setSelected5(randomFiveAI())} style={{ background: "transparent", border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, color: t.textMuted, fontFamily: t.fontMono, fontSize: 10, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.08em" }}>
                  RANDOMIZE
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, width: "100%", maxWidth: 720 }}>
                {ALL_5X5_AI.map((name, i) => {
                  const info = PATTERN_METADATA_5[name];
                  const isChosen = selected5.includes(name);
                  return (
                    <button key={name} type="button" onClick={() => toggle5AI(name)} className="ai-card"
                      style={{ background: isChosen ? `${t.accent}15` : t.bgCard, border: isChosen ? `2px solid ${t.accent}` : `2px solid ${t.border}`, borderRadius: ip ? 2 : 14, padding: "14px 12px", cursor: "pointer", textAlign: "left", animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`, opacity: isChosen ? 1 : 0.5, transition: "all 0.2s" } as any}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 11 : 13, fontWeight: 700, color: isChosen ? t.accent : t.textSecondary, letterSpacing: "0.06em" }}>{info.label}</div>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${isChosen ? t.accent : t.border}`, background: isChosen ? t.accent : "transparent", flexShrink: 0 }} />
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 10, color: t.textMuted, lineHeight: 1.4, marginBottom: 8 }}>{info.desc}</div>
                      <PatternDiagram info={info} accent={isChosen ? t.accent : t.textMuted} isSelected={isChosen} />
                    </button>
                  );
                })}
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, textAlign: "center" }}>
                Core rule always active: <span style={{ color: t.accent }}>10+ connected stones wins</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500, lineHeight: 1.6 }}>
                All <span style={{ color: t.accent, fontWeight: 700 }}>{patternNames.length}</span> patterns are active for {boardMode}.
                {" "}Core rule: {boardMode === "7x7" ? "20" : "15"}+ connected stones.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, width: "100%", maxWidth: boardMode === "7x7" ? 800 : 640 }}>
                {[...patternNames, ...referenceNames].map((name, i) => {
                  const isRef = referenceNames.includes(name);
                  const info = isRef ? (references as any)[name] : meta[name];
                  return (
                    <div key={name} className="ai-card" style={{ background: t.bgCard, border: isRef ? `2px dashed ${t.border}aa` : `2px solid ${t.border}`, borderRadius: ip ? 2 : 14, padding: "14px 12px", cursor: "default", textAlign: "left", animation: `cardFadeUp 0.4s cubic-bezier(.22,.68,0,1.2) ${i * 0.06}s both`, opacity: isRef ? 0.75 : 1 }}>
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
            onClick={() => { onHoverAction?.(); setStep("difficulty"); }}
            disabled={boardMode === "5x5" && selected5.length !== 5}
            style={{
              background: boardMode === "5x5" && selected5.length !== 5 ? "rgba(255,255,255,0.1)" : t.accent,
              border: `2px solid ${boardMode === "5x5" && selected5.length !== 5 ? "rgba(255,255,255,0.2)" : t.accent}`,
              color: boardMode === "5x5" && selected5.length !== 5 ? t.textMuted : "#000",
              fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
              padding: "14px 52px", borderRadius: ip ? 2 : 10,
              cursor: boardMode === "5x5" && selected5.length !== 5 ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", transition: "all 0.3s",
              boxShadow: boardMode === "5x5" && selected5.length !== 5 ? "none" : `0 0 24px ${t.accentGlow}44`,
            }}
          >
            PROCEED →
          </button>
        </>
      )}

      {/* ── STEP 3: Difficulty Selection (same as before) ── */}
      {step === "difficulty" && (
        <>
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
            <span style={{ color: boardMode === "7x7" ? "#FF6B35" : boardMode === "6x6" ? "#A78BFA" : "#60A8FF", fontWeight: 700 }}>
              {boardMode === "7x7" ? "7x7" : boardMode === "6x6" ? "6x6" : "5x5"}
            </span>
            {" · "}Choose your difficulty
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 480 }}>
            {(boardMode === "6x6"
              ? DIFFICULTIES_6X6
              : boardMode === "7x7"
                ? DIFFICULTIES_7X7
                : DIFFICULTIES_5X5
            ).map((d, i) => {
              const unlocked = isBotUnlocked(defeats, d.botId);
              const defeated = hasDefeated(defeats, d.botId);
              const prevLabel = lockedByLabel(d.botId);
              const xpLabel = formatXpPrize(d.botId);
              // Capstone bots (jr / him / her) also unlock a free store item.
              const prizeLabel = rewardPrizeLabel(d.botId);
              return (
                <button
                  key={d.id}
                  onClick={() => handleSelect(d.id)}
                  className="ai-card"
                  style={{
                    flex: 1, minWidth: 200,
                    background: t.bgCard,
                    border: `2px solid ${defeated ? "#4CAF5055" : unlocked ? t.border : "rgba(255,255,255,0.08)"}`,
                    borderRadius: ip ? 2 : 16,
                    padding: ip ? "36px 24px" : "40px 28px",
                    cursor: unlocked ? "pointer" : "not-allowed",
                    textAlign: "left",
                    opacity: unlocked ? 1 : 0.55,
                    animation: `cardFadeUp 0.45s cubic-bezier(.22,.68,0,1.2) ${i * 0.08}s both`,
                    ["--hover-color" as any]: d.color,
                    ["--hover-bg" as any]: `${d.color}18`,
                    ["--hover-glow" as any]: `${d.color}22`,
                    ["--card-bg" as any]: t.bgCard,
                  } as any}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: d.color, boxShadow: `0 0 12px ${d.color}66`,
                      }} />
                      <div style={{
                        fontFamily: t.fontDisplay, fontSize: ip ? 18 : 22, fontWeight: 700,
                        color: t.text, transition: "color 0.2s", letterSpacing: "0.06em",
                      }}>
                        {d.label}
                      </div>
                    </div>
                    {defeated ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 10, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.12em", padding: "3px 8px", border: "1px solid #4CAF5055", borderRadius: 6, background: "#4CAF5018" }}>
                        DEFEATED
                      </div>
                    ) : !unlocked ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 10, fontWeight: 900, color: "#B91C1C", letterSpacing: "0.12em", padding: "3px 8px", border: "1px solid #B91C1C44", borderRadius: 6, background: "#B91C1C18" }}>
                        LOCKED
                      </div>
                    ) : null}
                  </div>
                  <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, lineHeight: 1.5, marginBottom: 8 }}>
                    {d.sub}
                  </div>
                  {defeated ? (
                    <>
                      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#4CAF50", letterSpacing: "0.05em" }}>
                        Claimed <span style={{ fontWeight: 800 }}>{xpLabel}</span>
                      </div>
                      {prizeLabel && (
                        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#4CAF50", letterSpacing: "0.05em", marginTop: 3 }}>
                          + <span style={{ fontWeight: 800 }}>{prizeLabel}</span> unlocked in Store
                        </div>
                      )}
                    </>
                  ) : !unlocked && prevLabel ? (
                    <>
                      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.05em" }}>
                        Defeat <span style={{ color: "#FCD34D", fontWeight: 700 }}>{prevLabel}</span> to unlock — reward <span style={{ color: "#FCD34D", fontWeight: 700 }}>{xpLabel}</span>
                      </div>
                      {prizeLabel && (
                        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#FCD34D", letterSpacing: "0.05em", marginTop: 3 }}>
                          + <span style={{ fontWeight: 700 }}>{prizeLabel}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#FCD34D", letterSpacing: "0.06em", fontWeight: 700 }}>
                        Reward: {xpLabel}
                      </div>
                      {prizeLabel && (
                        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#FCD34D", letterSpacing: "0.06em", fontWeight: 700, marginTop: 3 }}>
                          + {prizeLabel}
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Back button */}
      <button onClick={goBack} style={{
        background: `${t.accent}18`, border: `2px solid ${t.accent}`,
        color: t.accent, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
        padding: "14px 44px", borderRadius: ip ? 2 : 10,
        cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s", marginTop: 8,
      }}
        onMouseEnter={e => {
          onHoverAction?.();
          e.currentTarget.style.background = t.accent;
          e.currentTarget.style.color = "#000";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = `${t.accent}18`;
          e.currentTarget.style.color = t.accent;
        }}
      >
        GO BACK
      </button>

      {lockMsg && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: "#2e1a1a", border: "1px solid #B91C1C", borderRadius: 10,
          padding: "10px 22px", fontFamily: t.fontMono, fontSize: 13, color: "#FCA5A5",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em",
        }}>
          {lockMsg}
        </div>
      )}
    </div>
  );
}
