"use client";
import React from "react";
import { formatSeriesPts } from "@/lib/seriesPoints";
import { Piece, Flame, Skull, SnowflakePiece, IceShardPiece } from "./GamePieces";
import type { Phase } from "./GamePieces";
import type { Screen } from "@/lib/types";
import BloodMoonBanner from "./BloodMoonBanner";
import { BannerRenderer, BANNERS_DATA } from "./BannerRenderer";
import { useBannerShineEnabled } from "@/lib/bannerShinePreference";
import { useAuthStore } from "@/lib/store";

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
  if (pat === "P") return "P";
  if (pat === "T") return "T";
  return pat;
}

/** Robust winner extraction regardless if item is a string or an object. */
export function safeWinner(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && "winner" in item) return String(item.winner);
  return "";
}

/** P1/P2 win counts only (same as local BO3 checkSeriesWinner). */
function localBo3WinCounts(matchHistory: string[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const item of matchHistory) {
    const w = safeWinner(item);
    if (w === "P1") p1 += 1;
    else if (w === "P2") p2 += 1;
  }
  return { p1, p2 };
}

function sidebarDisplayName(raw?: string): string {
  return (raw ?? "PLAYER")
    .replace(/\(([xy])\)/gi, "")
    .trim()
    .toUpperCase();
}

/**
 * Label for game N in the multiplayer 10-game series.
 * G3 = Rulebreaker, G6 = Timebreaker, G9 = Mindbreaker, G10 = Limitbreaker.
 * For any non-MP (e.g. SP/AI BO3) series, falls back to plain `G{n}`.
 */
function gameSeriesLabel(gameNum: number, totalSlots: number): string {
  if (totalSlots === 10) {
    switch (gameNum) {
      case 3:  return "RULEB";
      case 6:  return "TIMEB";
      case 9:  return "MINDB";
      case 10: return "LIMITB";
      default: return `G${gameNum}`;
    }
  }
  return `G${gameNum}`;
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
  /** Stones placed this game; with gameNumber drives ABORT vs SURRENDER for ranked. */
  movesPlayed?: number;
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
  /** Opponent messages received while chat panel was collapsed (multiplayer). */
  unreadOpponentChat?: number;
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
  segmentStartIndex?: number;
  historyDisplayStartIndex?: number;
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
  interGameReadyVisible?: boolean;
  /** Multiplayer: first ~1s after entering waiting_ready — muted “Get ready…” row. */
  waitingReadyWarmup?: boolean;
  /** Singleplayer/AI: whether the pattern overlay is currently visible. */
  showPatternOverlay?: boolean;
  /** Singleplayer/AI: callback to toggle the pattern overlay. */
  onTogglePatternOverlay?: () => void;
}

// ─── Separate named exports so GameScreen can render panels individually ──────


