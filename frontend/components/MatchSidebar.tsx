"use client";
import React, { useEffect, useState } from "react";
import { Piece } from "./GamePieces";
import type { Phase } from "./GamePieces";

// ─── Breakpoint hook ──────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatchSidebarProps {
  // theme
  t: {
    bg: string; accent: string; accentGlow: string; fontDisplay: string; fontMono: string;
    fontBody: string; textMuted: string; textSecondary: string; text: string; border: string;
    bgCard: string; bgPanel: string; gold: string; danger: string; inputBg: string;
    pieces: { p1: string; p2: string };
  };
  ip: boolean;
  p1c: string;
  p2c: string;
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
  setScreen?: (s: string) => void;
  // player display names
  p1Label?: string;
  p2Label?: string;
  winnerDisplayName?: (w: string | null) => string;
  // handlers
  onReadyToggle: (player: "P1" | "P2") => void;
  onSendChat: (from: "P1" | "P2") => void;
  onChatInputChange: (v: string) => void;
  onChatKeyDown: (e: React.KeyboardEvent) => void;
  onChatOpenToggle: () => void;
  onSoftReset: () => void;
  onDismissOverlay: () => void;
  onRematch: () => void;
  onQuitMatch: () => void;
  onSurrenderConfirm: () => void;
  onSurrenderCancel: () => void;
  onExitConfirm: () => void;
  onExitCancel: () => void;
  onShowSurrender: () => void;
  onShowExitConfirm: () => void;
  fmtTime: (ms: number) => string;
  playHover?: () => void;
  playClick?: () => void;
}

// ─── Mobile bottom-sheet panel ────────────────────────────────────────────────
// On mobile, panels collapse into a bottom drawer with two tabs: "MATCH" and "LOG"

