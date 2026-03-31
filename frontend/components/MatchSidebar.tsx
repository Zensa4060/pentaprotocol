"use client";
import React from "react";
import { Piece, Flame, Skull, SnowflakePiece, IceShardPiece } from "./GamePieces";
import type { Phase } from "./GamePieces";
import type { Screen } from "@/lib/types";
import BloodMoonBanner from "./BloodMoonBanner";
import { BannerRenderer, BANNERS_DATA } from "./BannerRenderer";

function barsToColor(bars: number): string {
  if (bars >= 3) return "#22c55e";
  if (bars === 2) return "#eab308";
  if (bars === 1) return "#ef4444";
  return "rgba(255,255,255,0.25)";
}

/** 7×7 pattern chip text in the match sidebar (internal id stays `zigzag`) */
/** 7×7 and 6x6 pattern chip text in the match sidebar */
function patternSidebarLabel(pat: string): string {
  if (pat === "zigzag") return "ZZ-7";
  if (pat === "ZZ") return "ZZ-6";
  if (pat === "J") return "J";
  if (pat === "T") return "T";
  return pat;
}

/** Robust winner extraction regardless if item is a string or an object. */
function safeWinner(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && "winner" in item) return String(item.winner);
  return "";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatchSidebarProps {
  // theme
  t: {
    bg: string; accent: string; accentGlow: string; fontDisplay: string; fontMono: string;
    fontBody: string; textMuted: string; textSecondary: string; text: string; border: string;
    bgCard: string; bgPanel: string; gold: string; danger: string; inputBg: string;
    pieces: { p1: string; p2: string };
  };
  p1Banner?: string;
  p2Banner?: string;
  ip: boolean;
  p1c: string;
  p2c: string;
  pieceSkin?: string;
  p1RttMs?: number | null;
  p2RttMs?: number | null;
  panelW: number;
  // game state
  phase: Phase;
  winner: string | null;
  current: string;
  gameNumber: number;
  matchHistory: string[];
  seriesWinner: string | null;
  matchOver: boolean;
  gameMode: string;
  isRankedGame: boolean;
  isMultiplayerGame: boolean;
  isMultiplayer: boolean;
  mySlot: "P1" | "P2";
  boardMode?: string;
  selectedPatterns?: string[];
  rbBannedPatterns?: string[];
  /** When true, show ? chips instead of pattern names (opponent/bot ban hidden from viewer). */
  patternsAsSecret?: boolean;
  /** Multiplayer series score (wins only; draws add 0). */
  p1SeriesPts?: number;
  p2SeriesPts?: number;
  // timers
  p1Time: number;
  p2Time: number;
  readyTimeout: number;
  // ready
  p1Ready: boolean;
  p2Ready: boolean;
  // chat
  chatMessages: { from: "P1" | "P2"; text: string; ts: number }[];
  chatInput: string;
  chatOpen: boolean;
  chatWarning: boolean;
  // log
  log: { text: string; player: string }[];
  // bot
  botThinking: boolean;
  // overlays
  showWinOverlay: boolean;
  overlayVisible: boolean;
  winnerColor: string;
  winnerPiece: string;
  seriesDiffers: boolean;
  seriesColor: string;
  seriesPiece: string;
  showRematch: boolean;
  rematchRequested: string | null;
  showSurrender: boolean;
  showExitConfirm: boolean;
  setScreenAction?: (s: Screen) => void;
  // player display names
  p1Label?: string;
  p2Label?: string;
  winnerDisplayNameAction?: (w: string | null) => string;
  // last series (populated after rematch accepted)
  lastSeries?: { winner: string | null; history: string[] } | null;
  // handlers
  onReadyToggle: (player: "P1" | "P2") => void;
  onSendChat: (from: "P1" | "P2") => void;
  onChatInputChange: (v: string) => void;
  onChatKeyDown: (e: React.KeyboardEvent) => void;
  onChatOpenToggle: () => void;
  onSoftReset: () => void;
  onDismissOverlayAction: () => void;
  onRematchAction: () => void;
  onQuitMatchAction: () => void;
  onSurrenderConfirmAction: () => void;
  onSurrenderCancelAction: () => void;
  onExitConfirmAction: () => void;
  onExitCancelAction: () => void;
  onShowSurrenderAction: () => void;
  onShowExitConfirmAction: () => void;
  onShowRematchOverlayAction: () => void;
  fmtTimeAction: (ms: number) => string;
  playHoverAction?: () => void;
  playClickAction?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatchSidebar({
  t, p1Banner, p2Banner, ip, p1c, p2c, pieceSkin, p1RttMs, p2RttMs, panelW,
  phase, winner, current, gameNumber, matchHistory, seriesWinner, matchOver,
  gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot,
  boardMode, selectedPatterns, rbBannedPatterns = [], patternsAsSecret = false, p1SeriesPts, p2SeriesPts,
  p1Time, p2Time, readyTimeout,
  p1Ready, p2Ready,
  chatMessages, chatInput, chatOpen, chatWarning,
  log, botThinking,
  showWinOverlay, overlayVisible, winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece,
  showRematch, rematchRequested, lastSeries,
  showSurrender, showExitConfirm, setScreenAction,
  p1Label, p2Label, winnerDisplayNameAction,
  onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
  onSoftReset, onDismissOverlayAction, onRematchAction, onQuitMatchAction,
  onSurrenderConfirmAction, onSurrenderCancelAction, onExitConfirmAction, onExitCancelAction,
  onShowSurrenderAction, onShowExitConfirmAction, onShowRematchOverlayAction,
  fmtTimeAction, playHoverAction, playClickAction,
}: MatchSidebarProps) {
  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const useFlameSkull = pieceSkin === "flame_skull";
  const useSnowflakeShard = pieceSkin === "snowflake_shard";

  const renderSidebarPiece = (slot: "P1" | "P2") => {
    const cssSize = ip ? "14px" : "16px";
    const wrap: React.CSSProperties = {
      position: "relative",
      width: cssSize,
      height: cssSize,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };

    if (useFlameSkull) {
      return (
        <span style={wrap}>
          {slot === "P1" ? <Flame cssSize={cssSize} /> : <Skull cssSize={cssSize} />}
        </span>
      );
    }
    if (useSnowflakeShard) {
      return (
        <span style={wrap}>
          {slot === "P1" ? <SnowflakePiece cssSize={cssSize} /> : <IceShardPiece cssSize={cssSize} />}
        </span>
      );
    }

    const col = slot === "P1" ? p1c : p2c;
    const sym = slot === "P1" ? t.pieces.p1 : t.pieces.p2;
    return <span style={{ opacity: 0.9, lineHeight: 1, display: "inline-flex", alignItems: "center" }}><Piece symbol={sym} color={col} size={cssSize} /></span>;
  };

  const rttToBars = (rtt: number | null | undefined) => {
    if (rtt === null || rtt === undefined) return 0;
    if (rtt <= 80) return 4;
    if (rtt <= 150) return 3;
    if (rtt <= 300) return 2;
    if (rtt <= 600) return 1;
    return 0;
  };
  const renderNetBars = (slot: "P1" | "P2") => {
    const rtt = slot === "P1" ? p1RttMs : p2RttMs;
    const bars = rttToBars(rtt);
    const col = barsToColor(bars);
    return (
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, marginLeft: 6, opacity: 0.95 }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: 3 + i * 3,
              borderRadius: 2,
              background: i <= bars ? col : "rgba(255,255,255,0.18)",
              boxShadow: i <= bars ? `0 0 8px ${col}55` : "none",
            }}
          />
        ))}
      </span>
    );
  };

  // ── Win overlay ────────────────────────────────────────────────────────────
  const winOverlay = showWinOverlay && winner && (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: overlayVisible ? 1 : 0,
      pointerEvents: overlayVisible ? "auto" : "none",
      background: "rgba(0,0,0,0.88)" // Solid dark background to replace heavy blur
    }}>
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(600px, 90vw)",
        background: "rgba(10,10,10,0.98)",
        border: `2px solid ${winnerColor}66`,
        borderRadius: 24,
        padding: "60px 40px",
        display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: `0 30px 80px rgba(0,0,0,0.9)`, // Simplified shadow
        textAlign: "center"
      }}>
        {seriesDiffers ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Game Winner Section */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 12 }}>{winnerPiece}</div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 44, fontWeight: 900, color: winnerColor, letterSpacing: "0.02em" }}>{winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}</div>
              <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textMuted, marginTop: 8, letterSpacing: "0.2em", textTransform: "uppercase" }}>GAME {gameNumber} COMPLETE</div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

            {/* Series Winner Section */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textMuted, marginBottom: 16, letterSpacing: "0.2em", textTransform: "uppercase" }}>Series Result</div>
              <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 12 }}>{seriesPiece}</div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 48, fontWeight: 950, color: seriesColor, letterSpacing: "0.02em" }}>
                {seriesWinner === "DRAW" ? "MATCH DRAW" : `${getName(seriesWinner)} WINS SERIES!`}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 110, lineHeight: 1, marginBottom: 20 }}>{winnerPiece}</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 64, fontWeight: 950, color: winnerColor, letterSpacing: "0.02em", marginBottom: 8 }}>{winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}</div>
            <div style={{ fontFamily: t.fontMono, fontSize: 16, color: t.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              {phase === "match_over" ? "Series Complete" : `Game ${gameNumber} Complete`}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={onDismissOverlayAction}
          style={{
            marginTop: 48,
            padding: "16px 48px",
            background: winnerColor,
            color: "#000",
            border: "none",
            borderRadius: 12,
            fontFamily: t.fontDisplay,
            fontSize: 18,
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)",
            boxShadow: `0 10px 30px ${winnerColor}33`,
            letterSpacing: "0.05em"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = `0 15px 40px ${winnerColor}55`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = `0 10px 30px ${winnerColor}33`;
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );

  // ── Left panel ─────────────────────────────────────────────────────────────
  const leftPanel = (
    <div style={{ width: panelW, minWidth: panelW, maxWidth: panelW * 1.15, resize: "horizontal", overflowX: "hidden", flexShrink: 0, background: t.bgPanel, borderRight: `${ip ? 3 : 1}px solid ${t.border}`, padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MATCH TIMER</div>
      {(["P1", "P2"] as const).map(p => (
        <div key={p} style={{ position: "relative", padding: "12px 14px", background: phase === "playing" && current === p ? `${p === "P1" ? p1c : p2c}22` : t.bgCard, border: `1px solid ${phase === "playing" && current === p ? (p === "P1" ? p1c : p2c) : t.border}`, borderRadius: ip ? 2 : 8, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.25s, border-color 0.25s", overflow: "hidden" }}>
          {/* High-Contrast Banner Background */}
          <div style={{ 
            position: "absolute", inset: 0, opacity: 1, pointerEvents: "none", 
            overflow: "hidden", zIndex: 0, borderRadius: "inherit" 
          }}>
            <div style={{ 
              position: "absolute", inset: 0, 
              display: "flex", alignItems: "center", justifyContent: "center" 
            }}>
              <BannerRenderer bannerId={(p === "P1" ? p1Banner : p2Banner) || "default"} hideLabels />
            </div>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1 }} />
          </div>
          <span style={{ position: "relative", zIndex: 2, fontFamily: t.fontDisplay, fontSize: 13, color: p === "P1" ? p1c : p2c, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em", textShadow: `0 2px 4px rgba(0,0,0,0.8)` }}>
            {
              (() => {
                const raw = p === "P1" ? p1Label : p2Label;
                const name = (raw ?? "PLAYER")
                  .replace(/^\s*[xy]\s*/i, "")
                  .replace(/\([xy]\)/gi, "")
                  .trim()
                  .toUpperCase();

                return <>{renderSidebarPiece(p)} {name}{renderNetBars(p)}</>;
              })()
            }
          </span>
          <span style={{ position: "relative", zIndex: 2, fontFamily: t.fontMono, fontSize: 16, color: t.text, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{p === "P1" ? fmtTimeAction(p1Time) : fmtTimeAction(p2Time)}</span>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em", marginBottom: 10 }}>MATCH HISTORY</div>

        {(isMultiplayerGame || isMultiplayer) && typeof p1SeriesPts === "number" && typeof p2SeriesPts === "number" && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 10 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 6 }}>SERIES POINTS · FIRST TO 5</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{p1SeriesPts}</span></span>
              <span style={{ color: t.textMuted, fontSize: 14 }}>—</span>
              <span style={{ color: p2c }}>{p2Label ?? "P2"} <span style={{ color: t.text }}>{p2SeriesPts}</span></span>
            </div>
          </div>
        )}

        {/* Last series chip — shown during new series after a rematch */}
        {lastSeries && (
          <div style={{ marginBottom: 12, padding: "8px 10px", background: `${t.gold}0C`, border: `1px solid ${t.gold}33`, borderRadius: ip ? 2 : 8 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 6 }}>LAST SERIES</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5 }}>
              {lastSeries.history.map((hItem, i) => {
                const r = safeWinner(hItem);
                const col = r === "P1" ? p1c : r === "P2" ? p2c : r === "DRAW" ? t.gold : t.textMuted;
                const offset = (isMultiplayerGame && boardMode === "6x6") ? 3 : (isMultiplayerGame && boardMode === "7x7") ? 6 : 0;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted }}>G{i + 1 + offset}</div>
                    <div style={{ width: 22, height: 4, borderRadius: 2, background: r ? col : "#222", border: `1px solid ${r ? col : "#333"}`, boxShadow: r ? `0 0 5px ${col}55` : "none" }} />
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, fontWeight: 700, color: r ? col : t.textMuted }}>{r || "—"}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: lastSeries.winner === "P1" ? p1c : lastSeries.winner === "P2" ? p2c : t.gold }}>
              {lastSeries.winner === "DRAW" ? "DRAW" : lastSeries.winner ? `${getName(lastSeries.winner)} WON` : ""}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const rawResult = matchHistory[i];
            const result = safeWinner(rawResult);
            const col = result === "P1" ? p1c : result === "P2" ? p2c : result === "DRAW" ? t.gold : t.textMuted;
            const isCur = i === gameNumber - 1 && (phase === "playing" || phase === "waiting_ready");
            let bmLabel = null;
            if (i === 0) bmLabel = "5 × 5";
            else if (i === 3) bmLabel = "6 × 6";
            else if (i === 6) bmLabel = "7 × 7";
            else if (i === 9) bmLabel = "PB";
            return (
              <React.Fragment key={i}>
                {bmLabel && (
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.accent, opacity: 0.8, letterSpacing: "0.2em", marginTop: i === 0 ? 0 : 12, marginBottom: 4, borderBottom: `1px solid ${t.accent}33`, paddingBottom: 2 }}>
                    {bmLabel}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontFamily: t.fontBody, fontSize: 22, padding: "6px 0", borderBottom: `1px solid ${t.border}22`, opacity: i < gameNumber ? 1 : 0.4 }}>
                  <span style={{ color: isCur ? t.accent : t.textMuted, transition: "color 0.2s" }}>G{i + 1}{isCur ? " *" : ""}</span>
                  <span style={{ color: col, fontWeight: result ? 700 : 400, transition: "color 0.2s" }}>{result || "—"}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {seriesWinner && (
          <div style={{ marginTop: 10, fontFamily: t.fontMono, fontSize: 20, color: t.gold, textAlign: "center", fontWeight: 700 }}>
            {seriesWinner === "DRAW" ? (
              <>
                <div>SERIES: FULL DRAW</div>
                <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, fontWeight: 600, marginTop: 6, letterSpacing: "0.06em" }}>No overall winner</div>
              </>
            ) : (
              <>SERIES: {getName(seriesWinner)} WINS</>
            )}
          </div>
        )}
      </div>


      {phase === "waiting_ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.accent, textAlign: "center" }}>{Math.ceil(readyTimeout)}s</div>
          {gameMode === "ai" ? (
            (() => {
              const rdy = p1Ready;
              const col = p1c;
              return (
                <button onClick={() => onReadyToggle("P1")}
                  style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                  onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                >{matchHistory.length >= 2 ? "START RULEBREAKER" : `START GAME ${gameNumber + 1 + ((isMultiplayerGame && boardMode === "6x6") ? 3 : (isMultiplayerGame && boardMode === "7x7") ? 6 : 0)}`} {rdy ? "READY" : ""}</button>
              );
            })()
          ) : (
            (["P1", "P2"] as const).map(p => {
              const rdy = p === "P1" ? p1Ready : p2Ready;
              const col = p === "P1" ? p1c : p2c;
              return (
                <button key={p} onClick={() => onReadyToggle(p)}
                  style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                  onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                >{p === "P1" ? (p1Label ?? p) : (p2Label ?? p)} {rdy ? "READY" : "NOT READY"}</button>
              );
            })
          )}
        </div>
      )}
      {phase === "match_over" && !isMultiplayerGame && (
        <div style={{ textAlign: "center", animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.gold, marginBottom: 10 }}>{seriesWinner === "DRAW" ? "FULL MATCH DRAW — NO WINNER" : `${getName(seriesWinner)} WINS!`}</div>
          <button onClick={onSoftReset} style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}`, color: t.accent, fontFamily: t.fontMono, fontSize: 13, padding: "10px 18px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>NEW MATCH</button>
        </div>
      )}
      {isMultiplayerGame && (phase === "playing" || phase === "waiting_ready") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>CHAT</div>
            <button onClick={onChatOpenToggle} style={{ background: "none", border: "none", color: t.text, fontFamily: t.fontMono, fontSize: 16, cursor: "pointer", padding: "2px 6px" }}>{chatOpen ? "▾" : "▸"}</button>
          </div>
          {chatOpen && (
            <>
              <div style={{ height: 160, overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {chatMessages.length === 0 && (<div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", marginTop: 24 }}>No messages yet</div>)}
                {chatMessages.map((m, i) => (<div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span><span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span></div>))}
              </div>
              {chatWarning && (<div style={{ padding: "8px 12px", background: "#F4433618", border: "1px solid #F44336", borderRadius: 6, fontFamily: t.fontBody, fontSize: 13, color: "#F44336" }}>Inappropriate language detected and censored.</div>)}
              <div style={{ display: "flex", gap: 6 }}>
                <input value={chatInput} onChange={e => onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, color: t.text, fontFamily: t.fontBody, fontSize: 14, padding: "8px 10px", outline: "none", minWidth: 0 }} />
                {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={() => onSendChat("P1")} style={{ background: `${p1c}20`, border: `1px solid ${p1c}`, color: p1c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p1c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p1c}20`; e.currentTarget.style.color = p1c; }}>P1</button>)}
                {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={() => onSendChat("P2")} style={{ background: `${p2c}20`, border: `1px solid ${p2c}`, color: p2c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p2c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p2c}20`; e.currentTarget.style.color = p2c; }}>P2</button>)}
              </div>
            </>
          )}
        </div>
      )}
      {(phase === "playing" || phase === "waiting_ready") && (
        isRankedGame ? (
          <button onClick={onShowSurrenderAction} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>SURRENDER</button>
        ) : isMultiplayer ? null : (
          <button onClick={onSoftReset} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>RESET</button>
        )
      )}
    </div>
  );

  // ── Right panel ────────────────────────────────────────────────────────────
  const rightPanel = (
    <div style={{ width: panelW, flexShrink: 0, background: t.bgPanel, borderLeft: `${ip ? 3 : 1}px solid ${t.border}`, padding: "18px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MOVE LOG</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {log.length === 0 ? <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, fontStyle: "italic" }}>No moves yet</div> : log.slice().reverse().map((m, i) => <div key={i} style={{ fontFamily: t.fontMono, fontSize: 15, color: m.player === "P1" ? p1c : p2c, padding: "3px 0", borderBottom: `1px solid ${t.border}22` }}>{m.text}</div>)}
      </div>
      {setScreenAction && !isRankedGame && (phase === "playing" || phase === "waiting_ready" || phase === "match_over") && (
        <button onClick={onShowExitConfirmAction} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", marginTop: 4 }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>EXIT MATCH</button>
      )}
    </div>
  );

  // ── Rematch overlay ────────────────────────────────────────────────────────
  const rematchOverlay = showRematch && isMultiplayerGame && (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease both" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.accent}`, borderRadius: ip ? 2 : 20, padding: "48px 56px", maxWidth: 480, width: "90vw", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.accent}22`, animation: "scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: t.accent, marginBottom: 8, letterSpacing: "0.08em" }}>MATCH COMPLETE</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 18, fontWeight: 700, color: seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold, marginBottom: 20 }}>
          {seriesWinner === "DRAW" ? "FULL MATCH DRAW — NO WINNER" : `${getName(seriesWinner)} WINS THE SERIES`}
        </div>
        {rematchRequested && rematchRequested !== mySlot && (
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.gold, marginBottom: 16 }}>Opponent wants a rematch!</div>
        )}
        {rematchRequested === mySlot && (
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginBottom: 16 }}>Waiting for opponent...</div>
        )}
        {!rematchRequested && <div style={{ marginBottom: 16 }} />}
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button
            onClick={onRematchAction}
            disabled={rematchRequested === mySlot}
            style={{ background: rematchRequested === mySlot ? `${t.accent}10` : `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, padding: "14px 36px", borderRadius: ip ? 2 : 10, cursor: rematchRequested === mySlot ? "default" : "pointer", opacity: rematchRequested === mySlot ? 0.5 : 1, transition: "all 0.2s" }}
            onMouseEnter={e => { if (rematchRequested !== mySlot) { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
          >REMATCH</button>
          <button
            onClick={onQuitMatchAction}
            style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, padding: "14px 36px", borderRadius: ip ? 2 : 10, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}
          >QUIT</button>
        </div>
      </div>
    </div>
  );

  // ── Surrender confirm ──────────────────────────────────────────────────────
  const surrenderModal = showSurrender && (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 2}px solid ${t.danger}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize: 44, marginBottom: 20 }} />
        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.danger, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to forfeit this Match?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>{isRankedGame ? <>This counts as a <span style={{ color: t.danger, fontWeight: 700 }}>forfeit</span> and will result in <span style={{ color: t.danger, fontWeight: 700 }}>ELO deduction</span>.</> : "Your opponent will be declared the winner."}</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button className="action-btn" onClick={onSurrenderConfirmAction} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.danger}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; }}>YES, FORFEIT</button>
          <button className="action-btn" onClick={onSurrenderCancelAction} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.accent}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = "none"; }}>NO, STAY</button>
        </div>
      </div>
    </div>
  );

  // ── Exit confirm ───────────────────────────────────────────────────────────
  const exitModal = showExitConfirm && (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 1}px solid ${t.border}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>

        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to quit the current session?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>Current game progress will be lost.</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button className="action-btn" onClick={onExitConfirmAction} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.danger}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; }}>YES</button>
          <button className="action-btn" onClick={onExitCancelAction} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.accent}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = "none"; }}>NO</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {winOverlay}
      {leftPanel}
    </>
  );
}

