/**
 * Match series controller — turns a single-game hook (training / bot) into
 * a multi-game leg, mirroring the web/desktop rules:
 *
 *   • A leg is **first to 5 points** (win = 1.0, draw = 0.5 each) — see
 *     ``backend/app/game/game_state.py::_check_series_winner``.
 *   • Games are labelled G1, G2, G3 … and the **starter alternates**:
 *     odd games open with P1, even games with P2 (matches
 *     ``series_logic.tick_ready_system``).
 *   • Between games the leg pauses in an **intermission** ("READY / next
 *     game") until the player advances; when someone reaches 5 the leg is
 *     **over**.
 *
 * The hook is renderer-agnostic: feed it the active game ``result`` and the
 * game hook's ``reset(starter)`` and it returns the leg state + controls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SeriesPlayer = "P1" | "P2";
export type SeriesOutcome = "P1" | "P2" | "DRAW";
export type SeriesPhase = "playing" | "intermission" | "over";

/** Points needed to take the leg (first to 5; win 1.0 / draw 0.5). */
export const SERIES_TARGET = 5;

export interface MatchSeries {
  /** 1-based number of the game currently being played. */
  gameNumber: number;
  history: SeriesOutcome[];
  p1Points: number;
  p2Points: number;
  phase: SeriesPhase;
  seriesWinner: SeriesPlayer | null;
  /** Outcome of the game that just finished (drives the intermission card). */
  lastOutcome: SeriesOutcome | null;
  /** Advance to the next game (alternating starter). */
  nextGame: () => void;
  /** Start a brand-new leg from G1. */
  resetSeries: () => void;
}

interface GameResultLike {
  status: "playing" | "won" | "draw";
  winner: SeriesPlayer | null;
}

function pointsOf(history: SeriesOutcome[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const w of history) {
    if (w === "P1") p1 += 1;
    else if (w === "P2") p2 += 1;
    else {
      p1 += 0.5;
      p2 += 0.5;
    }
  }
  return { p1, p2 };
}

export function useMatchSeries(
  result: GameResultLike,
  resetGame: (starter: SeriesPlayer) => void,
): MatchSeries {
  const [gameNumber, setGameNumber] = useState(1);
  const [history, setHistory] = useState<SeriesOutcome[]>([]);
  const [phase, setPhase] = useState<SeriesPhase>("playing");
  // Guards a single record per finished game (the result object stays
  // "won"/"draw" for many renders while the overlay is up).
  const recordedRef = useRef(false);

  useEffect(() => {
    if (phase !== "playing") return;
    if (result.status === "playing") {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;

    const outcome: SeriesOutcome = result.status === "draw" ? "DRAW" : result.winner ?? "DRAW";
    setHistory((h) => [...h, outcome]);

    // Decide the phase from the prospective tally (history state hasn't
    // flushed yet, so fold the new outcome on top of the current list).
    const { p1, p2 } = pointsOf([...history, outcome]);
    setPhase(p1 >= SERIES_TARGET - 1e-9 || p2 >= SERIES_TARGET - 1e-9 ? "over" : "intermission");
  }, [result.status, result.winner, phase, history]);

  const { p1: p1Points, p2: p2Points } = useMemo(() => pointsOf(history), [history]);

  const seriesWinner: SeriesPlayer | null =
    p1Points >= SERIES_TARGET - 1e-9 ? "P1" : p2Points >= SERIES_TARGET - 1e-9 ? "P2" : null;

  const nextGame = useCallback(() => {
    setGameNumber((g) => {
      const ng = g + 1;
      // Odd games open with P1, even games with P2.
      resetGame(ng % 2 === 1 ? "P1" : "P2");
      return ng;
    });
    recordedRef.current = false;
    setPhase("playing");
  }, [resetGame]);

  const resetSeries = useCallback(() => {
    setHistory([]);
    setGameNumber(1);
    recordedRef.current = false;
    setPhase("playing");
    resetGame("P1");
  }, [resetGame]);

  const lastOutcome = history.length > 0 ? history[history.length - 1] : null;

  return {
    gameNumber,
    history,
    p1Points,
    p2Points,
    phase,
    seriesWinner,
    lastOutcome,
    nextGame,
    resetSeries,
  };
}
