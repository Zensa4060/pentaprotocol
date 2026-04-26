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
import { MYTHOS_ANALYSIS_LINES } from "@/lib/unrankedBots";

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

// ─── Unranked filler-bot ANALYSIS card ─────────────────────────────────────
//
// Lives in the otherwise-empty stretch between MATCH HISTORY and the ready
// / chat block. Stretches to fill the available vertical space (`flex: 1`)
// so the panel never carries a dead band below LIMITB. Two modes:
//
//   • MYTHOS  → "MYTHOS · LIVE CHAT" feed. The body auto-rotates short
//     taunts from `MYTHOS_TAUNTS` (`mythosAnalysisText` upstream is
//     wired to `mythosTauntForMove(...)`), giving the impression that
//     MYTHOS is actively trash-talking the player. PFP + violet aura
//     mirror the VS card.
//   • Any other unranked filler bot → "MYTHOS ANALYSING…" panel. Blood-
//     red theme so the analysis reads as a third-party tactical
//     observer rather than the opponent itself. The "GET ANALYSIS"
//     button is rate-limited: gated to one pull per `COOLDOWN_MOVES` so
//     a player can't spam-roll the quote pool — first unlock arrives at
//     move 7, then every 7 moves thereafter.
//
// State is intentionally per-instance: a new sidebar mount (between
// games / opponent change) starts blank, including the cooldown gate.
type UnrankedAnalysisCardTheme = {
  fontDisplay: string;
  fontMono: string;
  fontBody: string;
  accent: string;
  accentGlow: string;
  text: string;
  textMuted: string;
};
/** Number of placements between successive GET ANALYSIS unlocks. The
 *  first quote becomes available at `movesPlayed === COOLDOWN_MOVES`; each
 *  successive pull pushes the unlock another `COOLDOWN_MOVES` ahead. */
const COOLDOWN_MOVES = 7;
/** How many moves the most recently claimed analysis remains visible
 *  inside the card. While the analysis is "active" the rest of the card
 *  chrome (header + GET ANALYSIS button) is hidden so the long quote
 *  can take the full body without bleeding behind those labels. After
 *  this many placements the quote auto‑clears and the regular cooldown
 *  UI returns until `COOLDOWN_MOVES` is reached. */
const ACTIVE_MOVES = 5;