// ─── Separate named exports so GameScreen can render panels individually ──────

export function LeftPanel(props: MatchSidebarProps) {
  const { t, ip, p1c, p2c, pieceSkin, p1RttMs, p2RttMs, panelW, phase, current, gameNumber, matchHistory, seriesWinner,
    gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot, boardMode, selectedPatterns, rbBannedPatterns = [], patternsAsSecret = false, p1SeriesPts, p2SeriesPts,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning,
    p1Label, p2Label, p1Banner, p2Banner, winnerDisplayNameAction, lastSeries,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    onSoftReset, onShowSurrenderAction, onShowExitConfirmAction, fmtTimeAction, playHoverAction } = props;

  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const useFlameSkull = pieceSkin === "flame_skull";
  const useSnowflakeShard = pieceSkin === "snowflake_shard";

  const renderSidebarPiece = (slot: "P1" | "P2") => {
    const cssSize = ip ? "14px" : "16px";
    const wrap: React.CSSProperties = {
      position: "relative",
      width: cssSize,
      height: cssSize,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };

    if (useFlameSkull) {
      return (
        <span style={wrap}>
          {slot === "P1" ? <Flame cssSize={cssSize} /> : <Skull cssSize={cssSize} />}
        </span>
      );
    }
    if (useSnowflakeShard) {
      return (
        <span style={wrap}>
          {slot === "P1" ? <SnowflakePiece cssSize={cssSize} /> : <IceShardPiece cssSize={cssSize} />}
        </span>
      );
    }

    const col = slot === "P1" ? p1c : p2c;
    const sym = slot === "P1" ? t.pieces.p1 : t.pieces.p2;
    return <span style={{ opacity: 0.9, lineHeight: 1, display: "inline-flex", alignItems: "center" }}><Piece symbol={sym} color={col} size={cssSize} /></span>;
  };

  const rttToBars = (rtt: number | null | undefined) => {
    if (rtt === null || rtt === undefined) return 0;
    if (rtt <= 80) return 4;
    if (rtt <= 150) return 3;
    if (rtt <= 300) return 2;
    if (rtt <= 600) return 1;
    return 0;
  };
  const renderNetBars = (slot: "P1" | "P2") => {
    const rtt = slot === "P1" ? p1RttMs : p2RttMs;
    const bars = rttToBars(rtt);
    const col = barsToColor(bars);
    return (
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, marginLeft: 6, opacity: 0.95 }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: 3 + i * 3,
              borderRadius: 2,
              background: i <= bars ? col : "rgba(255,255,255,0.18)",
              boxShadow: i <= bars ? `0 0 8px ${col}55` : "none",
            }}
          />
        ))}
      </span>
    );
  };

  return (
    <div style={{ width: panelW, minWidth: panelW, maxWidth: panelW * 1.15, resize: "horizontal", overflowX: "hidden", flexShrink: 0, background: t.bgPanel, borderRight: `${ip ? 3 : 1}px solid ${t.border}`, padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MATCH TIMER</div>
      {(["P1", "P2"] as const).map(p => {
        const isCurrentMover = phase === "playing" && current === p;
        const bannerId = p === "P1" ? (p1Banner || "default") : (p2Banner || "default");
        return (
        <div key={p} style={{ position: "relative", overflow: "hidden", borderRadius: ip ? 2 : 8, border: `1px solid ${isCurrentMover ? (p === "P1" ? p1c : p2c) : t.border}`, transition: "border-color 0.25s", background: t.bgCard }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1, zIndex: 0, transition: "opacity 0.5s ease" }}>
            <BannerRenderer bannerId={bannerId} hideLabels={true} />
            {/* Elegant glass mask to ensure text readability while letting banner colors pop */}
            <div style={{ 
              position: "absolute", 
              inset: 0, 
              background: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)", 
              zIndex: 1 
            }} />
          </div>
          <div style={{ position: "relative", zIndex: 2, padding: "12px 14px", background: isCurrentMover ? `${p === "P1" ? p1c : p2c}33` : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.25s" }}>
          <span style={{ fontFamily: t.fontDisplay, fontSize: 13, color: p === "P1" ? p1c : p2c, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em", textShadow: `0 2px 4px rgba(0,0,0,0.8)` }}>
            {
              (() => {
                const raw = p === "P1" ? p1Label : p2Label;
                const name = (raw ?? "PLAYER")
                  .replace(/^\s*[xy]\s*/i, "")
                  .replace(/\([xy]\)/gi, "")
                  .trim()
                  .toUpperCase();

                return <>{renderSidebarPiece(p)} {name}{renderNetBars(p)}</>;
              })()
            }
          </span>
          <span style={{ fontFamily: t.fontMono, fontSize: 16, color: t.text, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{p === "P1" ? fmtTimeAction(p1Time) : fmtTimeAction(p2Time)}</span>
        </div>
        </div>
      )})}

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em", marginBottom: 10 }}>MATCH HISTORY</div>

        {(isMultiplayerGame || isMultiplayer) && typeof p1SeriesPts === "number" && typeof p2SeriesPts === "number" && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 10 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 6 }}>SERIES POINTS · FIRST TO 5</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{p1SeriesPts}</span></span>
              <span style={{ color: t.textMuted, fontSize: 14 }}>—</span>
              <span style={{ color: p2c }}>{p2Label ?? "P2"} <span style={{ color: t.text }}>{p2SeriesPts}</span></span>
            </div>
          </div>
        )}

        {/* Last series chip — shown during new series after a rematch */}
        {lastSeries && (
          <div style={{ marginBottom: 12, padding: "8px 10px", background: `${t.gold}0C`, border: `1px solid ${t.gold}33`, borderRadius: ip ? 2 : 8 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 6 }}>LAST SERIES</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5 }}>
              {lastSeries.history.map((hItem, i) => {
                const r = safeWinner(hItem);
                const col = r === "P1" ? p1c : r === "P2" ? p2c : r === "DRAW" ? t.gold : t.textMuted;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted }}>G{i + 1}</div>
                    <div style={{ width: 22, height: 4, borderRadius: 2, background: r ? col : "#222", border: `1px solid ${r ? col : "#333"}`, boxShadow: r ? `0 0 5px ${col}55` : "none" }} />
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, fontWeight: 700, color: r ? col : t.textMuted }}>{r || "—"}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: lastSeries.winner === "P1" ? p1c : lastSeries.winner === "P2" ? p2c : t.gold }}>
              {lastSeries.winner === "DRAW" ? "DRAW" : lastSeries.winner ? `${getName(lastSeries.winner)} WON` : ""}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const rawResult = matchHistory[i];
            const result = safeWinner(rawResult);
            const col = result === "P1" ? p1c : result === "P2" ? p2c : result === "DRAW" ? t.gold : t.textMuted;
            const isCur = i === gameNumber - 1 && (phase === "playing" || phase === "waiting_ready");
            let bmLabel = null;
            if (i === 0) bmLabel = "5 × 5";
            else if (i === 3) bmLabel = "6 × 6";
            else if (i === 6) bmLabel = "7 × 7";
            else if (i === 9) bmLabel = "PB";
            return (
              <React.Fragment key={i}>
                {bmLabel && (
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.accent, opacity: 0.8, letterSpacing: "0.2em", marginTop: i === 0 ? 0 : 12, marginBottom: 4, borderBottom: `1px solid ${t.accent}33`, paddingBottom: 2 }}>
                    {bmLabel}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontFamily: t.fontBody, fontSize: 22, padding: "6px 0", borderBottom: `1px solid ${t.border}22`, opacity: i < gameNumber ? 1 : 0.4 }}>
                  <span style={{ color: isCur ? t.accent : t.textMuted, transition: "color 0.2s" }}>G{i + 1}{isCur ? " *" : ""}</span>
                  <span style={{ color: col, fontWeight: result ? 700 : 400, transition: "color 0.2s" }}>{result || "—"}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {seriesWinner && (
          <div style={{ marginTop: 10, fontFamily: t.fontMono, fontSize: 20, color: t.gold, textAlign: "center", fontWeight: 700 }}>
            {seriesWinner === "DRAW" ? (
              <>
                <div>SERIES: FULL DRAW</div>
                <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, fontWeight: 600, marginTop: 6, letterSpacing: "0.06em" }}>No overall winner</div>
              </>
            ) : (
              <>SERIES: {getName(seriesWinner)} WINS</>
            )}
          </div>
        )}
      </div>


      {phase === "waiting_ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.accent, textAlign: "center" }}>{Math.ceil(readyTimeout)}s</div>
          {gameMode === "ai" ? (
            (() => {
              const rdy = p1Ready;
              const col = p1c;
              return (
                <button onClick={() => onReadyToggle("P1")}
                  className={!rdy ? "thump-anim" : ""}
                  style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                  onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                >{props.matchHistory.length >= 2 ? "START RULEBREAKER" : "START GAME 2"} {rdy ? "READY" : ""}</button>
              );
            })()
          ) : (
            (["P1", "P2"] as const).map(p => {
              const rdy = p === "P1" ? p1Ready : p2Ready;
              const col = p === "P1" ? p1c : p2c;
              return (
                <button key={p} onClick={() => onReadyToggle(p)}
                  style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                  onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                >{p === "P1" ? (p1Label ?? p) : (p2Label ?? p)} {rdy ? "READY" : "NOT READY"}</button>
              );
            })
          )}
        </div>
      )}
      {phase === "match_over" && !isMultiplayerGame && (
        <div style={{ textAlign: "center", animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.gold, marginBottom: 10 }}>{seriesWinner === "DRAW" ? "FULL MATCH DRAW — NO WINNER" : `${getName(seriesWinner)} WINS!`}</div>
          <button onClick={onSoftReset} style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}`, color: t.accent, fontFamily: t.fontMono, fontSize: 13, padding: "10px 18px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>NEW MATCH</button>
        </div>
      )}
      {isMultiplayerGame && (phase === "playing" || phase === "waiting_ready") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>CHAT</div>
            <button onClick={onChatOpenToggle} style={{ background: "none", border: "none", color: t.text, fontFamily: t.fontMono, fontSize: 16, cursor: "pointer", padding: "2px 6px" }}>{chatOpen ? "▾" : "▸"}</button>
          </div>
          {chatOpen && (
            <>
              <div style={{ height: 160, overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {chatMessages.length === 0 && (<div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", marginTop: 24 }}>No messages yet</div>)}
                {chatMessages.map((m, i) => (<div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span><span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span></div>))}
              </div>
              {chatWarning && (<div style={{ padding: "8px 12px", background: "#F4433618", border: "1px solid #F44336", borderRadius: 6, fontFamily: t.fontBody, fontSize: 13, color: "#F44336" }}>Inappropriate language detected and censored.</div>)}
              <div style={{ display: "flex", gap: 6 }}>
                <input value={chatInput} onChange={e => onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, color: t.text, fontFamily: t.fontBody, fontSize: 14, padding: "8px 10px", outline: "none", minWidth: 0 }} />
                {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={() => onSendChat("P1")} style={{ background: `${p1c}20`, border: `1px solid ${p1c}`, color: p1c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p1c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p1c}20`; e.currentTarget.style.color = p1c; }}>P1</button>)}
                {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={() => onSendChat("P2")} style={{ background: `${p2c}20`, border: `1px solid ${p2c}`, color: p2c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p2c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p2c}20`; e.currentTarget.style.color = p2c; }}>P2</button>)}
              </div>
            </>
          )}
        </div>
      )}
      {(phase === "playing" || phase === "waiting_ready") && (
        isRankedGame ? (
          <button onClick={onShowSurrenderAction} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>SURRENDER</button>
        ) : isMultiplayer ? null : (
          <button onClick={onSoftReset} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>RESET</button>
        )
      )}
    </div>
  );
}

export function RightPanel({ t, ip, p1c, p2c, panelW, phase, log, isRankedGame, setScreenAction, onShowExitConfirmAction, playHoverAction }: {
  t: MatchSidebarProps["t"]; ip: boolean; p1c: string; p2c: string; panelW: number;
  phase: Phase; log: { text: string; player: string }[]; isRankedGame: boolean;
  setScreenAction?: (s: Screen) => void; onShowExitConfirmAction: () => void; playHoverAction?: () => void;
}) {
  return (
    <div style={{ width: panelW, minWidth: panelW, maxWidth: panelW * 1.15, resize: "horizontal", overflowX: "hidden", direction: "rtl", flexShrink: 0, background: t.bgPanel, borderLeft: `${ip ? 3 : 1}px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ direction: "ltr", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MOVE LOG</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {log.length === 0 ? <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, fontStyle: "italic" }}>No moves yet</div> : log.slice().reverse().map((m, i) => <div key={i} style={{ fontFamily: t.fontMono, fontSize: 15, color: m.player === "P1" ? p1c : p2c, padding: "3px 0", borderBottom: `1px solid ${t.border}22` }}>{m.text}</div>)}
        </div>
        {setScreenAction && !isRankedGame && (phase === "playing" || phase === "waiting_ready" || phase === "match_over") && (
          <button onClick={onShowExitConfirmAction} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", marginTop: 4 }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>EXIT MATCH</button>
        )}
      </div>
    </div>
  );
}