export function LeftPanel(props: MatchSidebarProps) {
  // SURRENDER / RESET controls and `movesPlayed` were intentionally removed
  // from this panel — they now live in RightPanel so the chat area can
  // expand freely and the close toggle stays unobstructed on the left.
  const { t, ip, p1c, p2c, pieceSkin, p1RttMs, p2RttMs, panelW, phase, current, gameNumber, matchHistory, seriesWinner,
    gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot, boardMode, selectedPatterns, rbBannedPatterns = [], patternsAsSecret = false, p1SeriesPts, p2SeriesPts,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning, unreadOpponentChat = 0,
    p1Label, p2Label, p1Banner, p2Banner, winnerDisplayNameAction, lastSeries, segmentStartIndex = 0, historyDisplayStartIndex = 0,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    fmtTimeAction, playHoverAction,
    interGameReadyVisible, waitingReadyWarmup,
    showPatternOverlay, onTogglePatternOverlay } = props;

  const accountId = useAuthStore((s) => (s.user as any)?.id ?? (s.user as any)?._id ?? null);
  const bannerShineEnabled = useBannerShineEnabled(accountId);

  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const showInterGameReady = interGameReadyVisible ?? (phase === "waiting_ready");
  const showWaitingReadyWarmup = Boolean(waitingReadyWarmup);
  const absoluteCurrentGame = historyDisplayStartIndex + gameNumber;
  const historySlots = gameMode === "ai" || gameMode === "singleplayer" ? 3 : 10;
  const localBo3 = gameMode === "ai" || gameMode === "singleplayer";
  const localWins = localBo3 ? localBo3WinCounts(matchHistory) : null;
  const useFlameSkull = pieceSkin === "flame_skull";
  const useSnowflakeShard = pieceSkin === "snowflake_shard";
  const chatListRef = React.useRef<HTMLDivElement | null>(null);

  const [vh, setVh] = React.useState(800);
  React.useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isShorter = vh < 850;
  const isVeryShort = vh < 720;
  const densityGap = isVeryShort ? 6 : isShorter ? 10 : 14;
  const headingSize = isVeryShort ? 16 : isShorter ? 18 : 20;

  React.useEffect(() => {
    if (!chatOpen) return;
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatOpen, chatMessages.length]);

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
    <div style={{ 
      width: panelW, 
      minWidth: panelW, 
      maxWidth: 300, 
      resize: "horizontal", 
      overflowX: "hidden", 
      flexShrink: 0, 
      background: t.bgPanel, 
      borderRight: `${ip ? 3 : 1}px solid ${t.border}`, 
      padding: isShorter ? "12px 14px" : "18px 18px", 
      display: "flex", 
      flexDirection: "column", 
      gap: densityGap, 
      overflowY: "auto", 
      position: "relative" 
    }}>
      <div style={{ fontFamily: t.fontMono, fontSize: headingSize, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MATCH TIMER</div>
      {(["P1", "P2"] as const).map(p => {
        const isCurrentMover = phase === "playing" && current === p;
        const bannerId = p === "P1" ? (p1Banner || "default") : (p2Banner || "default");
        return (
        <div key={p} style={{ position: "relative", overflow: "hidden", borderRadius: ip ? 2 : 8, border: `1px solid ${isCurrentMover ? (p === "P1" ? p1c : p2c) : t.border}`, transition: "border-color 0.25s", background: t.bgCard }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1, zIndex: 0, transition: "opacity 0.5s ease" }}>
            <BannerRenderer bannerId={bannerId} hideLabels={true} />
            <div style={{ 
              position: "absolute", 
              inset: 0, 
              background: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)", 
              zIndex: 1 
            }} />
            {bannerShineEnabled && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: "-150%",
                  width: "200%",
                  height: "100%",
                  background:
                    "linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.16) 40%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 50%)",
                  zIndex: 2,
                  animation: "matchSidebarBannerShine 4s infinite linear",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
          <div style={{ position: "relative", zIndex: 2, padding: isShorter ? "8px 10px" : "12px 14px", background: isCurrentMover ? `${p === "P1" ? p1c : p2c}33` : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.25s" }}>
          <span style={{ fontFamily: t.fontDisplay, fontSize: 13, color: p === "P1" ? p1c : p2c, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em", textShadow: `0 2px 4px rgba(0,0,0,0.8)` }}>
            {
              (() => {
                const raw = p === "P1" ? p1Label : p2Label;
                const name = sidebarDisplayName(raw);

                return <>{renderSidebarPiece(p)} {name}{renderNetBars(p)}</>;
              })()
            }
          </span>
          <span style={{ fontFamily: t.fontMono, fontSize: 16, color: t.text, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{p === "P1" ? fmtTimeAction(p1Time) : fmtTimeAction(p2Time)}</span>
        </div>
        </div>
      )})}

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: isShorter ? 8 : 12 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: headingSize - 1, fontWeight: 700, color: t.text, letterSpacing: "0.14em", marginBottom: isShorter ? 6 : 10 }}>MATCH HISTORY</div>

        {(isMultiplayerGame || isMultiplayer) && typeof p1SeriesPts === "number" && typeof p2SeriesPts === "number" && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 10 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 6 }}>SERIES POINTS · FIRST TO 3</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{formatSeriesPts(p1SeriesPts)}</span></span>
              <span style={{ color: t.textMuted, fontSize: 14 }}>—</span>
              <span style={{ color: p2c }}>{p2Label ?? "P2"} <span style={{ color: t.text }}>{formatSeriesPts(p2SeriesPts)}</span></span>
            </div>
          </div>
        )}

        {localBo3 && localWins && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 10 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 6 }}>SERIES · FIRST TO 2</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{localWins.p1}</span></span>
              <span style={{ color: t.textMuted, fontSize: 14 }}>—</span>
              <span style={{ color: p2c }}>{p2Label ?? "P2"} <span style={{ color: t.text }}>{localWins.p2}</span></span>
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
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted }}>{gameSeriesLabel(i + 1, lastSeries.history.length)}</div>
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
          {Array.from({ length: historySlots }).map((_, i) => {
            const rawResult = matchHistory[i];
            const result = safeWinner(rawResult);
            const col = result === "P1" ? p1c : result === "P2" ? p2c : result === "DRAW" ? t.gold : t.textMuted;
            const absoluteGame = i + 1;
            const isCur = absoluteGame === absoluteCurrentGame && (phase === "playing" || phase === "waiting_ready");
            return (
              <React.Fragment key={i}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontFamily: t.fontBody, fontSize: 22, padding: "6px 0", borderBottom: `1px solid ${t.border}22`, opacity: 1 }}>
                  <span style={{ color: isCur ? t.accent : t.textMuted, transition: "color 0.2s" }}>{gameSeriesLabel(absoluteGame, historySlots)}{isCur ? " *" : ""}</span>
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


      {showWaitingReadyWarmup && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 600, color: t.textMuted, letterSpacing: "0.06em", textAlign: "center" }}>Get ready…</div>
        </div>
      )}
      {showInterGameReady && !showWaitingReadyWarmup && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.accent, textAlign: "center" }}>{Math.ceil(readyTimeout)}s</div>
          {gameMode === "ai" || gameMode === "singleplayer" ? (
            (() => {
              const rdy = p1Ready;
              const col = p1c;
              return (
                <button onClick={() => onReadyToggle("P1")}
                  className={!rdy ? "thump-anim" : ""}
                  style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                  onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                >{matchHistory.length >= 2 ? "START GAME 3" : `START GAME ${gameNumber + 1}`} {rdy ? "READY" : ""}</button>
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
      {/* SP/AI series-over prompt is shown as a full-screen WinOverlay "match-over" pane
          (see WinOverlay.showMatchOverPane). The sidebar no longer duplicates the CTA. */}
      {!isMultiplayerGame && selectedPatterns && selectedPatterns.length > 0 && onTogglePatternOverlay && (
        <div style={{ marginTop: "auto", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
          <button
            onClick={onTogglePatternOverlay}
            style={{
              width: "100%",
              background: showPatternOverlay ? `${t.accent}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${showPatternOverlay ? t.accent : t.border}`,
              color: showPatternOverlay ? t.accent : t.textSecondary,
              fontFamily: t.fontMono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "10px 0",
              borderRadius: ip ? 2 : 8,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {showPatternOverlay ? "HIDE PATTERNS" : "SHOW PATTERNS"}
          </button>
        </div>
      )}
      {isMultiplayerGame && (phase === "playing" || phase === "waiting_ready") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>CHAT</div>
              {!chatOpen && unreadOpponentChat > 0 && (
                <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: t.accent, color: "#000", fontFamily: t.fontMono, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                  {unreadOpponentChat > 9 ? "9+" : unreadOpponentChat}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={onChatOpenToggle} style={{ background: "none", border: "none", color: t.text, fontFamily: t.fontMono, fontSize: 16, cursor: "pointer", padding: "2px 6px", flexShrink: 0 }}>{chatOpen ? "▾" : "▸"}</button>
            </div>
          </div>
        </div>
      )}
      {isMultiplayerGame && chatOpen && (phase === "playing" || phase === "waiting_ready") && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 10,
            right: 10,
            top: "48%",
            bottom: 66,
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${t.border}`,
            borderRadius: ip ? 2 : 10,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
          }}
        >
          <div ref={chatListRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {chatMessages.length === 0 && (<div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", marginTop: 24 }}>No messages yet</div>)}
            {chatMessages.map((m, i) => (<div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span><span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span></div>))}
          </div>
          {chatWarning && (<div style={{ padding: "8px 12px", background: "#F4433618", border: "1px solid #F44336", borderRadius: 6, fontFamily: t.fontBody, fontSize: 13, color: "#F44336" }}>Inappropriate language detected and censored.</div>)}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={chatInput} onChange={e => onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 6, color: t.text, fontFamily: t.fontBody, fontSize: 14, padding: "8px 10px", outline: "none", minWidth: 0 }} />
            {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={() => onSendChat("P1")} style={{ background: `${p1c}20`, border: `1px solid ${p1c}`, color: p1c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p1c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p1c}20`; e.currentTarget.style.color = p1c; }}>P1</button>)}
            {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={() => onSendChat("P2")} style={{ background: `${p2c}20`, border: `1px solid ${p2c}`, color: p2c, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = p2c; e.currentTarget.style.color = "#000"; }} onMouseLeave={e => { e.currentTarget.style.background = `${p2c}20`; e.currentTarget.style.color = p2c; }}>P2</button>)}
          </div>
        </div>
      )}
      {/* SURRENDER / RESET moved to RightPanel so the left panel's CHAT area is free to
          expand and keep its close/toggle control visible. */}
      <style>{`@keyframes matchSidebarBannerShine { from { transform: translateX(-50%); } to { transform: translateX(100%); } }`}</style>
    </div>
  );
}

export function RightPanel({
  t, ip, p1c, p2c, panelW, phase, log, isRankedGame, setScreenAction,
  onShowExitConfirmAction, playHoverAction,
  isMultiplayer = false, isMultiplayerGame = false,
  gameNumber = 1, movesPlayed = 0,
  onShowSurrenderAction, onSoftResetAction,
  onOpenSettingsAction,
}: {
  t: MatchSidebarProps["t"]; ip: boolean; p1c: string; p2c: string; panelW: number;
  phase: Phase; log: { text: string; player: string }[]; isRankedGame: boolean;
  setScreenAction?: (s: Screen) => void; onShowExitConfirmAction: () => void; playHoverAction?: () => void;
  isMultiplayer?: boolean; isMultiplayerGame?: boolean;
  gameNumber?: number; movesPlayed?: number;
  onShowSurrenderAction?: () => void; onSoftResetAction?: () => void;
  onOpenSettingsAction?: () => void;
}) {
  const isPreMoveAbort = isRankedGame && gameNumber === 1 && (movesPlayed ?? 0) === 0;
  const showSurrenderOrReset = phase === "playing" || phase === "waiting_ready";
  const renderSurrenderOrReset = () => {
    if (!showSurrenderOrReset) return null;
    if (isRankedGame) {
      if (!onShowSurrenderAction) return null;
      return (
        <button
          onClick={onShowSurrenderAction}
          style={
            isPreMoveAbort
              ? { background: `${t.border}22`, border: `1px solid ${t.border}`, color: t.textSecondary, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }
              : { background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }
          }
          onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = isPreMoveAbort ? `${t.border}40` : `${t.danger}30`; }}
          onMouseLeave={e => { e.currentTarget.style.background = isPreMoveAbort ? `${t.border}22` : `${t.danger}16`; }}
        >
          {isPreMoveAbort ? "ABORT" : "SURRENDER"}
        </button>
      );
    }
    if (isMultiplayer || isMultiplayerGame) return null;
    if (!onSoftResetAction) return null;
    return (
      <button
        onClick={onSoftResetAction}
        style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}
      >
        RESET
      </button>
    );
  };

  return (
    <div style={{ width: panelW, minWidth: panelW, maxWidth: 300, resize: "horizontal", overflowX: "hidden", direction: "rtl", flexShrink: 0, background: t.bgPanel, borderLeft: `${ip ? 3 : 1}px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ direction: "ltr", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.14em" }}>MOVE LOG</div>
          {onOpenSettingsAction && (
            <button
              type="button"
              title="Settings"
              aria-label="Settings"
              onClick={() => {
                playHoverAction?.();
                onOpenSettingsAction();
              }}
              onMouseEnter={(e) => {
                playHoverAction?.();
                e.currentTarget.style.borderColor = t.accent;
                e.currentTarget.style.color = t.accent;
                e.currentTarget.style.background = `${t.accent}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${t.border}66`;
                e.currentTarget.style.color = t.text;
                e.currentTarget.style.background = `${t.border}22`;
              }}
              style={{
                flexShrink: 0,
                background: `${t.border}22`,
                border: `1px solid ${t.border}66`,
                color: t.text,
                width: 40,
                height: 40,
                borderRadius: "25%",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {log.length === 0 ? <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, fontStyle: "italic" }}>No moves yet</div> : log.slice().reverse().map((m, i) => <div key={i} style={{ fontFamily: t.fontMono, fontSize: 15, color: m.player === "P1" ? p1c : p2c, padding: "3px 0", borderBottom: `1px solid ${t.border}22` }}>{m.text}</div>)}
        </div>
        {renderSurrenderOrReset()}
        {setScreenAction && !isRankedGame && (phase === "playing" || phase === "waiting_ready" || phase === "match_over") && (
          <button onClick={onShowExitConfirmAction} style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", marginTop: 4 }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }} onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}>EXIT MATCH</button>
        )}
      </div>
    </div>
  );
}

export function WinOverlay({
  showWinOverlay,
  overlayVisible,
  winner,
  winnerColor,
  winnerPiece,
  seriesDiffers,
  seriesColor,
  seriesPiece,
  seriesWinner,
  phase,
  gameNumber,
  t,
  winnerDisplayNameAction,
  onDismissAction,
  graphicsQuality = "quality",
  centralReadyStep = false,
  centralMatchOverStep = false,
  onNewMatchAction,
  onQuitToHomeAction,
  interGameReadyVisible = true,
  waitingReadyWarmup = false,
  isMultiplayerGame = false,
  gameMode = "singleplayer",
  p1Ready = false,
  p2Ready = false,
  readyTimeoutSec = 60,
  onReadyToggleAction,
  p1DisplayName = "P1",
  p2DisplayName = "P2",
  accentColor = "#7CFF7C",
  p1c = "#7CFF7C",
  p2c = "#FFB84D",
  textSecondary = "rgba(255,255,255,0.55)",
  ip = false,
  mySlot,
}: {
  showWinOverlay: boolean;
  overlayVisible: boolean;
  winner: string | null;
  winnerColor: string;
  winnerPiece: string;
  seriesDiffers: boolean;
  seriesColor: string;
  seriesPiece: string;
  seriesWinner: string | null;
  phase: Phase;
  gameNumber: number;
  t: { fontDisplay: string; fontMono: string; fontBody: string };
  winnerDisplayNameAction?: (w: string | null) => string;
  onDismissAction: () => void;
  graphicsQuality?: "performance" | "quality";
  centralReadyStep?: boolean;
  centralMatchOverStep?: boolean;
  onNewMatchAction?: () => void;
  onQuitToHomeAction?: () => void;
  interGameReadyVisible?: boolean;
  waitingReadyWarmup?: boolean;
  isMultiplayerGame?: boolean;
  gameMode?: string;
  p1Ready?: boolean;
  p2Ready?: boolean;
  readyTimeoutSec?: number;
  onReadyToggleAction?: (player: "P1" | "P2") => void;
  p1DisplayName?: string;
  p2DisplayName?: string;
  accentColor?: string;
  p1c?: string;
  p2c?: string;
  textSecondary?: string;
  ip?: boolean;
  mySlot?: "P1" | "P2";
}) {
  const [canDismiss, setCanDismiss] = React.useState(false);
  React.useEffect(() => {
    if (showWinOverlay) {
      setCanDismiss(false);
      const timer = setTimeout(() => setCanDismiss(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showWinOverlay]);

  const showWinPane = Boolean(showWinOverlay && winner);
  const showReadyPane = Boolean(centralReadyStep && !showWinOverlay && phase === "waiting_ready");
  const showMatchOverPane = Boolean(centralMatchOverStep && !showWinOverlay && phase === "match_over");
  if (!showWinPane && !showReadyPane && !showMatchOverPane) return null;

  const getName = (w: string | null) => (winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? ""));
  const pulseAnim = "none";
  const glow = "none";
  const handleDismiss = () => {
    if (canDismiss) onDismissAction();
  };

  const frameColor = showWinPane && winner ? winnerColor : (showMatchOverPane && seriesWinner && seriesWinner !== "DRAW" ? (seriesWinner === "P1" ? p1c : p2c) : accentColor);
  const localSpOrAi = gameMode === "ai" || gameMode === "singleplayer";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        willChange: "opacity",
        opacity: overlayVisible ? 1 : 0,
        transition: "none",
        pointerEvents: overlayVisible ? "auto" : "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 0 }} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "min(640px, 92vw)",
          background: "rgba(10, 10, 15, 0.95)",
          border: `1px solid ${frameColor}55`,
          borderRadius: 24,
          padding: showReadyPane ? "44px 36px" : "48px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${frameColor}22, inset 0 0 20px ${frameColor}11`,
          willChange: "transform, opacity",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -1,
            left: "20%",
            right: "20%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${frameColor}, transparent)`,
            opacity: 0.8,
          }}
        />

        {showWinPane && winner ? (
          <>
            <div
              style={{
                fontSize: "clamp(64px, 10vw, 110px)",
                lineHeight: 1,
                marginBottom: 12,
                animation: pulseAnim,
                filter: `drop-shadow(0 0 20px ${winnerColor}88)`,
              }}
            >
              {winnerPiece}
            </div>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(36px, 6vw, 72px)",
                fontWeight: 900,
                color: winnerColor,
                lineHeight: 1,
                textShadow: `${glow} ${winnerColor}88`,
                animation: pulseAnim,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              {winner === "DRAW" ? "DRAW" : `${getName(winner)} WINS!`}
            </div>

            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.2em",
                marginBottom: 32,
                textTransform: "uppercase",
              }}
            >
              {phase === "match_over" ? "SERIES COMPLETE" : `GAME ${gameNumber} COMPLETE`}
            </div>

            {seriesDiffers && (
              <div
                style={{
                  width: "100%",
                  margin: "0 0 40px 0",
                  padding: "24px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.15em",
                  }}
                >
                  OVERALL SERIES WINNER
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 32 }}>{seriesPiece}</span>
                  <span style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 800, color: seriesColor }}>{getName(seriesWinner)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
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
                letterSpacing: "0.05em",
              }}
              onMouseEnter={(e) => {
                if (canDismiss) {
                  e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                  e.currentTarget.style.boxShadow = `0 12px 48px ${winnerColor}66`;
                }
              }}
              onMouseLeave={(e) => {
                if (canDismiss) {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = `0 8px 32px ${winnerColor}44`;
                }
              }}
            >
              CONTINUE
              <span style={{ fontSize: 18, transition: "transform 0.3s", transform: "translateX(0)" }}>→</span>
            </button>
          </>
        ) : null}

        {showReadyPane && onReadyToggleAction ? (
          <>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(32px, 5.5vw, 52px)",
                fontWeight: 900,
                color: accentColor,
                letterSpacing: "0.06em",
                marginBottom: 14,
              }}
            >
              READY TO PLAY
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: t.fontMono,
                fontSize: "clamp(14px, 2.2vw, 18px)",
                color: textSecondary,
                letterSpacing: "0.08em",
              }}
            >
              Next game starts in {Math.max(0, Math.ceil(readyTimeoutSec))}s
            </div>

            {waitingReadyWarmup && (
              <div style={{ marginTop: 20, fontFamily: t.fontBody, fontSize: 16, fontWeight: 600, color: textSecondary, letterSpacing: "0.04em" }}>
                Get ready…
              </div>
            )}

            {!waitingReadyWarmup && interGameReadyVisible && (
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  justifyContent: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  width: "100%",
                }}
              >
                {localSpOrAi ? (
                  <button
                    type="button"
                    onClick={() => onReadyToggleAction("P1")}
                    style={{
                      minWidth: "min(100%, 320px)",
                      padding: "18px 28px",
                      borderRadius: ip ? 2 : 14,
                      border: `2px solid ${p1Ready ? p1c : "rgba(170,0,0,0.7)"}`,
                      background: p1Ready ? `${p1c}22` : "rgba(170,0,0,0.12)",
                      color: p1Ready ? p1c : "#ff6b6b",
                      fontFamily: t.fontDisplay,
                      fontSize: "clamp(16px, 2.8vw, 22px)",
                      fontWeight: 900,
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: p1Ready ? `0 8px 28px ${p1c}44` : "none",
                    }}
                  >
                    {p1DisplayName}
                    {p1Ready ? " — READY" : " — TAP WHEN READY"}
                  </button>
                ) : (
                  (["P1", "P2"] as const).map((slot) => {
                    const rdy = slot === "P1" ? p1Ready : p2Ready;
                    const col = slot === "P1" ? p1c : p2c;
                    const label = slot === "P1" ? p1DisplayName : p2DisplayName;
                    const isMine = !mySlot || mySlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onReadyToggleAction(slot)}
                        disabled={!isMine}
                        style={{
                          minWidth: 200,
                          flex: "1 1 200px",
                          maxWidth: 280,
                          padding: "18px 22px",
                          borderRadius: ip ? 2 : 14,
                          border: `2px solid ${rdy ? col : "rgba(255,255,255,0.22)"}`,
                          background: rdy ? `${col}22` : "rgba(255,255,255,0.04)",
                          color: rdy ? col : textSecondary,
                          fontFamily: t.fontDisplay,
                          fontSize: "clamp(15px, 2.4vw, 20px)",
                          fontWeight: 900,
                          letterSpacing: "0.03em",
                          cursor: isMine ? "pointer" : "default",
                          opacity: isMine ? 1 : 0.75,
                          transition: "all 0.2s",
                          boxShadow: rdy ? `0 8px 24px ${col}33` : "none",
                        }}
                      >
                        {label}
                        {rdy ? " — READY" : " — READY?"}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : null}

        {showMatchOverPane ? (
          <>
            <div
              style={{
                fontSize: "clamp(56px, 9vw, 96px)",
                lineHeight: 1,
                marginBottom: 10,
                filter: `drop-shadow(0 0 18px ${frameColor}66)`,
              }}
            >
              {seriesWinner === "DRAW" ? "⚖" : seriesPiece}
            </div>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 900,
                color: frameColor,
                letterSpacing: "0.06em",
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              {seriesWinner === "DRAW" ? "SERIES DRAW" : `${getName(seriesWinner)} WINS THE SERIES`}
            </div>
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.2em",
                marginBottom: 28,
                textTransform: "uppercase",
              }}
            >
              SERIES COMPLETE
            </div>
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => onNewMatchAction?.()}
                style={{
                  minWidth: "min(100%, 320px)",
                  padding: "18px 28px",
                  borderRadius: ip ? 2 : 14,
                  border: `2px solid ${accentColor}`,
                  background: `${accentColor}22`,
                  color: accentColor,
                  fontFamily: t.fontDisplay,
                  fontSize: "clamp(16px, 2.8vw, 22px)",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: `0 8px 28px ${accentColor}33`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}33`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${accentColor}22`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                NEW MATCH?
              </button>
              {onQuitToHomeAction && (
                <button
                  type="button"
                  onClick={() => onQuitToHomeAction()}
                  style={{
                    minWidth: "min(100%, 320px)",
                    padding: "14px 28px",
                    borderRadius: ip ? 2 : 14,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.04)",
                    color: textSecondary,
                    fontFamily: t.fontDisplay,
                    fontSize: "clamp(14px, 2.4vw, 18px)",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                >
                  QUIT TO HOME
                </button>
              )}
            </div>
          </>
        ) : null}
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

/** Match voided: no stone was played; no career / ELO for either side. */
export function MatchAbortedNoPlayModal({
  show,
  t,
  ip,
  isSelfAbort,
  onGoHomeAction,
}: {
  show: boolean;
  t: MatchSidebarProps["t"];
  ip: boolean;
  isSelfAbort: boolean;
  onGoHomeAction: () => void;
}) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10011, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.textMuted}`, borderRadius: ip ? 2 : 16, padding: "30px", maxWidth: 440, width: "90vw", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.75)", animation: "scaleIn 0.3s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 14 }}>MATCH ABORTED</div>
        <div style={{ fontFamily: t.fontBody, fontSize: 15, color: t.textSecondary, marginBottom: 24, lineHeight: 1.55 }}>
          {isSelfAbort ? (
            <>You left before any move in game 1. This match was voided and will not appear in Career.</>
          ) : (
            <>Your opponent left before any move in game 1. The match was voided and will not appear in Career for either player.</>
          )}
        </div>
        <button
          type="button"
          onClick={onGoHomeAction}
          style={{
            background: `${t.accent}22`,
            border: `1px solid ${t.accent}`,
            color: t.accent,
            padding: "12px 24px",
            borderRadius: ip ? 2 : 8,
            fontFamily: t.fontMono,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          RETURN TO HOME
        </button>
      </div>
    </div>
  );
}

export function RematchOverlay({ show, isMultiplayerGame, t, ip, p1c, p2c, seriesWinner, mySlot, rematchRequested, winnerDisplayNameAction, lastSeries, segmentStartIndex = 0, onRematchAction, onQuitMatchAction }: {
  show: boolean; isMultiplayerGame: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  p1c: string; p2c: string; seriesWinner: string | null; mySlot: "P1" | "P2";
  rematchRequested: string | null;
  winnerDisplayNameAction?: (w: string | null) => string;
  lastSeries?: { winner: string | null; history: string[] } | null;
  segmentStartIndex?: number;
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
                    <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.1em" }}>{gameSeriesLabel(i + 1, lastSeries.history.length)}</div>
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

export function SurrenderModal({ show, t, ip, isRankedGame, variant = "forfeit", onConfirmAction, onCancelAction, playHoverAction }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean; isRankedGame: boolean;
  variant?: "forfeit" | "abort";
  onConfirmAction: () => void; onCancelAction: () => void; playHoverAction?: () => void;
}) {
  if (!show) return null;
  const isAbort = variant === "abort";
  const borderColor = isAbort ? t.border : t.danger;
  const titleColor = isAbort ? t.text : t.danger;
  const title = isAbort
    ? "Are you sure you want to abort this match?"
    : "Are you sure you want to forfeit this Match?";
  const body = isAbort ? (
    <>{"You haven't played a move yet in game 1. Leaving will "}<span style={{ color: t.text, fontWeight: 700 }}>void</span>{" this match — it won't appear in Career and won't affect ELO for either player."}</>
  ) : (
    isRankedGame ? <>This counts as a <span style={{ color: t.danger, fontWeight: 700 }}>forfeit</span> and will result in <span style={{ color: t.danger, fontWeight: 700 }}>ELO deduction</span>.</> : "Your opponent will be declared the winner."
  );
  return (
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div className="overlay-modal" style={{ background: t.bgPanel, border: `${ip ? 3 : 2}px solid ${borderColor}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: isAbort ? "0 40px 100px rgba(0,0,0,0.8)" : `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize: 44, marginBottom: 20 }} />
        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: titleColor, lineHeight: 1.5, marginBottom: 12 }}>{title}</div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>{body}</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <button className="action-btn" onClick={onConfirmAction} style={isAbort ? { background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" } : { background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700, padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }} onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = isAbort ? t.accent : t.danger; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 6px 28px ${isAbort ? t.accent : t.danger}55`; }} onMouseLeave={e => { e.currentTarget.style.background = isAbort ? `${t.accent}18` : `${t.danger}18`; e.currentTarget.style.color = isAbort ? t.accent : t.danger; e.currentTarget.style.boxShadow = "none"; }}>{isAbort ? "YES, ABORT" : "YES, FORFEIT"}</button>
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