function UnrankedAnalysisCard({
  t,
  ip,
  isMythosBot,
  mythosAnalysisText,
  movesPlayed,
  gameNumber,
}: {
  t: UnrankedAnalysisCardTheme;
  ip: boolean;
  isMythosBot: boolean;
  mythosAnalysisText: string | undefined;
  /** Total stones placed in the current game. Drives the GET ANALYSIS
   *  cooldown gate for non-MYTHOS bots (button unlocks every
   *  `COOLDOWN_MOVES` placements). Optional — falls back to 0. */
  movesPlayed?: number;
  /** Current game number in the series. Whenever the game advances we
   *  reset the manual quote and unlock state so each leg of the
   *  5×5 → 6×6 → 7×7 progression starts with a fresh cooldown. */
  gameNumber?: number;
}) {
  // Manual-mode quote (non-MYTHOS bots only). MYTHOS uses the upstream
  // auto-rotated string instead. Reset on bot-type changes / new game so
  // a quote pulled in a previous match never bleeds into a new opponent.
  const [manualQuote, setManualQuote] = React.useState<string | null>(null);
  /** Move count at which the user last claimed a quote. `null` means the
   *  user hasn't claimed any quote yet this game, so the FIRST unlock is
   *  scheduled for `movesPlayed === COOLDOWN_MOVES`. After a claim we
   *  store `movesPlayed` here and the next unlock arrives at
   *  `lastClaimedAt + COOLDOWN_MOVES`. */
  const [lastClaimedAt, setLastClaimedAt] = React.useState<number | null>(null);
  React.useEffect(() => {
    setManualQuote(null);
    setLastClaimedAt(null);
  }, [isMythosBot, gameNumber]);

  // Blood-red palette for the analysis card. Matches the user's
  // "MYTHOS ANALYSING…" framing — keeps the boss-tier MYTHOS purple
  // exclusive to actual MYTHOS encounters while still branding the
  // tactical-read panel as a MYTHOS product.
  const blood = "#DC2626";
  const purple = "#C084FC";
  const accentRing = isMythosBot ? purple : blood;
  const headerLabel = isMythosBot ? "MYTHOS · LIVE CHAT" : "MYTHOS ANALYSING…";
  const subheading = isMythosBot ? "TRANSMISSION" : "POSITIONAL READ";
  const bodyText = isMythosBot
    ? (mythosAnalysisText ?? "")
    : (manualQuote ?? "");
  const showQuote = bodyText.trim().length > 0;

  // Cooldown gate (non-MYTHOS only). MYTHOS auto-rotates so the gate is
  // bypassed entirely. We compute the next unlock target relative to
  // `lastClaimedAt`: null → first unlock at COOLDOWN_MOVES; otherwise
  // lastClaimedAt + COOLDOWN_MOVES. The visible "ANALYSIS UNLOCKS IN N
  // MOVES" countdown is (target − movesPlayed) clamped to ≥ 0.
  const moves = Math.max(0, movesPlayed ?? 0);
  const nextUnlockAt =
    lastClaimedAt === null ? COOLDOWN_MOVES : lastClaimedAt + COOLDOWN_MOVES;
  const movesUntilUnlock = Math.max(0, nextUnlockAt - moves);
  const canClaim = !isMythosBot && movesUntilUnlock === 0;

  // "Analysis active" window: we keep the most recently claimed quote
  // visible for exactly `ACTIVE_MOVES` placements after the click.
  // While the window is open the card swaps to a takeover layout
  // (header + GET ANALYSIS button hidden) so the long quote can own
  // the body without rendering behind the standard chrome.
  const movesSinceClaim =
    lastClaimedAt === null ? null : Math.max(0, moves - lastClaimedAt);
  const analysisActive =
    !isMythosBot &&
    manualQuote !== null &&
    movesSinceClaim !== null &&
    movesSinceClaim < ACTIVE_MOVES;
  const movesLeftActive = analysisActive
    ? Math.max(0, ACTIVE_MOVES - (movesSinceClaim ?? 0))
    : 0;

  // Auto-expire the analysis once `ACTIVE_MOVES` placements have
  // elapsed since the click. We deliberately leave `lastClaimedAt`
  // populated so the cooldown countdown in `movesUntilUnlock` keeps
  // ticking against `lastClaimedAt + COOLDOWN_MOVES` — only the
  // visible body resets here.
  React.useEffect(() => {
    if (isMythosBot) return;
    if (manualQuote === null || lastClaimedAt === null) return;
    if (moves - lastClaimedAt >= ACTIVE_MOVES) {
      setManualQuote(null);
    }
  }, [moves, isMythosBot, manualQuote, lastClaimedAt]);

  const handleGetAnalysis = () => {
    if (isMythosBot) return;
    if (!canClaim) return;
    if (MYTHOS_ANALYSIS_LINES.length === 0) return;
    let next = manualQuote;
    // Roll until we get a different line — keeps the button feeling
    // responsive even on a small pool. Bail after a few attempts so
    // a degenerate pool (1 entry) still resolves.
    for (let i = 0; i < 6; i += 1) {
      const candidate =
        MYTHOS_ANALYSIS_LINES[
          Math.floor(Math.random() * MYTHOS_ANALYSIS_LINES.length)
        ];
      if (candidate !== manualQuote) {
        next = candidate;
        break;
      }
      next = candidate;
    }
    setManualQuote(next);
    setLastClaimedAt(moves);
  };

  // Body-text color tokens for the two themes — kept here so the JSX
  // below stays readable.
  const cardBorder = isMythosBot
    ? "rgba(147,51,234,0.55)"
    : "rgba(220,38,38,0.55)";
  const cardBg = isMythosBot
    ? "radial-gradient(ellipse at 15% 15%, rgba(147,51,234,0.22) 0%, rgba(6,3,14,0.82) 72%)"
    : "radial-gradient(ellipse at 15% 15%, rgba(127,29,29,0.32) 0%, rgba(8,2,2,0.92) 72%)";
  const cardShadow = isMythosBot
    ? "0 0 24px rgba(147,51,234,0.18), inset 0 0 18px rgba(147,51,234,0.08)"
    : "0 0 18px rgba(220,38,38,0.16), inset 0 0 16px rgba(220,38,38,0.08)";
  const quoteBorder = isMythosBot
    ? "rgba(147,51,234,0.55)"
    : "rgba(220,38,38,0.55)";
  const quoteText = isMythosBot ? "#E9D5FFDD" : "#FECACA";
  const subheadingColor = isMythosBot ? "#E9D5FF" : "#FEE2E2";
  const headerLabelColor = isMythosBot
    ? "rgba(192,132,252,0.85)"
    : "rgba(220,38,38,0.95)";
  const buttonBgIdle = `rgba(220,38,38,${canClaim ? 0.14 : 0.06})`;
  const buttonBgHover = "rgba(220,38,38,0.24)";

  let buttonLabel: string;
  if (canClaim) {
    // `lastClaimedAt` (not `manualQuote`) is the durable signal for
    // "user has claimed before in this game" — the manual quote is
    // auto-cleared after `ACTIVE_MOVES` placements but the cooldown
    // anchor remains, so this preserves "GET ANOTHER" wording across
    // the brief gap between the active window expiring and the next
    // unlock arriving.
    buttonLabel =
      lastClaimedAt !== null ? "GET ANOTHER ANALYSIS" : "GET ANALYSIS";
  } else {
    const word = movesUntilUnlock === 1 ? "MOVE" : "MOVES";
    buttonLabel = `ANALYSING · UNLOCKS IN ${movesUntilUnlock} ${word}`;
  }

  return (
    <div
      style={{
        // Fill the empty vertical band between MATCH HISTORY and the
        // ready / chat / pattern block. `flex: 1` makes the card grow
        // with the panel; `minHeight: 0` keeps the body's flex column
        // happy when the panel is short. Padding tightened ~5% and
        // PFP/gap shrunk so the header row no longer touches the right
        // edge in narrow sidebars; text scale below is bumped ~10% to
        // compensate so the card still reads as a substantial panel.
        flex: 1,
        minHeight: 0,
        marginTop: 12,
        padding: "14px 14px 16px",
        borderRadius: ip ? 2 : 14,
        border: `1px solid ${cardBorder}`,
        background: cardBg,
        boxShadow: cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isMythosBot && (
        <>
          {/* Outer dark-purple wash so the MYTHOS card reads as a
              "presence" panel rather than a passive sidebar tile. The
              radial sits behind everything and pulses very slowly via
              `mythosPfpAura`, mirroring the aura on the MatchPlayerCard
              avatar over on the VS screen. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 90% 110%, rgba(192,132,252,0.22) 0%, rgba(0,0,0,0) 55%), radial-gradient(circle at 0% 0%, rgba(76,29,149,0.32) 0%, rgba(0,0,0,0) 60%)",
            }}
          />
          <style>{`@keyframes mythosPfpAura{0%,100%{box-shadow:0 0 16px rgba(192,132,252,0.55),0 0 32px rgba(76,29,149,0.45),inset 0 0 8px rgba(76,29,149,0.45)}50%{box-shadow:0 0 26px rgba(192,132,252,0.78),0 0 52px rgba(76,29,149,0.6),inset 0 0 10px rgba(76,29,149,0.55)}}`}</style>
        </>
      )}
      {!isMythosBot && (
        <>
          {/* Faint blood-red wash + scanline shimmer. Painted behind the
              content so the card reads as an active analytic surface
              even when the body is empty (cooldown). Pulse cadence is
              gentle so it doesn't compete with the playing field. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 90% 110%, rgba(220,38,38,0.18) 0%, rgba(0,0,0,0) 55%), radial-gradient(circle at 0% 0%, rgba(127,29,29,0.30) 0%, rgba(0,0,0,0) 60%)",
            }}
          />
          <style>{`@keyframes mythosAnalysingPulse{0%,100%{opacity:0.7}50%{opacity:1}}`}</style>
        </>
      )}
      {/* Standard header (PFP + label). For MYTHOS this always shows.
          For non-MYTHOS bots we hide it during the active analysis
          window so the long quote can own the card without bleeding
          behind the header text. */}
      {(isMythosBot || !analysisActive) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            // Header gap tightened (10 → 8) and PFP shrunk (52 → 46)
            // below so "TRANSMISSION" / "POSITIONAL READ" no longer
            // crash into the right edge on narrow sidebars. The text
            // column gets `flex: 1, minWidth: 0` so it can wrap cleanly.
            gap: 8,
            position: "relative",
            flexShrink: 0,
          }}
        >
          {isMythosBot ? (
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(192,132,252,0.95)",
                flexShrink: 0,
                background: "#0B0514",
                animation: "mythosPfpAura 2.4s ease-in-out infinite",
              }}
            >
              <img
                src="/mythos-pfp.png"
                alt="MYTHOS"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: `1.5px solid ${accentRing}`,
                boxShadow: `0 0 14px ${accentRing}66`,
                flexShrink: 0,
                background: "#0A0202",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: t.fontDisplay,
                fontWeight: 900,
                color: accentRing,
                letterSpacing: "0.04em",
                fontSize: 18,
              }}
            >
              ?
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minWidth: 0,
              gap: 2,
            }}
          >
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 13,
                letterSpacing: "0.18em",
                color: headerLabelColor,
                fontWeight: 700,
                animation: !isMythosBot
                  ? "mythosAnalysingPulse 2.2s ease-in-out infinite"
                  : undefined,
              }}
            >
              {headerLabel}
            </div>
            <div
              style={{
                fontFamily: t.fontDisplay,
                // Sized down a hair (20 → 18) and letter-spacing
                // tightened (0.04em → 0.02em) so "TRANSMISSION"
                // (and "POSITIONAL READ") fit on a single line in
                // the narrow analyser card. `whiteSpace: nowrap`
                // is the actual hard guarantee — without it the
                // parent column's `minWidth: 0` would still let
                // the word break (we used to have
                // `wordBreak: break-word` on the column too, which
                // is why the screenshot showed "TRANSMISSIO\nN").
                fontSize: 18,
                fontWeight: 900,
                color: subheadingColor,
                letterSpacing: "0.02em",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subheading}
            </div>
          </div>
        </div>
      )}

      {/* Active-analysis pill. Replaces the standard header during the
          ACTIVE_MOVES window so the user always knows how long the
          current read will stay on screen. Slim red pill sits at the
          top of the card with a live countdown. */}
      {analysisActive && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 12px",
            borderRadius: ip ? 2 : 10,
            border: "1px solid rgba(220,38,38,0.55)",
            background:
              "linear-gradient(90deg, rgba(127,29,29,0.55) 0%, rgba(220,38,38,0.18) 60%, rgba(127,29,29,0.55) 100%)",
            boxShadow: "0 0 14px rgba(220,38,38,0.35), inset 0 0 10px rgba(220,38,38,0.18)",
            position: "relative",
            flexShrink: 0,
            animation: "mythosAnalysingPulse 2.2s ease-in-out infinite",
          }}
        >
          <span
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              letterSpacing: "0.18em",
              fontWeight: 800,
              color: "#FECACA",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#EF4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.85)",
                animation: "mythosAnalysingPulse 1s ease-in-out infinite",
              }}
            />
            MYTHOS · ANALYSIS ACTIVE
          </span>
          <span
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              letterSpacing: "0.14em",
              fontWeight: 800,
              color: "#FECACA",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#FCA5A5", fontSize: 15 }}>{movesLeftActive}</span>
            {" "}{movesLeftActive === 1 ? "MOVE" : "MOVES"} LEFT
          </span>
        </div>
      )}

      {/* Body region — grows to fill available vertical space so the
          quote sits comfortably even on tall sidebars. Vertically
          centered when there's a quote; left-aligned hint text otherwise.
          `overflow: hidden` is a defensive guard so a long quote never
          renders behind the header / button — those are already hidden
          during the active window, but the clip prevents any visual
          spill on small viewports too. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: showQuote ? "center" : "flex-start",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {showQuote ? (
          <div
            style={{
              position: "relative",
              fontFamily: t.fontBody,
              fontStyle: "italic",
              fontSize: 20,
              lineHeight: 1.55,
              color: quoteText,
              letterSpacing: "0.005em",
              paddingLeft: 16,
              borderLeft: `3px solid ${quoteBorder}`,
              fontWeight: 500,
              textShadow: isMythosBot
                ? "0 0 14px rgba(192,132,252,0.35)"
                : "0 0 14px rgba(220,38,38,0.30)",
            }}
          >
            {bodyText}
          </div>
        ) : !isMythosBot ? (
          <div
            style={{
              fontFamily: t.fontBody,
              fontSize: 16.5,
              lineHeight: 1.55,
              color: "rgba(254,202,202,0.7)",
              letterSpacing: "0.01em",
              paddingLeft: 14,
              borderLeft: "2px dashed rgba(220,38,38,0.5)",
              fontStyle: "italic",
            }}
          >
            {canClaim ? (
              <>Press <strong style={{ color: "#FCA5A5" }}>GET ANALYSIS</strong> for a tactical read on the current position.</>
            ) : (
              <>The analyser is observing the board. Next read unlocks in <strong style={{ color: "#FCA5A5", fontSize: 19 }}>{movesUntilUnlock}</strong> {movesUntilUnlock === 1 ? "move" : "moves"}.</>
            )}
          </div>
        ) : null}
      </div>

      {/* GET ANALYSIS button (non-MYTHOS only). Hidden while an
          analysis is currently active so the takeover layout stays
          clean — re‑appears as soon as the active window expires
          (`ACTIVE_MOVES` placements after the previous click). */}
      {!isMythosBot && !analysisActive && (
        <button
          type="button"
          onClick={handleGetAnalysis}
          disabled={!canClaim}
          aria-disabled={!canClaim}
          style={{
            flexShrink: 0,
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: ip ? 2 : 10,
            border: `1px solid ${canClaim ? `${accentRing}AA` : `${accentRing}55`}`,
            background: buttonBgIdle,
            color: canClaim ? "#FEE2E2" : "rgba(254,202,202,0.65)",
            fontFamily: t.fontMono,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.14em",
            cursor: canClaim ? "pointer" : "not-allowed",
            opacity: canClaim ? 1 : 0.85,
            transition: "background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease",
          }}
          onMouseEnter={(e) => {
            if (!canClaim) return;
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.borderColor = accentRing;
            e.currentTarget.style.boxShadow = `0 0 14px ${accentRing}66`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBgIdle;
            e.currentTarget.style.borderColor = canClaim ? `${accentRing}AA` : `${accentRing}55`;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
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
  /** When false, the sidebar renders the full 10-slot series track even
   *  in AI mode (used by unranked-queue filler bots so the 5×5 → 6×6 →
   *  7×7 progression is visible). Defaults to the legacy behaviour
   *  (AI/singleplayer = short BO3). */
  isShortSeries?: boolean;
  /** When true, the sidebar renders the MYTHOS analysis card (devil-cat
   *  avatar + rotating in-character commentary) between the match history
   *  and the SHOW PATTERNS button. Used only for the MYTHOS filler bot. */
  isMythosBot?: boolean;
  /** Current analysis line to render inside the MYTHOS card — computed
   *  upstream from `movesPlayed` via `mythosAnalysisForMove(...)`. */
  mythosAnalysisText?: string;
  /** When true, render the bottom-of-sidebar ANALYSIS panel even for
   *  non-MYTHOS unranked filler bots. The panel shows a "GET ANALYSIS"
   *  button that pulls a random quote from `MYTHOS_ANALYSIS_LINES`,
   *  giving every filler-bot match an in-character read on the position
   *  without forcing the auto-rotate cadence MYTHOS gets. Distinct from
   *  `isMythosBot` because the visual treatment differs (cyan accent
   *  + manual refresh, vs MYTHOS's purple aura + auto-rotate). */
  isUnrankedFillerBot?: boolean;
  isRankedGame: boolean;
  isMultiplayerGame: boolean;
  /** When true, render the sidebar's ready widget in MP-style "2-up"
   *  mode (P1 + P2 both visible, P2 auto-shows READY for bots) and
   *  hide the singleplayer-only SHOW PATTERNS button. Used exclusively
   *  for unranked filler-bot matches so the in-match UI mirrors a real
   *  multiplayer game: opponent's banner in the header, two ready rows,
   *  and no local-only affordances like the pattern overlay toggle. */
  treatAsMultiplayer?: boolean;
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
  /** Multiplayer only: send a friend request to the opponent currently in this match. */
  onAddFriendPeerAction?: () => void;
  /** Multiplayer only: report the opponent for abusive chat or disrespectful behaviour. */
  onReportPeerAction?: (reason: string, category: string) => void;
  /** Multiplayer only: UI state for the "add friend" button (pending / sent / already friends). */
  friendPeerStatus?: "idle" | "pending" | "sent" | "friends";
  /** Multiplayer only: head-to-head record vs the current opponent.
   *  `wins`/`losses`/`draws` are from the requesting user's POV;
   *  `recent` is at most 5 entries, latest-first. Renders a HISTORY
   *  card between MATCH HISTORY and the CHAT row. */
  headToHead?: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
    recent: ("win" | "loss" | "draw")[];
  } | null;
}

// ─── Separate named exports so GameScreen can render panels individually ──────


export function LeftPanel(props: MatchSidebarProps) {
  // SURRENDER / RESET controls and `movesPlayed` were intentionally removed
  // from this panel — they now live in RightPanel so the chat area can
  // expand freely and the close toggle stays unobstructed on the left.
  const { t, ip, p1c, p2c, pieceSkin, p1RttMs, p2RttMs, panelW, phase, current, gameNumber, movesPlayed, matchHistory, seriesWinner,
    gameMode, isShortSeries, isMythosBot, mythosAnalysisText, isUnrankedFillerBot = false, isRankedGame, isMultiplayerGame, treatAsMultiplayer = false, isMultiplayer, mySlot, boardMode, selectedPatterns, rbBannedPatterns = [], patternsAsSecret = false, p1SeriesPts, p2SeriesPts,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning, unreadOpponentChat = 0,
    p1Label, p2Label, p1Banner, p2Banner, winnerDisplayNameAction, lastSeries, segmentStartIndex = 0, historyDisplayStartIndex = 0,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    fmtTimeAction, playHoverAction,
    interGameReadyVisible, waitingReadyWarmup,
    showPatternOverlay, onTogglePatternOverlay,
    onAddFriendPeerAction, onReportPeerAction, friendPeerStatus = "idle",
    headToHead = null } = props;

  const opponentSlot: "P1" | "P2" = mySlot === "P1" ? "P2" : "P1";
  const socialEligible = Boolean(
    (isMultiplayer || isMultiplayerGame) &&
    onAddFriendPeerAction !== undefined &&
    onReportPeerAction !== undefined,
  );
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState("");
  const [reportCategory, setReportCategory] = React.useState<"abuse" | "harassment" | "cheating" | "other">("abuse");
  const [reportBusy, setReportBusy] = React.useState(false);
  const [reportSent, setReportSent] = React.useState(false);

  const closeReport = () => {
    setReportOpen(false);
    setReportBusy(false);
    setReportReason("");
    setReportCategory("abuse");
  };
  const submitReport = () => {
    const trimmed = reportReason.trim();
    if (trimmed.length < 4) return;
    setReportBusy(true);
    try {
      onReportPeerAction?.(trimmed, reportCategory);
    } finally {
      setReportBusy(false);
      setReportSent(true);
      setTimeout(() => setReportSent(false), 3500);
      closeReport();
    }
  };

  const accountId = useAuthStore((s) => (s.user as any)?.id ?? (s.user as any)?._id ?? null);
  const bannerShineEnabled = useBannerShineEnabled(accountId);

  const getName = (w: string | null) => winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? "");
  const showInterGameReady = interGameReadyVisible ?? (phase === "waiting_ready");
  const showWaitingReadyWarmup = Boolean(waitingReadyWarmup);
  const absoluteCurrentGame = historyDisplayStartIndex + gameNumber;
  // Default to the legacy behaviour (AI/solo = 3-slot short series) unless
  // the parent explicitly overrides `isShortSeries` (unranked filler bots
  // run a full 10-slot 5×5 → 6×6 → 7×7 series).
  const shortSeries =
    isShortSeries ?? (gameMode === "ai" || gameMode === "singleplayer");
  const historySlots = shortSeries ? 3 : 10;
  const localBo3 = shortSeries;
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
  // Density tuning: balanced so the panel fills the viewport without
  // scroll while the section labels and history rows stay readable.
  // Earlier iterations went too tight (font 14 / padding 3px on
  // rows, headings at 15px) which left a large dead band between
  // LIMITB and the H2H card on tall viewports. The values below
  // sit at the comfortable middle: big enough to read at a glance,
  // small enough that the CHAT row never gets pushed off-screen.
  const densityGap = isVeryShort ? 6 : isShorter ? 9 : 12;
  const headingSize = isVeryShort ? 14 : isShorter ? 16 : 17;

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
        // MYTHOS encounter? In every unranked-filler-bot path the bot
        // sits in P2, so we paint the flame ring exclusively on the P2
        // timer card. Keeps the player's own slot clean and lets the
        // boss-tier presence read on the opponent side.
        const isMythosTimer = !!isMythosBot && p === "P2";
        return (
        <div
          key={p}
          style={{
            // Outer wrapper exists for both slots so the panel's flex gap
            // stays symmetric. Only the MYTHOS slot paints the flame
            // halo + tongues — they live OUTSIDE the timer card's
            // overflow:hidden so the flame can lick past the card edge.
            position: "relative",
            // Allow flames to extend slightly past the card without
            // forcing the panel to scroll. The panel's vertical `gap`
            // (densityGap) provides ample buffer for the ~10 px halo.
            isolation: "isolate",
          }}
        >
          {isMythosTimer && (
            <>
              {/* Outer pulsing violet aura. Sits behind the card and
                  pulses softly so the slot reads as actively "burning"
                  even when the bot isn't currently moving. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: ip ? 6 : 14,
                  pointerEvents: "none",
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(192,132,252,0.55) 0%, rgba(0,0,0,0) 60%), radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.45) 0%, rgba(0,0,0,0) 60%), radial-gradient(ellipse at 0% 50%, rgba(168,85,247,0.35) 0%, rgba(0,0,0,0) 55%), radial-gradient(ellipse at 100% 50%, rgba(168,85,247,0.35) 0%, rgba(0,0,0,0) 55%)",
                  filter: "blur(8px)",
                  animation: "mythosTimerHalo 1.6s ease-in-out infinite",
                  zIndex: 0,
                }}
              />
              {/* Top flame tongues — three offset radial gradients that
                  stretch / squash on alternate frames to mimic the
                  flicker of real flames. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: -6,
                  right: -6,
                  top: -14,
                  height: 16,
                  pointerEvents: "none",
                  zIndex: 3,
                  background:
                    "radial-gradient(ellipse 22px 16px at 18% 100%, rgba(217,70,239,0.85) 0%, rgba(217,70,239,0) 65%), radial-gradient(ellipse 28px 22px at 50% 100%, rgba(192,132,252,0.95) 0%, rgba(192,132,252,0) 65%), radial-gradient(ellipse 22px 16px at 82% 100%, rgba(168,85,247,0.85) 0%, rgba(168,85,247,0) 65%)",
                  filter: "blur(2px)",
                  animation: "mythosTimerFlame 0.55s ease-in-out infinite alternate",
                  transformOrigin: "50% 100%",
                }}
              />
              {/* Bottom flame tongues (mirrored) so the card looks
                  engulfed rather than just crowned. Slightly slower
                  cadence so the two strips don't visually lock-step. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: -6,
                  right: -6,
                  bottom: -14,
                  height: 16,
                  pointerEvents: "none",
                  zIndex: 3,
                  background:
                    "radial-gradient(ellipse 22px 16px at 18% 0%, rgba(168,85,247,0.85) 0%, rgba(168,85,247,0) 65%), radial-gradient(ellipse 28px 22px at 50% 0%, rgba(192,132,252,0.95) 0%, rgba(192,132,252,0) 65%), radial-gradient(ellipse 22px 16px at 82% 0%, rgba(217,70,239,0.85) 0%, rgba(217,70,239,0) 65%)",
                  filter: "blur(2px)",
                  animation: "mythosTimerFlame 0.7s ease-in-out infinite alternate",
                  transformOrigin: "50% 0%",
                }}
              />
              <style>{`
                @keyframes mythosTimerHalo {
                  0%,100% { opacity: 0.72; transform: scale(1); }
                  50%     { opacity: 1;    transform: scale(1.05); }
                }
                @keyframes mythosTimerFlame {
                  0%   { transform: translateY(2px) scaleY(0.85) scaleX(0.95); opacity: 0.65; }
                  35%  { transform: translateY(-1px) scaleY(1.15) scaleX(1.05); opacity: 0.95; }
                  70%  { transform: translateY(-3px) scaleY(1.3)  scaleX(0.9);  opacity: 1; }
                  100% { transform: translateY(-1px) scaleY(1.05) scaleX(1.05); opacity: 0.85; }
                }
              `}</style>
            </>
          )}
          <div style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: ip ? 2 : 8,
            border: `1px solid ${isCurrentMover ? (p === "P1" ? p1c : p2c) : (isMythosTimer ? "#C084FC" : t.border)}`,
            boxShadow: isMythosTimer
              ? "0 0 14px rgba(192,132,252,0.55), inset 0 0 12px rgba(76,29,149,0.45)"
              : undefined,
            transition: "border-color 0.25s",
            background: t.bgCard,
            zIndex: 1,
          }}>
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
              {isMythosTimer && (
                /* Inner violet wash so the banner's underlying art reads
                   as MYTHOS-tinted rather than its base banner colour.
                   Sits above the dark gradient but below the content. */
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.32) 0%, rgba(0,0,0,0) 70%)",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            <div style={{ position: "relative", zIndex: 2, padding: isShorter ? "7px 11px" : "10px 13px", background: isCurrentMover ? `${p === "P1" ? p1c : p2c}33` : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.25s" }}>
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
        </div>
      )})}

      {socialEligible && (
        <div
          style={{
            marginTop: -4,
            padding: "8px 10px",
            background: `${t.accent}08`,
            border: `1px dashed ${t.border}`,
            borderRadius: ip ? 2 : 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 10,
              color: t.textMuted,
              letterSpacing: "0.16em",
            }}
          >
            OPPONENT · {sidebarDisplayName(opponentSlot === "P1" ? p1Label : p2Label)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {/* Hide the Add Friend button entirely once we know the
              * opponent is already a friend — keeping a disabled
              * "FRIENDS" pill alongside REPORT is noise (you can't
              * un-friend from in-match anyway). For not-yet-friends
              * the button still renders so the user can issue a
              * request without leaving the match. */}
            {friendPeerStatus !== "friends" && (
              <button
                disabled={friendPeerStatus === "sent" || friendPeerStatus === "pending"}
                onMouseEnter={playHoverAction}
                onClick={() => onAddFriendPeerAction?.()}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  background:
                    friendPeerStatus === "sent"
                      ? `${t.accent}14`
                      : "transparent",
                  border: `1px solid ${t.border}AA`,
                  borderRadius: ip ? 2 : 6,
                  color: t.textSecondary,
                  fontFamily: t.fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor:
                    friendPeerStatus === "sent" || friendPeerStatus === "pending"
                      ? "default"
                      : "pointer",
                }}
              >
                {friendPeerStatus === "sent"
                  ? "REQUEST SENT"
                  : friendPeerStatus === "pending"
                  ? "SENDING…"
                  : "ADD FRIEND"}
              </button>
            )}
            <button
              onMouseEnter={playHoverAction}
              onClick={() => { setReportOpen(true); setReportSent(false); }}
              style={{
                flex: 1,
                padding: "7px 8px",
                background: "transparent",
                border: `1px solid ${t.danger}88`,
                borderRadius: ip ? 2 : 6,
                color: t.danger,
                fontFamily: t.fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              {reportSent ? "REPORTED" : "REPORT"}
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 400,
          }}
          onClick={closeReport}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(440px, 92vw)",
              background: t.bgPanel,
              border: `1px solid ${t.danger}`,
              borderRadius: ip ? 2 : 12,
              padding: "18px 20px",
              boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: 16,
                fontWeight: 900,
                color: t.danger,
                letterSpacing: "0.12em",
                marginBottom: 4,
              }}
            >
              REPORT PLAYER
            </div>
            <div
              style={{
                fontFamily: t.fontBody,
                fontSize: 12,
                color: t.textSecondary,
                marginBottom: 14,
              }}
            >
              Reports go straight to PentaProtocol staff. False reports may get your own account actioned — please only file one if the behaviour is genuinely abusive or rule-breaking.
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["abuse", "harassment", "cheating", "other"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setReportCategory(c)}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    background: reportCategory === c ? `${t.danger}22` : "transparent",
                    border: `1px solid ${reportCategory === c ? t.danger : t.border}AA`,
                    borderRadius: ip ? 2 : 6,
                    color: reportCategory === c ? t.danger : t.textMuted,
                    fontFamily: t.fontMono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value.slice(0, 400))}
              placeholder="Briefly describe what happened (4–400 chars)"
              autoFocus
              rows={4}
              style={{
                width: "100%",
                padding: "10px",
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                borderRadius: ip ? 2 : 6,
                color: t.text,
                fontFamily: t.fontBody,
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={closeReport}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  border: `1px solid ${t.border}`,
                  borderRadius: ip ? 2 : 6,
                  color: t.textMuted,
                  fontFamily: t.fontDisplay,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={submitReport}
                disabled={reportReason.trim().length < 4 || reportBusy}
                style={{
                  padding: "8px 14px",
                  background: reportReason.trim().length < 4 ? `${t.danger}33` : t.danger,
                  border: `1px solid ${t.danger}`,
                  borderRadius: ip ? 2 : 6,
                  color: "#fff",
                  fontFamily: t.fontDisplay,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: reportReason.trim().length < 4 || reportBusy ? "default" : "pointer",
                  letterSpacing: "0.08em",
                }}
              >
                {reportBusy ? "SUBMITTING…" : "SUBMIT REPORT"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: isShorter ? 8 : 10 }}>
        <div style={{ fontFamily: t.fontMono, fontSize: headingSize - 1, fontWeight: 700, color: t.text, letterSpacing: "0.14em", marginBottom: isShorter ? 6 : 8 }}>MATCH HISTORY</div>

        {/* SERIES POINTS / SERIES cards sized for readable scoreboard
          * presence (16 px score) without dominating the column. */}
        {(isMultiplayerGame || isMultiplayer) && typeof p1SeriesPts === "number" && typeof p2SeriesPts === "number" && (
          <div style={{ marginBottom: 10, padding: "8px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 9 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 5 }}>SERIES POINTS · FIRST TO 3</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{formatSeriesPts(p1SeriesPts)}</span></span>
              <span style={{ color: t.textMuted, fontSize: 13 }}>—</span>
              <span style={{ color: p2c }}>{p2Label ?? "P2"} <span style={{ color: t.text }}>{formatSeriesPts(p2SeriesPts)}</span></span>
            </div>
          </div>
        )}

        {localBo3 && localWins && (
          <div style={{ marginBottom: 10, padding: "8px 12px", background: `${t.accent}0C`, border: `1px solid ${t.accent}33`, borderRadius: ip ? 2 : 9 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 5 }}>SERIES · FIRST TO 2</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800 }}>
              <span style={{ color: p1c }}>{p1Label ?? "P1"} <span style={{ color: t.text }}>{localWins.p1}</span></span>
              <span style={{ color: t.textMuted, fontSize: 13 }}>—</span>
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
                {/* Slot row sized for readability without forcing the
                  * panel to scroll. Original 22 px + 6 px padding
                  * blew past the viewport once the H2H card was
                  * added; the previous "compact" 14 px + 3 px went
                  * too far the other way and left a dead band. The
                  * current baseline is 17 px + 5 px, then we apply a
                  * small +2% text bump (17 -> 17.34) per request
                  * without changing row padding / layout footprint. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontFamily: t.fontBody, fontSize: 17.34, padding: "5px 0", borderBottom: `1px solid ${t.border}22`, opacity: 1 }}>
                  <span style={{ color: isCur ? t.accent : t.textMuted, transition: "color 0.2s" }}>{gameSeriesLabel(absoluteGame, historySlots)}{isCur ? " *" : ""}</span>
                  <span style={{ color: col, fontWeight: result ? 700 : 400, transition: "color 0.2s" }}>{result || "—"}</span>
                </div>
              </React.Fragment>
            );
          })}
          {/* Gap-filler CTA between LIMITB rows and the bottom HISTORY/H2H
              block. User-requested visual only (non-interactive) so the
              empty band does not look dead on taller viewports. */}
          {isMultiplayerGame && (
            <div
              style={{
                marginTop: "auto",
                marginBottom: "auto",
                minHeight: 78,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                disabled
                aria-label="MYTHOS Analysis Coming soon"
                style={{
                  width: "100%",
                  minHeight: 55,
                  padding: "13px 16px",
                  borderRadius: ip ? 4 : 12,
                  border: "1px solid rgba(196, 106, 255, 0.62)",
                  background:
                    "linear-gradient(135deg, rgba(46,10,68,0.88) 0%, rgba(76,14,102,0.9) 45%, rgba(112,18,72,0.9) 75%, rgba(145,24,24,0.88) 100%)",
                  color: "#F5D8FF",
                  fontFamily: t.fontMono,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "none",
                  boxShadow:
                    "0 0 0 1px rgba(255,115,225,0.22) inset, 0 0 14px rgba(167,59,255,0.35), 0 0 20px rgba(176,22,53,0.22)",
                  textShadow: "0 0 10px rgba(245,150,255,0.45)",
                  opacity: 0.95,
                  cursor: "default",
                }}
              >
                MYTHOS Analysis Coming soon
              </button>
            </div>
          )}
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

      {/* ANALYSIS card. Fills the otherwise-empty gap between MATCH
          HISTORY and the ready / patterns block on unranked filler-bot
          matches. Two visually-distinct modes — both anchored to the
          same slot so the layout stays consistent regardless of who
          the opponent is:
            • MYTHOS: auto-rotating commentary driven by
              `mythosAnalysisForMove` upstream. PFP + violet glow
              brand it as the boss-tier observer.
            • Other unranked filler bots: a "GET ANALYSIS" button the
              user clicks to pull a random in-character read from the
              same quote pool. Cyan accent so it doesn't impersonate
              the MYTHOS treatment.
          Non-filler / multiplayer / ranked games skip the entire
          block — `shouldRenderAnalysis` is the single gate. */}
      {(() => {
        // Only the MYTHOS encounter renders the analysis card now —
        // it is the live-chat / taunt feed that brands the boss
        // fight. Every other unranked filler bot used to show a
        // "MYTHOS ANALYSING…" panel with a GET ANALYSIS button, but
        // exposing a "MYTHOS analysing your moves" card while you
        // are NOT playing MYTHOS leaks the bot fiction (the queue
        // is supposed to feel like ordinary unranked matchmaking).
        // Keeping the gate isMythosBot-only means: MYTHOS games
        // get the live-chat card; every other unranked bot sidebar
        // looks identical to a real human match.
        const shouldRenderAnalysis = !!isMythosBot && !isMultiplayerGame;
        if (!shouldRenderAnalysis) return null;
        return (
          <UnrankedAnalysisCard
            t={t}
            ip={ip}
            isMythosBot={!!isMythosBot}
            mythosAnalysisText={mythosAnalysisText}
            movesPlayed={movesPlayed}
            gameNumber={gameNumber}
          />
        );
      })()}


      {showWaitingReadyWarmup && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 600, color: t.textMuted, letterSpacing: "0.06em", textAlign: "center" }}>Get ready…</div>
        </div>
      )}
      {showInterGameReady && !showWaitingReadyWarmup && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.accent, textAlign: "center" }}>{Math.ceil(readyTimeout)}s</div>
          {
            /* Three branches:
             *   - `treatAsMultiplayer` (unranked filler bot): two rows,
             *     P1 togglable, P2 always shows READY because the parent
             *     flips `p2Ready` on `waiting_ready` entry. We render the
             *     P2 button as visually-disabled so the user can't un-ready
             *     the bot.
             *   - `isMultiplayer` (real MP): unchanged — both rows are
             *     interactive only for the local slot.
             *   - Otherwise (classic AI / SP BO3): single "START GAME N+1"
             *     button that also mirrors readiness onto P2 via
             *     `onReadyToggle` in the parent. */
            treatAsMultiplayer ? (
              (["P1", "P2"] as const).map(p => {
                const rdy = p === "P1" ? p1Ready : p2Ready;
                const col = p === "P1" ? p1c : p2c;
                const isBotRow = p === "P2";
                const handleClick = isBotRow ? undefined : () => onReadyToggle(p);
                return (
                  <button key={p}
                    onClick={handleClick}
                    aria-disabled={isBotRow ? true : undefined}
                    style={{
                      background: rdy ? `${col}22` : "#AA000022",
                      border: `2px solid ${rdy ? col : "#AA0000"}`,
                      color: rdy ? col : "#EE0000",
                      fontFamily: t.fontMono,
                      fontSize: 15,
                      fontWeight: 700,
                      padding: "12px",
                      borderRadius: ip ? 2 : 6,
                      cursor: isBotRow ? "default" : "pointer",
                      transition: "all 0.2s",
                      boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none",
                      opacity: isBotRow ? 0.92 : 1,
                    }}
                    onMouseEnter={isBotRow ? undefined : e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                    onMouseLeave={isBotRow ? undefined : e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                  >{p === "P1" ? (p1Label ?? p) : (p2Label ?? p)} {rdy ? "READY" : "NOT READY"}</button>
                );
              })
            ) : gameMode === "ai" || gameMode === "singleplayer" ? (
              (() => {
                const rdy = p1Ready;
                const col = p1c;
                const label = shortSeries && matchHistory.length >= 2
                  ? "START GAME 3"
                  : `START GAME ${gameNumber + 1}`;
                return (
                  <button onClick={() => onReadyToggle("P1")}
                    className={!rdy ? "thump-anim" : ""}
                    style={{ background: rdy ? `${col}22` : "#AA000022", border: `2px solid ${rdy ? col : "#AA0000"}`, color: rdy ? col : "#EE0000", fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, padding: "12px", borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s", boxShadow: rdy ? `0 0 16px ${col}55, 0 0 4px ${col}33` : "none" }}
                    onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.boxShadow = rdy ? `0 0 24px ${col}88` : "0 0 16px #EE000055"; e.currentTarget.style.borderColor = rdy ? col : "#FF3333"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = rdy ? `0 0 16px ${col}55` : "none"; e.currentTarget.style.borderColor = rdy ? col : "#AA0000"; }}
                  >{label} {rdy ? "READY" : ""}</button>
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
            )
          }
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
          {/* Head-to-head record vs the current opponent. Always
            * rendered for multiplayer once we've fetched the H2H
            * payload — `total > 0` shows the rich card with last-5
            * outcomes + W/D/L breakdown; `total === 0` falls back
            * to a compact "FIRST MEETING" stub so the user can
            * tell at a glance that the section *exists* but has no
            * prior data yet. Without the stub, first-time matchups
            * showed a confusing dead band where the card should be. */}
          {headToHead && headToHead.total > 0 && (
            /* Head-to-head card: every dimension and font scaled up
             * uniformly by ~15% from the previous compact pass —
             * gap 8→9, paddingTop 10→12, header font 13→15, chip
             * height 24→28 / font 12→14, stat-card padding 5/6→6/7
             * with value font 16→18, label 9→10. Card retains its
             * proportions, just reads larger overall. */
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: "0.16em" }}>HISTORY</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 800, color: t.text, letterSpacing: "0.08em" }}>{headToHead.total} {headToHead.total === 1 ? "MATCH" : "MATCHES"}</div>
              </div>
              {/* Last 5 outcomes — newest on the left, blank slots fill
                * the row up to 5 so the strip width stays constant. */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const r = headToHead.recent[i];
                  const col = r === "win" ? p1c : r === "loss" ? p2c : r === "draw" ? t.gold : "transparent";
                  const lbl = r === "win" ? "W" : r === "loss" ? "L" : r === "draw" ? "D" : "·";
                  const filled = !!r;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 28,
                        borderRadius: ip ? 2 : 7,
                        background: filled ? `${col}22` : "transparent",
                        border: `1px solid ${filled ? `${col}AA` : `${t.border}88`}`,
                        color: filled ? col : t.textMuted,
                        fontFamily: t.fontMono,
                        fontSize: 14,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: filled ? `0 0 7px ${col}33` : "none",
                      }}
                    >
                      {lbl}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {([
                  { lbl: "WIN",  v: headToHead.wins,   c: p1c },
                  { lbl: "DRAW", v: headToHead.draws,  c: t.gold },
                  { lbl: "LOSE", v: headToHead.losses, c: p2c },
                ] as const).map(item => (
                  <div key={item.lbl} style={{
                    padding: "6px 7px",
                    background: `${item.c}10`,
                    border: `1px solid ${item.c}33`,
                    borderRadius: ip ? 2 : 7,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}>
                    <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.14em" }}>{item.lbl}</span>
                    <span style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: item.c, lineHeight: 1.1 }}>{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* First-meeting stub: shown when the H2H payload arrived
            * but reports zero prior matches between these two
            * players. Replaces the old behaviour of hiding the
            * section entirely, which left a confusing dead band
            * where the card should be. Sized to match the +15%
            * pass on the populated card so the section reads at
            * the same scale either way. */}
          {headToHead && headToHead.total === 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: "0.16em" }}>HISTORY</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em" }}>FIRST MEETING</div>
              </div>
              <div style={{
                padding: "9px 12px",
                background: `${t.accent}0A`,
                border: `1px dashed ${t.border}`,
                borderRadius: ip ? 2 : 7,
                fontFamily: t.fontMono,
                fontSize: 13,
                color: t.textMuted,
                letterSpacing: "0.08em",
                textAlign: "center",
                lineHeight: 1.4,
              }}>
                NO PRIOR MATCHES.<br />THIS GAME WILL BE LOGGED.
              </div>
            </div>
          )}

          {/* CHAT row — full-width clickable button so any tap on the
            * row opens / collapses the chat panel. The previous design
            * forced users to hit the small ▸ chevron, which was
            * uncomfortable on mobile. */}
          <button
            type="button"
            onClick={onChatOpenToggle}
            onMouseEnter={playHoverAction}
            style={{
              all: "unset",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "10px 4px 0",
              borderTop: `1px solid ${t.border}`,
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
            }}
            aria-expanded={chatOpen}
            aria-label={chatOpen ? "Close chat" : "Open chat"}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontFamily: t.fontMono, fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: "0.12em" }}>CHAT</span>
              {!chatOpen && unreadOpponentChat > 0 && (
                <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: t.accent, color: "#000", fontFamily: t.fontMono, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                  {unreadOpponentChat > 9 ? "9+" : unreadOpponentChat}
                </span>
              )}
            </span>
            <span style={{ color: t.text, fontFamily: t.fontMono, fontSize: 16, padding: "2px 6px", flexShrink: 0 }} aria-hidden="true">{chatOpen ? "▾" : "▸"}</span>
          </button>
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
            {/* Message body uses `userSelect: text` so the user can
              * drag-select any chat line and copy it via the standard
              * OS clipboard gesture. No explicit copy button — that
              * was rejected as visual noise; native selection is
              * sufficient for room codes and short lines alike. */}
            {chatMessages.map((m, i) => (<div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: m.from === "P1" ? p1c : p2c, flexShrink: 0 }}>{m.from === "P1" ? (p1Label ?? "P1") : (p2Label ?? "P2")}:</span><span className="pp-selectable" style={{ fontFamily: t.fontBody, fontSize: 14, color: t.text, wordBreak: "break-word" as const }}>{m.text}</span></div>))}
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
  onUndoAction, canUndo = false,
  onOpenSettingsAction,
}: {
  t: MatchSidebarProps["t"]; ip: boolean; p1c: string; p2c: string; panelW: number;
  phase: Phase; log: { text: string; player: string }[]; isRankedGame: boolean;
  setScreenAction?: (s: Screen) => void; onShowExitConfirmAction: () => void; playHoverAction?: () => void;
  isMultiplayer?: boolean; isMultiplayerGame?: boolean;
  gameNumber?: number; movesPlayed?: number;
  onShowSurrenderAction?: () => void; onSoftResetAction?: () => void;
  /** Training-mode undo: pops the most recent stone. Button hidden when absent. */
  onUndoAction?: () => void;
  canUndo?: boolean;
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {onUndoAction && (
          <button
            onClick={canUndo ? onUndoAction : undefined}
            disabled={!canUndo}
            onMouseEnter={e => {
              if (!canUndo) return;
              playHoverAction?.();
              e.currentTarget.style.background = `${t.accent}2a`;
            }}
            onMouseLeave={e => { e.currentTarget.style.background = canUndo ? `${t.accent}16` : `${t.border}14`; }}
            style={{
              background: canUndo ? `${t.accent}16` : `${t.border}14`,
              border: `1px solid ${canUndo ? t.accent : t.border}`,
              color: canUndo ? t.accent : t.textMuted,
              fontFamily: t.fontBody,
              fontSize: 13,
              padding: 9,
              borderRadius: ip ? 2 : 6,
              cursor: canUndo ? "pointer" : "default",
              opacity: canUndo ? 1 : 0.55,
              transition: "all 0.2s",
            }}
          >
            ↶ UNDO MOVE
          </button>
        )}
        <button
          onClick={onSoftResetAction}
          style={{ background: `${t.danger}16`, border: `1px solid ${t.danger}`, color: t.danger, fontFamily: t.fontBody, fontSize: 13, padding: 9, borderRadius: ip ? 2 : 6, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.background = `${t.danger}30`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}16`; }}
        >
          RESET
        </button>
      </div>
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
  onAnalyzeAction,
  interGameReadyVisible = true,
  waitingReadyWarmup = false,
  isMultiplayerGame = false,
  gameMode = "singleplayer",
  p1Ready = false,
  p2Ready = false,
  readyTimeoutSec = 30,
  onReadyToggleAction,
  p1DisplayName = "P1",
  p2DisplayName = "P2",
  accentColor = "#7CFF7C",
  p1c = "#7CFF7C",
  p2c = "#FFB84D",
  textSecondary = "rgba(255,255,255,0.55)",
  ip = false,
  mySlot,
  reviewGridNode,
  treatAsMultiplayer = false,
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
  onAnalyzeAction?: () => void;
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
  reviewGridNode?: React.ReactNode;
  /** Render the central "READY TO PLAY" overlay as if it were a
   *  multiplayer match (two ready cards with both display names),
   *  even though the underlying game is singleplayer / AI. Used by
   *  unranked-filler-bot sessions so the player isn't told they're
   *  facing a bot. The bot row is presented as already READY (parent
   *  flips `p2Ready` on `waiting_ready` entry) and is not clickable. */
  treatAsMultiplayer?: boolean;
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

  /* "Review grid" lets the user peek at the final board + win animation
     between games in training / bot modes, and also at the end of the
     full series (after "X WINS THE SERIES"). Tapping the button hides
     the whole overlay; a small floating pill lets them bring it back.
     Reset whenever both eligible panes go away so the next cycle starts
     with the overlay visible again. */
  const [isReviewingGrid, setIsReviewingGrid] = React.useState(false);
  const localSpOrAi = gameMode === "ai" || gameMode === "singleplayer";
  const canReviewGrid = (showReadyPane || showMatchOverPane) && localSpOrAi;
  const reviewingFromMatchOver = isReviewingGrid && showMatchOverPane;
  React.useEffect(() => {
    if (!canReviewGrid) setIsReviewingGrid(false);
  }, [canReviewGrid]);

  if (!showWinPane && !showReadyPane && !showMatchOverPane) return null;

  const getName = (w: string | null) => (winnerDisplayNameAction ? winnerDisplayNameAction(w) : (w ?? ""));
  const pulseAnim = "none";
  const glow = "none";
  const handleDismiss = () => {
    if (canDismiss) onDismissAction();
  };

  const frameColor = showWinPane && winner ? winnerColor : (showMatchOverPane && seriesWinner && seriesWinner !== "DRAW" ? (seriesWinner === "P1" ? p1c : p2c) : accentColor);

  /* Grid-review mode: the full-screen modal is swapped for the resolved
     board (win line + highlights) rendered full-screen, with a tiny floating
     pill to return to the ready pane. Countdown keeps ticking. */
  if (isReviewingGrid) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(5,5,10,0.96)",
          pointerEvents: "auto",
        }}
      >
        {reviewGridNode ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              padding: "48px 24px 110px",
              boxSizing: "border-box",
            }}
          >
            {reviewGridNode}
          </div>
        ) : null}
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: "rgba(10,10,15,0.92)",
            border: `1px solid ${accentColor}66`,
            borderRadius: 999,
            boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 20px ${accentColor}33`,
          }}
        >
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              letterSpacing: "0.14em",
              color: textSecondary,
              textTransform: "uppercase",
            }}
          >
            {reviewingFromMatchOver
              ? "Reviewing grid · series complete"
              : `Reviewing grid · ${Math.max(0, Math.ceil(readyTimeoutSec))}s`}
          </div>
          <button
            type="button"
            onClick={() => setIsReviewingGrid(false)}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid ${accentColor}`,
              background: `${accentColor}22`,
              color: accentColor,
              fontFamily: t.fontDisplay,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            {reviewingFromMatchOver ? "BACK TO RESULTS" : "BACK TO READY"}
          </button>
        </div>
      </div>
    );
  }

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
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                {/* Ready-card layout
                 *   • Real multiplayer  → two cards, only the local
                 *     player's slot is interactive (existing behaviour).
                 *   • Unranked filler bot (`treatAsMultiplayer`) → also
                 *     two cards. P1 is interactive and the P2/bot card
                 *     reads "<BOT> — READY" instantly (parent flips
                 *     `p2Ready` on `waiting_ready` entry). Visually
                 *     non-clickable so the player can't un-ready the
                 *     bot. This makes the inter-game ready pane look
                 *     identical to a real human unranked match.
                 *   • Plain singleplayer / AI (no `treatAsMultiplayer`)
                 *     → single P1 button, original UX preserved. */}
                {(localSpOrAi && !treatAsMultiplayer) ? (
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
                    // Filler-bot path: P1 is the only interactive
                    // slot. Real-MP path falls back to the original
                    // `mySlot` rule.
                    const isMine = treatAsMultiplayer
                      ? slot === "P1"
                      : (!mySlot || mySlot === slot);
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

                {canReviewGrid && (
                  <button
                    type="button"
                    onClick={() => setIsReviewingGrid(true)}
                    style={{
                      padding: "10px 22px",
                      borderRadius: ip ? 2 : 999,
                      border: `1px solid ${accentColor}66`,
                      background: "transparent",
                      color: accentColor,
                      fontFamily: t.fontMono,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${accentColor}15`;
                      e.currentTarget.style.borderColor = accentColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = `${accentColor}66`;
                    }}
                  >
                    Review Grid
                  </button>
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
              {onNewMatchAction && (
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
              )}
              {canReviewGrid && reviewGridNode && (
                <button
                  type="button"
                  onClick={() => setIsReviewingGrid(true)}
                  style={{
                    minWidth: "min(100%, 320px)",
                    padding: "14px 28px",
                    borderRadius: ip ? 2 : 14,
                    border: `1px solid ${accentColor}66`,
                    background: "transparent",
                    color: accentColor,
                    fontFamily: t.fontDisplay,
                    fontSize: "clamp(14px, 2.4vw, 18px)",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}15`; e.currentTarget.style.borderColor = accentColor; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${accentColor}66`; }}
                >
                  REVIEW GRID
                </button>
              )}
              {onAnalyzeAction && (
                <button
                  type="button"
                  onClick={() => {
                    // Close this modal layer first so the analyzer pane
                    // behind it is immediately visible to the user.
                    onDismissAction();
                    onAnalyzeAction();
                  }}
                  style={{
                    minWidth: "min(100%, 320px)",
                    padding: "14px 28px",
                    borderRadius: ip ? 2 : 14,
                    border: `1px solid ${accentColor}AA`,
                    background: `${accentColor}18`,
                    color: accentColor,
                    fontFamily: t.fontDisplay,
                    fontSize: "clamp(14px, 2.4vw, 18px)",
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: `0 8px 28px ${accentColor}33`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}2E`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accentColor}18`; }}
                >
                  ANALYZE GAME
                </button>
              )}
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
  detailReason,
  onGoHomeAction,
}: {
  show: boolean;
  t: MatchSidebarProps["t"];
  ip: boolean;
  isSelfAbort: boolean;
  detailReason?: string | null;
  onGoHomeAction: () => void;
}) {
  if (!show) return null;
  const title = isSelfAbort ? "MATCH ABORTED" : "OPPONENT ABORTED THE MATCH";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10011, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ background: t.bgPanel, border: `2px solid ${t.textMuted}`, borderRadius: ip ? 2 : 16, padding: "30px", maxWidth: 440, width: "90vw", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.75)", animation: "scaleIn 0.3s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 14 }}>{title}</div>
        <div style={{ fontFamily: t.fontBody, fontSize: 15, color: t.textSecondary, marginBottom: 24, lineHeight: 1.55 }}>
          {isSelfAbort ? (
            <>You left before any move in game 1. This match was voided and will not appear in Career.</>
          ) : (
            <>
              {detailReason ? (
                <span style={{ display: "block", marginBottom: 12, color: t.text, fontWeight: 600 }}>{detailReason}</span>
              ) : null}
              <span style={{ color: t.textSecondary }}>
                The match was voided before any move in game 1 and will not appear in Career for either player.
              </span>
            </>
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

export function SurrenderModal({ show, t, ip, isRankedGame, variant = "forfeit", modalZIndex = 9999, onConfirmAction, onCancelAction, playHoverAction }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean; isRankedGame: boolean;
  variant?: "forfeit" | "abort";
  modalZIndex?: number;
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
    <div className="overlay-backdrop" style={{ position: "fixed", inset: 0, zIndex: modalZIndex, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
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