export function WinOverlay({ showWinOverlay, overlayVisible, winner, winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece, seriesWinner, phase, gameNumber, t, winnerDisplayNameAction, onDismissAction, graphicsQuality = "balanced" }: {
  showWinOverlay: boolean; overlayVisible: boolean; winner: string | null; winnerColor: string; winnerPiece: string;
  seriesDiffers: boolean; seriesColor: string; seriesPiece: string; seriesWinner: string | null;
  phase: Phase; gameNumber: number; t: { fontDisplay: string; fontMono: string; fontBody: string };
  winnerDisplayNameAction?: (w: string | null) => string;
  onDismissAction: () => void;
  graphicsQuality?: "low" | "balanced" | "ultra";
}) {
  const [canDismiss, setCanDismiss] = React.useState(false);
  React.useEffect(() => {
    if (showWinOverlay) {
      setCanDismiss(false);
      const timer = setTimeout(() => setCanDismiss(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showWinOverlay]);

  if (!showWinOverlay || !winner) return null;
  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const pulseAnim = "none";
const glow = "none";

  const handleDismiss = () => { if (canDismiss) onDismissAction(); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", willChange: "opacity", opacity: overlayVisible ? 1 : 0, transition: "none", pointerEvents: overlayVisible ? "auto" : "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 0 }} />
      
      {/* Proper Box Modal */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "min(600px, 92vw)",
        background: "rgba(10, 10, 15, 0.95)",
        border: `1px solid ${winnerColor}55`,
        borderRadius: 24,
        padding: "48px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${winnerColor}22, inset 0 0 20px ${winnerColor}11`,
        willChange: "transform, opacity",
        textAlign: "center"
      }}>
        {/* Glow Header */}
        <div style={{ position: "absolute", top: -1, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${winnerColor}, transparent)`, opacity: 0.8 }} />
        
        <div style={{ fontSize: "clamp(64px, 10vw, 110px)", lineHeight: 1, marginBottom: 12, animation: pulseAnim, filter: `drop-shadow(0 0 20px ${winnerColor}88)` }}>{winnerPiece}</div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 900, color: winnerColor, lineHeight: 1, textShadow: `${glow} ${winnerColor}88`, animation: pulseAnim, letterSpacing: "-0.02em", marginBottom: 8 }}>
          {winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}
        </div>
        
        <div style={{ fontFamily: t.fontMono, fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em", marginBottom: 32, textTransform: "uppercase" }}>
          {phase === "match_over" ? "SERIES COMPLETE" : `GAME ${gameNumber} COMPLETE`}
        </div>

        {seriesDiffers && (
          <div style={{ 
            width: "100%", 
            margin: "0 0 40px 0", 
            padding: "24px", 
            background: "rgba(255,255,255,0.03)", 
            borderRadius: 16, 
            border: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12
          }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>OVERALL SERIES WINNER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 32 }}>{seriesPiece}</span>
              <span style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 800, color: seriesColor }}>{getName(seriesWinner)}</span>
            </div>
          </div>
        )}

        {/* Premium Continue Button */}
        <button 
          onClick={handleDismiss}
          disabled={!canDismiss}
          style={{
            marginTop: 8,
            padding: "16px 48px",
            background: canDismiss ? winnerColor : "rgba(255,255,255,0.05)",
            border: "none",
            borderRadius: 12,
            color: canDismiss ? "#000" : "rgba(255,255,255,0.2)",
            fontFamily: t.fontDisplay,
            fontSize: 16,
            fontWeight: 900,
            cursor: canDismiss ? "pointer" : "default",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: canDismiss ? `0 8px 32px ${winnerColor}44` : "none",
            opacity: canDismiss ? 1 : 0.6,
            display: "flex",
            alignItems: "center",
            gap: 12,
            letterSpacing: "0.05em"
          }}
          onMouseEnter={e => { if (canDismiss) { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 12px 48px ${winnerColor}66`; } }}
          onMouseLeave={e => { if (canDismiss) { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = `0 8px 32px ${winnerColor}44`; } }}
        >
          CONTINUE
          <span style={{ fontSize: 18, transition: "transform 0.3s", transform: "translateX(0)" }}>→</span>
        </button>
      </div>
    </div>
  );
}