function MobileBottomPanel(props: MatchSidebarProps) {
  const { t, ip, p1c, p2c, phase, current, gameNumber, matchHistory, seriesWinner,
    gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning, log,
    p1Label, p2Label, winnerDisplayName,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    onSoftReset, onShowSurrender, onShowExitConfirm, setScreen, fmtTime, playHover } = props;

  const [tab, setTab] = useState<"match" | "log">("match");
  const [expanded, setExpanded] = useState(false);
  const getName = (w: string | null) => winnerDisplayName ? winnerDisplayName(w) : (w ?? "");

  const tabBtn = (id: "match" | "log", label: string) => (
    <button
      onClick={() => { setTab(id); setExpanded(true); }}
      style={{
        flex: 1, background: tab === id ? `${t.accent}18` : "none",
        border: "none", borderBottom: `2px solid ${tab === id ? t.accent : "transparent"}`,
        color: tab === id ? t.accent : t.textMuted,
        fontFamily: t.fontMono, fontSize: 12, fontWeight: 700,
        letterSpacing: "0.1em", padding: "10px 0", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >{label}</button>
  );

  const sheetHeight = expanded ? "min(70vh, 480px)" : "52px";

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: t.bgPanel, borderTop: `${ip ? 3 : 1}px solid ${t.border}`,
      borderRadius: ip ? "2px 2px 0 0" : "16px 16px 0 0",
      boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
      height: sheetHeight, transition: "height 0.32s cubic-bezier(.22,.68,0,1.2)",
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {/* Tab bar + collapse toggle */}
      <div style={{
        display: "flex", alignItems: "center", flexShrink: 0,
        borderBottom: `1px solid ${t.border}22`,
      }}>
        {tabBtn("match", "MATCH INFO")}
        {tabBtn("log", "MOVE LOG")}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: "none", border: "none", color: t.textMuted,
            fontFamily: t.fontMono, fontSize: 16, padding: "10px 14px",
            cursor: "pointer", flexShrink: 0,
          }}
        >{expanded ? "▾" : "▴"}</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {tab === "match" && (
          <>
            {/* Timers */}
            <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em", marginBottom: 2 }}>MATCH TIMER</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["P1","P2"] as const).map(p => (
                <div key={p} style={{
                  flex: 1, padding: "8px 10px",
                  background: phase === "playing" && current === p ? `${p === "P1" ? p1c : p2c}22` : t.bgCard,
                  border: `1px solid ${phase === "playing" && current === p ? (p === "P1" ? p1c : p2c) : t.border}`,
                  borderRadius: ip ? 2 : 8, display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "background 0.25s, border-color 0.25s",
                }}>
                  <span style={{ fontFamily: t.fontBody, fontSize: 13, color: p === "P1" ? p1c : p2c, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Piece symbol={p === "P1" ? t.pieces.p1 : t.pieces.p2} color={p === "P1" ? p1c : p2c} size={13}/>
                    {p === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}
                  </span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 14, color: t.text, fontWeight: 700 }}>{p === "P1" ? fmtTime(p1Time) : fmtTime(p2Time)}</span>
                </div>
              ))}
            </div>

            {/* Match history */}
            <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em", marginTop: 4 }}>MATCH HISTORY</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0,1,2].map(i => {
                const result = matchHistory[i] ?? "";
                const col = result === "P1" ? p1c : result === "P2" ? p2c : result === "DRAW" ? t.gold : t.textMuted;
                const isCur = i === gameNumber - 1 && (phase === "playing" || phase === "waiting_ready");
                return (
                  <div key={i} style={{
                    flex: 1, textAlign: "center", padding: "6px 4px",
                    background: isCur ? `${t.accent}10` : t.bgCard,
                    border: `1px solid ${isCur ? t.accent : t.border}`,
                    borderRadius: ip ? 2 : 6, fontFamily: t.fontBody, fontSize: 13,
                  }}>
                    <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 2 }}>G{i+1}</div>
                    <div style={{ color: col, fontWeight: result ? 700 : 400 }}>{result || "—"}</div>
                  </div>
                );
              })}
            </div>
            {seriesWinner && (
              <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.gold, textAlign: "center", fontWeight: 700 }}>
                SERIES: {seriesWinner === "DRAW" ? "DRAW" : `${getName(seriesWinner)} WINS`}
              </div>
            )}

            {/* Ready buttons */}
            {phase === "waiting_ready" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.text, letterSpacing: "0.1em" }}>
                  READY TO PLAY — <span style={{ color: t.accent }}>{Math.ceil(readyTimeout)}s</span>
                </div>
                {gameMode === "ai" ? (() => {
                  const rdy = p1Ready; const col = p1c;
                  return (
                    <button onClick={() => onReadyToggle("P1")} style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>
                      {matchHistory.length >= 2 ? "START RULEBREAKER ⚡" : "START GAME 2"} {rdy ? "✓" : ""}
                    </button>
                  );
                })() : (["P1","P2"] as const).map(p => {
                  const rdy = p === "P1" ? p1Ready : p2Ready; const col = p === "P1" ? p1c : p2c;
                  return (
                    <button key={p} onClick={() => onReadyToggle(p)} style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>
                      {p === "P1" ? (p1Label ?? p) : (p2Label ?? p)} {rdy ? "✓ READY" : "NOT READY"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Match over */}
            {phase === "match_over" && !isMultiplayerGame && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: t.gold, marginBottom: 8 }}>
                  {seriesWinner === "DRAW" ? "DRAW!" : `${getName(seriesWinner)} WINS!`}
                </div>
                <button onClick={onSoftReset} style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}`, color: t.accent, fontFamily: t.fontMono, fontSize: 12, padding: "8px 16px", borderRadius: ip ? 2 : 6, cursor: "pointer" }}>↺ NEW MATCH</button>
              </div>
            )}

            {/* Chat (multiplayer) */}
            {isMultiplayerGame && (phase === "playing" || phase === "waiting_ready") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.text, letterSpacing: "0.1em" }}>CHAT</div>
                  <button onClick={onChatOpenToggle} style={{ background: "none", border: "none", color: t.text, fontFamily: t.fontMono, fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>{chatOpen ? "▾" : "▸"}</button>
                </div>
                {chatOpen && (
                  <>
                    <div style={{ height: 100, overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {chatMessages.length === 0 && <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, textAlign: "center", marginTop: 16 }}>No messages yet</div>}
                      {chatMessages.map((m, i) => (
                        <div key={i} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span>
                          <span style={{ fontFamily: t.fontBody, fontSize: 12, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                    {chatWarning && <div style={{ padding: "6px 10px", background: "#F4433618", border: "1px solid #F44336", borderRadius: 4, fontFamily: t.fontBody, fontSize: 11, color: "#F44336" }}>⚠ Inappropriate language detected.</div>}
                    <div style={{ display: "flex", gap: 4 }}>
                      <input value={chatInput} onChange={e => onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 4, color: t.text, fontFamily: t.fontBody, fontSize: 13, padding: "7px 8px", outline: "none", minWidth: 0 }}/>
                      {(!isMultiplayerGame || mySlot === "P1") && <button onClick={() => onSendChat("P1")} style={{ background: `${p1c}20`, border: `1px solid ${p1c}`, color: p1c, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: ip ? 2 : 4, cursor: "pointer", flexShrink: 0 }}>P1</button>}
                      {(!isMultiplayerGame || mySlot === "P2") && <button onClick={() => onSendChat("P2")} style={{ background: `${p2c}20`, border: `1px solid ${p2c}`, color: p2c, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: ip ? 2 : 4, cursor: "pointer", flexShrink: 0 }}>P2</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {(phase === "playing" || phase === "waiting_ready") && (
                isRankedGame ? (
                  <button onClick={onShowSurrender} style={{ flex: 1, background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 12, padding: "8px", borderRadius: ip ? 2 : 6, cursor: "pointer" }}>⚑ SURRENDER</button>
                ) : isMultiplayer ? null : (
                  <button onClick={onSoftReset} style={{ flex: 1, background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 12, padding: "8px", borderRadius: ip ? 2 : 6, cursor: "pointer" }}>↺ RESET</button>
                )
              )}
              {setScreen && !isRankedGame && (phase === "playing" || phase === "waiting_ready" || phase === "match_over") && (
                <button onClick={onShowExitConfirm} style={{ flex: 1, background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 12, padding: "8px", borderRadius: ip ? 2 : 6, cursor: "pointer" }}>✕ EXIT</button>
              )}
            </div>
          </>
        )}

        {tab === "log" && (
          <>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em", marginBottom: 4 }}>MOVE LOG</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {log.length === 0
                ? <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, fontStyle: "italic" }}>No moves yet</div>
                : log.map((m, i) => (
                  <div key={i} style={{ fontFamily: t.fontMono, fontSize: 13, color: m.player === "P1" ? p1c : p2c, padding: "2px 0", borderBottom: `1px solid ${t.border}22` }}>{m.text}</div>
                ))
              }
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatchSidebar(props: MatchSidebarProps) {
  const bp = useBreakpoint();
  const { t, ip, p1c, p2c, panelW, winner, showWinOverlay, overlayVisible, onDismissOverlay,
    winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece, seriesWinner, phase, gameNumber,
    winnerDisplayName } = props;

  const winOverlay = showWinOverlay && winner && (
    <WinOverlay
      showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
      winner={winner} winnerColor={winnerColor} winnerPiece={winnerPiece}
      seriesDiffers={seriesDiffers} seriesColor={seriesColor} seriesPiece={seriesPiece}
      seriesWinner={seriesWinner} phase={phase} gameNumber={gameNumber}
      t={t} winnerDisplayName={winnerDisplayName} onDismiss={onDismissOverlay}
    />
  );

  if (bp === "mobile") {
    return (
      <>
        {winOverlay}
        <MobileBottomPanel {...props} />
      </>
    );
  }

  // Tablet/Desktop: render left panel (right is rendered by GameScreen)
  return (
    <>
      {winOverlay}
      <LeftPanel {...props} />
    </>
  );
}

// ─── LeftPanel ────────────────────────────────────────────────────────────────

export function LeftPanel(props: MatchSidebarProps) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet  = bp === "tablet";

  const { t, ip, p1c, p2c, panelW, phase, current, gameNumber, matchHistory, seriesWinner,
    gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning,
    p1Label, p2Label, winnerDisplayName,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    onSoftReset, onShowSurrender, fmtTime, playHover } = props;

  if (isMobile) return null; // Mobile uses MobileBottomPanel

  // Responsive panel width: tablet gets narrower panels
  const effectivePanelW = isTablet ? Math.min(panelW, 180) : panelW;

  const getName = (w: string | null) => winnerDisplayName ? winnerDisplayName(w) : (w ?? "");

  return (
    <div style={{
      width: effectivePanelW, flexShrink: 0, background: t.bgPanel,
      borderRight: `${ip ? 3 : 1}px solid ${t.border}`,
      padding: isTablet ? "14px 12px" : "18px 18px",
      display: "flex", flexDirection: "column", gap: isTablet ? 10 : 14, overflowY: "auto",
    }}>
      <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 14 : 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MATCH TIMER</div>
      {(["P1","P2"] as const).map(p => (
        <div key={p} style={{
          padding: isTablet ? "8px 10px" : "12px 14px",
          background: phase === "playing" && current === p ? `${p === "P1" ? p1c : p2c}22` : t.bgCard,
          border: `1px solid ${phase === "playing" && current === p ? (p === "P1" ? p1c : p2c) : t.border}`,
          borderRadius: ip ? 2 : 8, display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "background 0.25s, border-color 0.25s",
        }}>
          <span style={{ fontFamily: t.fontBody, fontSize: isTablet ? 13 : 16, color: p === "P1" ? p1c : p2c, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <Piece symbol={p === "P1" ? t.pieces.p1 : t.pieces.p2} color={p === "P1" ? p1c : p2c} size={isTablet ? 13 : 16}/>
            {p === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}
          </span>
          <span style={{ fontFamily: t.fontMono, fontSize: isTablet ? 14 : 18, color: t.text, fontWeight: 700 }}>
            {p === "P1" ? fmtTime(p1Time) : fmtTime(p2Time)}
          </span>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: isTablet ? 8 : 12 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 14 : 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em", marginBottom: isTablet ? 6 : 10 }}>MATCH HISTORY</div>
        {[0,1,2].map(i => {
          const result = matchHistory[i] ?? "";
          const col = result === "P1" ? p1c : result === "P2" ? p2c : result === "DRAW" ? t.gold : t.textMuted;
          const isCur = i === gameNumber - 1 && (phase === "playing" || phase === "waiting_ready");
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: t.fontBody, fontSize: isTablet ? 16 : 22, padding: "6px 0", borderBottom: `1px solid ${t.border}22` }}>
              <span style={{ color: isCur ? t.accent : t.textMuted, transition: "color 0.2s" }}>G{i+1}{isCur ? " ◄" : ""}</span>
              <span style={{ color: col, fontWeight: result ? 700 : 400, transition: "color 0.2s" }}>{result || "—"}</span>
            </div>
          );
        })}
        {seriesWinner && (
          <div style={{ marginTop: 10, fontFamily: t.fontMono, fontSize: isTablet ? 13 : 20, color: t.gold, textAlign: "center", fontWeight: 700 }}>
            SERIES: {seriesWinner === "DRAW" ? "DRAW" : `${getName(seriesWinner)} WINS`}
          </div>
        )}
      </div>

      {phase === "waiting_ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 14 : 20, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 20 : 28, fontWeight: 700, color: t.accent, textAlign: "center" }}>{Math.ceil(readyTimeout)}s</div>
          {gameMode === "ai" ? (() => {
            const rdy = p1Ready; const col = p1c;
            return (
              <button onClick={() => onReadyToggle("P1")}
                style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: isTablet ? 12 : 15, fontWeight: 700, padding: isTablet ? "9px" : "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55` : "none" }}
                onMouseEnter={e => { playHover?.(); e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
              >{matchHistory.length >= 2 ? "START RULEBREAKER ⚡" : "START GAME 2"} {rdy ? "✓" : ""}</button>
            );
          })() : (["P1","P2"] as const).map(p => {
            const rdy = p === "P1" ? p1Ready : p2Ready; const col = p === "P1" ? p1c : p2c;
            return (
              <button key={p} onClick={() => onReadyToggle(p)}
                style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: isTablet ? 12 : 15, fontWeight: 700, padding: isTablet ? "9px" : "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55` : "none" }}
                onMouseEnter={e => { playHover?.(); e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
              >{p === "P1" ? (p1Label ?? p) : (p2Label ?? p)} {rdy ? "✓ READY" : "NOT READY"}</button>
            );
          })}
        </div>
      )}

      {phase === "match_over" && !isMultiplayerGame && (
        <div style={{ textAlign: "center", animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: isTablet ? 13 : 16, fontWeight: 700, color: t.gold, marginBottom: 10 }}>
            {seriesWinner === "DRAW" ? "DRAW!" : `${getName(seriesWinner)} WINS!`}
          </div>
          <button onClick={onSoftReset} style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}`, color: t.accent, fontFamily: t.fontMono, fontSize: isTablet ? 11 : 13, padding: "10px 18px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>↺ NEW MATCH</button>
        </div>
      )}

      {isMultiplayerGame && (phase === "playing" || phase === "waiting_ready") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 13 : 17, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>CHAT</div>
            <button onClick={onChatOpenToggle} style={{ background: "none", border: "none", color: t.text, fontFamily: t.fontMono, fontSize: 16, cursor: "pointer", padding: "2px 6px" }}>{chatOpen ? "▾" : "▸"}</button>
          </div>
          {chatOpen && (
            <>
              <div style={{ height: isTablet ? 120 : 160, overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {chatMessages.length === 0 && <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, textAlign: "center", marginTop: 24 }}>No messages yet</div>}
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span>
                    <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span>
                  </div>
                ))}
              </div>
              {chatWarning && <div style={{ padding: "8px 12px", background: "#F4433618", border: "1px solid #F44336", borderRadius: 6, fontFamily: t.fontBody, fontSize: 12, color: "#F44336" }}>⚠ Inappropriate language detected.</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <input value={chatInput} onChange={e => onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, color: t.text, fontFamily: t.fontBody, fontSize: isTablet ? 12 : 14, padding: "8px 10px", outline: "none", minWidth: 0 }}/>
                {(!isMultiplayerGame || mySlot === "P1") && <button onClick={() => onSendChat("P1")} style={{ background: `${p1c}20`, border: `1px solid ${p1c}`, color: p1c, fontFamily: t.fontMono, fontSize: isTablet ? 12 : 14, fontWeight: 700, padding: "8px 10px", borderRadius: ip ? 2 : 6, cursor: "pointer", flexShrink: 0 }}>P1</button>}
                {(!isMultiplayerGame || mySlot === "P2") && <button onClick={() => onSendChat("P2")} style={{ background: `${p2c}20`, border: `1px solid ${p2c}`, color: p2c, fontFamily: t.fontMono, fontSize: isTablet ? 12 : 14, fontWeight: 700, padding: "8px 10px", borderRadius: ip ? 2 : 6, cursor: "pointer", flexShrink: 0 }}>P2</button>}
              </div>
            </>
          )}
        </div>
      )}

      {(phase === "playing" || phase === "waiting_ready") && (
        isRankedGame ? (
          <button onClick={onShowSurrender} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: isTablet ? 11 : 13, padding: isTablet ? "7px" : 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>⚑ SURRENDER</button>
        ) : isMultiplayer ? null : (
          <button onClick={onSoftReset} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: isTablet ? 11 : 13, padding: isTablet ? "7px" : 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}>↺ RESET</button>
        )
      )}
    </div>
  );
}

// ─── RightPanel ───────────────────────────────────────────────────────────────

export function RightPanel({ t, ip, p1c, p2c, panelW, phase, log, isRankedGame, setScreen, onShowExitConfirm, playHover }: {
  t: MatchSidebarProps["t"]; ip: boolean; p1c: string; p2c: string; panelW: number;
  phase: Phase; log: { text: string; player: string }[]; isRankedGame: boolean;
  setScreen?: (s: string) => void; onShowExitConfirm: () => void; playHover?: () => void;
}) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet  = bp === "tablet";

  if (isMobile) return null; // Mobile uses MobileBottomPanel

  const effectivePanelW = isTablet ? Math.min(panelW, 180) : panelW;

  return (
    <div style={{
      width: effectivePanelW, flexShrink: 0, background: t.bgPanel,
      borderLeft: `${ip ? 3 : 1}px solid ${t.border}`,
      padding: isTablet ? "14px 12px" : "18px 18px",
      display: "flex", flexDirection: "column", gap: 10, overflowY: "auto",
    }}>
      <div style={{ fontFamily: t.fontMono, fontSize: isTablet ? 14 : 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MOVE LOG</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {log.length === 0
          ? <div style={{ fontFamily: t.fontBody, fontSize: isTablet ? 12 : 14, color: t.textMuted, fontStyle: "italic" }}>No moves yet</div>
          : log.map((m, i) => (
            <div key={i} style={{ fontFamily: t.fontMono, fontSize: isTablet ? 12 : 15, color: m.player === "P1" ? p1c : p2c, padding: "3px 0", borderBottom: `1px solid ${t.border}22` }}>{m.text}</div>
          ))
        }
      </div>
      {setScreen && !isRankedGame && (phase === "playing" || phase === "waiting_ready" || phase === "match_over") && (
        <button onClick={onShowExitConfirm} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: isTablet ? 11 : 13, padding: isTablet ? "7px" : 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", marginTop: 4 }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>✕ EXIT MATCH</button>
      )}
    </div>
  );
}

// ─── WinOverlay ───────────────────────────────────────────────────────────────

export function WinOverlay({ showWinOverlay, overlayVisible, winner, winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece, seriesWinner, phase, gameNumber, t, winnerDisplayName, onDismiss }: {
  showWinOverlay: boolean; overlayVisible: boolean; winner: string | null; winnerColor: string; winnerPiece: string;
  seriesDiffers: boolean; seriesColor: string; seriesPiece: string; seriesWinner: string | null;
  phase: Phase; gameNumber: number; t: { fontDisplay: string; fontMono: string; fontBody: string };
  winnerDisplayName?: (w: string | null) => string;
  onDismiss: () => void;
}) {
  if (!showWinOverlay || !winner) return null;
  const getName = (w: string | null) => winnerDisplayName ? winnerDisplayName(w) : (w ?? "");
  return (
    <div onClick={onDismiss} style={{ position: "fixed", inset: 0, zIndex: 999, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "stretch", willChange: "opacity", opacity: overlayVisible ? 1 : 0, transition: "opacity 0.28s ease" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 0 }}/>
      {seriesDiffers ? (
        <>
          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #ffffff14", willChange: "transform, opacity", opacity: overlayVisible ? 1 : 0, transform: overlayVisible ? "translateY(0)" : "translateY(28px)", transition: "opacity 0.32s ease 0.08s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.08s" }}>
            <div style={{ fontSize: "clamp(44px,7vw,96px)", lineHeight: 1, marginBottom: 8, animation: "winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(32px,6.5vw,90px)", fontWeight: 900, color: winnerColor, lineHeight: 1, textShadow: `0 0 60px ${winnerColor}88`, animation: "winPulse 1.6s ease infinite", textAlign: "center", padding: "0 16px" }}>{winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}</div>
            <div style={{ fontFamily: t.fontMono, fontSize: "clamp(11px,1.2vw,14px)", color: "#777", marginTop: 12, letterSpacing: "0.12em" }}>GAME {gameNumber}</div>
          </div>
          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", willChange: "transform, opacity", opacity: overlayVisible ? 1 : 0, transform: overlayVisible ? "translateY(0)" : "translateY(28px)", transition: "opacity 0.32s ease 0.18s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.18s" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: "clamp(11px,1.2vw,14px)", color: "#777", marginBottom: 12, letterSpacing: "0.12em" }}>SERIES WINNER</div>
            <div style={{ fontSize: "clamp(44px,7vw,96px)", lineHeight: 1, marginBottom: 8, animation: "winPulse 1.6s ease infinite" }}>{seriesPiece}</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(32px,6.5vw,90px)", fontWeight: 900, color: seriesColor, lineHeight: 1, textShadow: `0 0 60px ${seriesColor}88`, animation: "winPulse 1.6s ease infinite", textAlign: "center", padding: "0 16px" }}>{getName(seriesWinner)} WINS!</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "#555", marginTop: 16 }}>tap anywhere to continue</div>
          </div>
        </>
      ) : (
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", willChange: "transform, opacity", opacity: overlayVisible ? 1 : 0, transform: overlayVisible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.96)", transition: "opacity 0.32s ease 0.06s, transform 0.35s cubic-bezier(.22,.68,0,1.2) 0.06s", padding: "0 20px" }}>
          <div style={{ fontSize: "clamp(52px,8vw,110px)", lineHeight: 1, marginBottom: 8, animation: "winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(32px,7vw,100px)", fontWeight: 900, color: winnerColor, lineHeight: 1, marginBottom: 18, textShadow: `0 0 60px ${winnerColor}88`, animation: "winPulse 1.6s ease infinite" }}>{winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}</div>
          {phase === "match_over"
            ? <div style={{ fontFamily: t.fontMono, fontSize: "clamp(12px,1.8vw,18px)", color: "#AAAAAA", marginBottom: 20 }}>MATCH OVER — SERIES COMPLETE</div>
            : <div style={{ fontFamily: t.fontMono, fontSize: "clamp(12px,1.8vw,18px)", color: "#AAAAAA", marginBottom: 20 }}>GAME {gameNumber} COMPLETE</div>
          }
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: "#666" }}>tap anywhere to continue</div>
        </div>
      )}
    </div>
  );
}

// ─── RematchOverlay ───────────────────────────────────────────────────────────

export function RematchOverlay({ show, isMultiplayerGame, t, ip, p1c, p2c, seriesWinner, mySlot, rematchRequested, winnerDisplayName, onRematch, onQuitMatch }: {
  show: boolean; isMultiplayerGame: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  p1c: string; p2c: string; seriesWinner: string | null; mySlot: "P1"|"P2";
  rematchRequested: string | null;
  winnerDisplayName?: (w: string | null) => string;
  onRematch: () => void; onQuitMatch: () => void;
}) {
  if (!show || !isMultiplayerGame) return null;
  const getName = (w: string | null) => winnerDisplayName ? winnerDisplayName(w) : (w ?? "");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease both", padding: "16px" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.accent}`, borderRadius: ip ? 2 : 20, padding: "40px 40px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.accent}22`, animation: "scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(20px,4vw,28px)", fontWeight: 900, color: t.accent, marginBottom: 8, letterSpacing: "0.08em" }}>MATCH COMPLETE</div>
        <div style={{ fontFamily: t.fontMono, fontSize: "clamp(14px,2.5vw,18px)", fontWeight: 700, color: seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold, marginBottom: 6 }}>
          {seriesWinner === "DRAW" ? "DRAW!" : `${getName(seriesWinner)} WINS THE SERIES`}
        </div>
        {rematchRequested && rematchRequested !== mySlot && <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.gold, marginBottom: 16 }}>⚡ Opponent wants a rematch!</div>}
        {rematchRequested === mySlot && <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginBottom: 16 }}>⏳ Waiting for opponent...</div>}
        {!rematchRequested && <div style={{ marginBottom: 16 }}/>}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onRematch} disabled={rematchRequested === mySlot}
            style={{ background: rematchRequested === mySlot ? `${t.accent}10` : `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: "clamp(13px,2vw,16px)", fontWeight: 700, padding: "12px 28px", borderRadius: ip ? 2 : 10, cursor: rematchRequested === mySlot ? "default" : "pointer", opacity: rematchRequested === mySlot ? 0.5 : 1, transition: "all 0.2s" }}
            onMouseEnter={e => { if (rematchRequested !== mySlot) { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
          >↺ REMATCH</button>
          <button onClick={onQuitMatch}
            style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: "clamp(13px,2vw,16px)", fontWeight: 700, padding: "12px 28px", borderRadius: ip ? 2 : 10, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}
          >✕ QUIT</button>
        </div>
      </div>
    </div>
  );
}

// ─── SurrenderModal ───────────────────────────────────────────────────────────

export function SurrenderModal({ show, t, ip, isRankedGame, onConfirm, onCancel, playHover }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean; isRankedGame: boolean;
  onConfirm: () => void; onCancel: () => void; playHover?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "16px" }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 2}px solid ${t.danger}`, borderRadius: ip ? 2 : 20, padding: "clamp(24px,4vw,48px) clamp(24px,5vw,56px)", maxWidth: 520, width: "100%", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize: "clamp(32px,5vw,44px)", marginBottom: 20 }}>⚑</div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(14px,2.5vw,23px)", fontWeight: 700, color: t.danger, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to forfeit this Match?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: "clamp(12px,1.8vw,15px)", color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>{isRankedGame ? <>This counts as a <span style={{ color: t.danger, fontWeight: 700 }}>forfeit</span> and will result in <span style={{ color: t.danger, fontWeight: 700 }}>ELO deduction</span>.</> : "Your opponent will be declared the winner."}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="action-btn" onClick={onConfirm} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: "clamp(12px,2vw,17px)", fontWeight: 700, padding: "clamp(10px,2vw,14px) clamp(20px,4vw,52px)", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}>YES, FORFEIT</button>
          <button className="action-btn" onClick={onCancel} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: "clamp(12px,2vw,17px)", fontWeight: 700, padding: "clamp(10px,2vw,14px) clamp(20px,4vw,52px)", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}>NO, STAY</button>
        </div>
      </div>
    </div>
  );
}

// ─── ExitModal ────────────────────────────────────────────────────────────────

export function ExitModal({ show, t, ip, onConfirm, onCancel, playHover }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  onConfirm: () => void; onCancel: () => void; playHover?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "16px" }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 1}px solid ${t.border}`, borderRadius: ip ? 2 : 20, padding: "clamp(24px,4vw,48px) clamp(24px,5vw,56px)", maxWidth: 520, width: "100%", textAlign: "center", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: "clamp(32px,5vw,44px)", marginBottom: 20 }}>⚠️</div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(14px,2.5vw,23px)", fontWeight: 700, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to quit the current session?</div>
        <div style={{ fontFamily: t.fontBody, fontSize: "clamp(12px,1.8vw,15px)", color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>Current game progress will be lost.</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="action-btn" onClick={onConfirm} style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: "clamp(12px,2vw,17px)", fontWeight: 700, padding: "clamp(10px,2vw,14px) clamp(20px,4vw,52px)", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}>YES</button>
          <button className="action-btn" onClick={onCancel} style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: "clamp(12px,2vw,17px)", fontWeight: 700, padding: "clamp(10px,2vw,14px) clamp(20px,4vw,52px)", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}>NO</button>
        </div>
      </div>
    </div>
  );
}