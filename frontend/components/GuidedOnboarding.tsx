"use client";

/**
 * Guided onboarding — the three "play & win" games (5×5 Baltazar → 6×6
 * Valdorin → 7×7 Seraphina), narrated by Syros. Each game runs on
 * `GuidedGameBoard` (scripted, guaranteed win) while Syros speaks each beat.
 * Calls `onComplete()` after the third game's closing line; the parent
 * (AppShell) then drops the player on Home and runs the `SpotlightTour`.
 *
 * This replaces the slide-based first-run tutorial for new accounts.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { GUIDED_GAMES } from "@/lib/guidedGames";
import { getBotLabel } from "@/lib/botNames";
import type { BotId } from "@/lib/botRewards";
import { useSyrosVoice } from "@/hooks/useSyrosVoice";
import SyrosNarrator from "@/components/SyrosNarrator";
import GuidedGameBoard from "@/components/GuidedGameBoard";

type Phase = "intro" | "play" | "outro";

export interface GuidedOnboardingProps {
  themeId: ThemeId;
  /** Fired after the final game's outro is dismissed. */
  onComplete: () => void;
  /** Fired if the player bails out early (still marks the tutorial done). */
  onSkip?: () => void;
}

export default function GuidedOnboarding({ themeId, onComplete, onSkip }: GuidedOnboardingProps) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const voice = useSyrosVoice();

  const [gameIdx, setGameIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [moveIdx, setMoveIdx] = useState(0);

  const game = GUIDED_GAMES[gameIdx];
  const isLastGame = gameIdx === GUIDED_GAMES.length - 1;

  // Reset to the intro whenever the game changes.
  useEffect(() => {
    setPhase("intro");
    setMoveIdx(0);
  }, [gameIdx]);

  // Resolve the active narration beat. During play, only moves that have an
  // explicit `narration[moveIdx]` entry produce a new line — all other moves
  // hold the most recent beat so the typewriter (and voice) do NOT restart on
  // every tap. Falls back to `game.intro` until the first beat fires.
  const activeBeat = useMemo(() => {
    if (phase !== "play") return null;
    // Walk backward from the current move to find the most recent beat.
    for (let i = moveIdx; i >= 0; i--) {
      if (game.narration[i] !== undefined) return { text: game.narration[i], idx: i };
    }
    return null;
  }, [phase, moveIdx, game]);

  const line =
    phase === "intro"
      ? game.intro
      : phase === "outro"
      ? game.outro
      : activeBeat?.text ?? game.intro;

  // Key on the beat index (not the move index) so the narrator only restarts
  // when a genuinely new narration line arrives.
  const lineKey =
    phase === "play"
      ? `${game.id}-beat-${activeBeat?.idx ?? "intro"}`
      : `${game.id}-${phase}`;


  const onBoardMove = useCallback(
    (idx: number, finished: boolean) => {
      if (!finished) setMoveIdx(idx);
    },
    [],
  );

  const onBoardComplete = useCallback(() => {
    setPhase("outro");
  }, []);

  const introNext = () => setPhase("play");

  const outroNext = () => {
    if (!isLastGame) {
      setGameIdx((i) => i + 1);
    } else {
      voice.cancel();
      onComplete();
    }
  };

  // Light up the dual-threat cells in the late beats (6×6 / 7×7).
  const dualOn = !!game.dualThreatCells && phase === "play" && moveIdx >= game.moves.length - 3;
  const highlightCells = dualOn ? game.dualThreatCells : undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3500,
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 20px 32px",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 640, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: "0.14em", color: t.textMuted }}>
          GUIDED TRAINING · GAME {gameIdx + 1} / {GUIDED_GAMES.length}
        </div>
        {onSkip && (
          <button
            type="button"
            onClick={() => {
              voice.cancel();
              onSkip();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: t.textMuted,
              fontFamily: t.fontMono,
              fontSize: 11,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            SKIP
          </button>
        )}
      </div>

      <div
        style={{
          fontFamily: t.fontDisplay,
          fontSize: "clamp(20px,4vw,30px)",
          fontWeight: 800,
          color: t.accent,
          letterSpacing: "0.05em",
          margin: "6px 0 18px",
          textAlign: "center",
        }}
      >
        {game.size}×{game.size} · VS{" "}
        <span style={{ color: game.opponent.color }}>{getBotLabel(game.opponent.id as BotId) || game.opponent.label}</span>
      </div>

      {/* Narrator */}
      <div style={{ width: "100%", maxWidth: 640, marginBottom: 22 }}>
        <SyrosNarrator
          line={line}
          themeId={themeId}
          voice={voice}
          lineKey={lineKey}
          onNext={phase === "intro" ? introNext : phase === "outro" ? outroNext : undefined}
          nextLabel={phase === "intro" ? "BEGIN" : isLastGame ? "FINISH" : "CONTINUE"}
        />
      </div>

      {/* Board (hidden during the intro line) */}
      {phase !== "intro" && (
        <GuidedGameBoard
          key={game.id}
          game={game}
          themeT={t}
          onMoveIndex={onBoardMove}
          onComplete={onBoardComplete}
          highlightCells={highlightCells}
        />
      )}
    </div>
  );
}