export function DisconnectModal({ show, t, ip, onGoHomeAction }: { show: boolean; t: MatchSidebarProps["t"]; ip: boolean; onGoHomeAction: () => void; }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10010, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.danger}`, borderRadius: ip ? 2 : 16, padding: "30px", maxWidth: 400, width: "90vw", textAlign: "center", boxShadow: `0 20px 40px rgba(0,0,0,0.7), 0 0 30px ${t.danger}44`, animation: "scaleIn 0.3s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 800, color: t.danger, marginBottom: 16 }}>OPPONENT DISCONNECTED</div>
        <div style={{ fontFamily: t.fontBody, fontSize: 15, color: t.textSecondary, marginBottom: 24, lineHeight: 1.5 }}>
          Your opponent left the match. The game has been ended.
        </div>
        <button onClick={onGoHomeAction} style={{ background: `${t.danger}22`, border: `1px solid ${t.danger}`, color: t.danger, padding: "12px 24px", borderRadius: ip ? 2 : 8, fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
          RETURN TO HOME
        </button>
      </div>
    </div>
  );
}

export function RematchOverlay({ show, isMultiplayerGame, t, ip, p1c, p2c, seriesWinner, mySlot, rematchRequested, winnerDisplayNameAction, lastSeries, onRematchAction, onQuitMatchAction }: {
  show: boolean; isMultiplayerGame: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  p1c: string; p2c: string; seriesWinner: string | null; mySlot: "P1" | "P2";
  rematchRequested: string | null;
  lastSeries?: { winner: string | null; history: string[] } | null;
  winnerDisplayNameAction?: (w: string | null) => string;
  onRematchAction: () => void; onQuitMatchAction: () => void;
}) {
  if (!show || !isMultiplayerGame) return null;
  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const seriesColor = seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease both" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.accent}`, borderRadius: ip ? 2 : 20, padding: "40px 52px", maxWidth: 500, width: "90vw", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.accent}22`, animation: "scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Header */}
        <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.accent, marginBottom: 6, letterSpacing: "0.08em" }}>MATCH COMPLETE</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 17, fontWeight: 700, color: seriesColor, marginBottom: 20 }}>
          {seriesWinner === "DRAW" ? "FULL MATCH DRAW — NO WINNER" : `${getName(seriesWinner)} WINS THE SERIES`}
        </div>

        {/* Last series breakdown — shown after both accept rematch and new series begins */}
        {lastSeries && (
          <div style={{ background: `${t.gold}0A`, border: `1px solid ${t.gold}2A`, borderRadius: ip ? 2 : 10, padding: "12px 16px", marginBottom: 20, animation: "fadeUp 0.35s ease both" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 10 }}>PREVIOUS SERIES</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 8 }}>
              {lastSeries.history.map((r, i) => {
                const col = r === "P1" ? p1c : r === "P2" ? p2c : r === "DRAW" ? t.gold : "#444";
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.1em" }}>G{i + 1}</div>
                    <div style={{ width: 28, height: 5, borderRadius: 3, background: r ? col : "#2a2a2a", border: `1px solid ${r ? col : "#3a3a3a"}`, boxShadow: r ? `0 0 7px ${col}66` : "none", transition: "all 0.2s" }} />
                    <div style={{ fontFamily: t.fontMono, fontSize: 10, fontWeight: 700, color: r ? col : "#444" }}>{r || "—"}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: lastSeries.winner === "P1" ? p1c : lastSeries.winner === "P2" ? p2c : t.gold, letterSpacing: "0.06em" }}>
              {lastSeries.winner === "DRAW" ? "DRAW" : lastSeries.winner ? `${getName(lastSeries.winner)} WON` : ""}
            </div>
          </div>
        )}

        {/* Waiting status */}
        {rematchRequested && rematchRequested !== mySlot && (
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.gold, marginBottom: 16 }}>Opponent wants a rematch!</div>
        )}
        {rematchRequested === mySlot && (
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginBottom: 16 }}>Waiting for opponent...</div>
        )}
        {!rematchRequested && <div style={{ marginBottom: 16 }} />}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button
            onClick={onRematchAction}
            disabled={rematchRequested === mySlot}
            style={{ background: rematchRequested === mySlot ? `${t.accent}10` : `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, padding: "14px 36px", borderRadius: ip ? 2 : 10, cursor: rematchRequested === mySlot ? "default" : "pointer", opacity: rematchRequested === mySlot ? 0.5 : 1, transition: "all 0.2s" }}
            onMouseEnter={e => { if (rematchRequested !== mySlot) { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
          >REMATCH</button>
          <button
            onClick={onQuitMatchAction}
            style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, padding: "14px 36px", borderRadius: ip ? 2 : 10, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}
          >QUIT</button>
        </div>
      </div>
    </div>
  );
}

export function SurrenderModal({ show, t, ip, isRankedGame, onConfirmAction, onCancelAction, playHoverAction }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean; isRankedGame: boolean;
  onConfirmAction: () => void; onCancelAction: () => void; playHoverAction?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 2}px solid ${t.danger}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize: 44, marginBottom: 20 }} />
        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.danger, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to forfeit this Match?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>{isRankedGame ? <>This counts as a <span style={{ color: t.danger, fontWeight: 700 }}>forfeit</span> and will result in <span style={{ color: t.danger, fontWeight: 700 }}>ELO deduction</span>.</> : "Your opponent will be declared the winner."}</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button className="action-btn" onClick={onConfirmAction} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.danger}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; }}>YES, FORFEIT</button>
          <button className="action-btn" onClick={onCancelAction} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.accent}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = "none"; }}>NO, STAY</button>
        </div>
      </div>
    </div>
  );
}

export function ExitModal({ show, t, ip, onConfirmAction, onCancelAction, playHoverAction }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  onConfirmAction: () => void; onCancelAction: () => void; playHoverAction?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 1}px solid ${t.border}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to quit the current session?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>Current game progress will be lost.</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button className="action-btn" onClick={onConfirmAction} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.danger}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; }}>YES</button>
          <button className="action-btn" onClick={onCancelAction} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${t.accent}55`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = "none"; }}>NO</button>
        </div>
      </div>
    </div>
  );
}