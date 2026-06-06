/**
 * Local match series for training / pass-and-play / bot — mirrors web
 * ``isLocalShortSeries`` (NOT multiplayer ``room.py`` scoring):
 *
 *   • **BO3** — at most 3 games (G1, G2, G3)
 *   • **First to 2 wins** ends the series
 *   • **Draws score 0** (wins only)
 *   • Starters alternate: odd games → P1, even → P2
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SeriesPlayer = "P1" | "P2";
export type SeriesOutcome = "P1" | "P2" | "DRAW";
export type SeriesPhase = "playing" | "intermission" | "over";

/** Wins required to take a local BO3 series. */
export const SERIES_WINS_TARGET = 2;
/** Maximum games in a local BO3 leg. */
export const MAX_SERIES_GAMES = 3;

export interface MatchSeries {
  gameNumber: number;
  history: SeriesOutcome[];
  p1Points: number;
  p2Points: number;
  phase: SeriesPhase;
  seriesWinner: SeriesPlayer | null;
  seriesDraw: boolean;
  lastOutcome: SeriesOutcome | null;
  nextGame: () => void;
  resetSeries: () => void;
}

interface GameResultLike {
  status: "playing" | "won" | "draw";
  winner: SeriesPlayer | null;
}

function winsOf(history: SeriesOutcome[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const w of history) {
    if (w === "P1") p1 += 1;
    else if (w === "P2") p2 += 1;
  }
  return { p1, p2 };
}

function resolveSeries(
  history: SeriesOutcome[],
): { winner: SeriesPlayer | null; draw: boolean; over: boolean } {
  const { p1, p2 } = winsOf(history);
  if (p1 >= SERIES_WINS_TARGET) return { winner: "P1", draw: false, over: true };
  if (p2 >= SERIES_WINS_TARGET) return { winner: "P2", draw: false, over: true };
  if (history.length >= MAX_SERIES_GAMES) {
    if (p1 > p2) return { winner: "P1", draw: false, over: true };
    if (p2 > p1) return { winner: "P2", draw: false, over: true };
    return { winner: null, draw: true, over: true };
  }
  return { winner: null, draw: false, over: false };
}

export function useMatchSeries(
  result: GameResultLike,
  resetGame: (starter: SeriesPlayer) => void,
): MatchSeries {
  const [gameNumber, setGameNumber] = useState(1);
  const [history, setHistory] = useState<SeriesOutcome[]>([]);
  const [phase, setPhase] = useState<SeriesPhase>("playing");
  const recordedRef = useRef(false);

  useEffect(() => {
    if (phase !== "playing") return;
    if (result.status === "playing") {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;

    const outcome: SeriesOutcome =
      result.status === "draw" ? "DRAW" : result.winner ?? "DRAW";
    const nextHistory = [...history, outcome];
    setHistory(nextHistory);

    const resolved = resolveSeries(nextHistory);
    setPhase(resolved.over ? "over" : "intermission");
  }, [result.status, result.winner, phase, history]);

  const { p1: p1Points, p2: p2Points } = useMemo(() => winsOf(history), [history]);
  const resolved = useMemo(() => resolveSeries(history), [history]);

  const nextGame = useCallback(() => {
    if (gameNumber >= MAX_SERIES_GAMES) return;
    setGameNumber((g) => {
      const ng = g + 1;
      resetGame(ng % 2 === 1 ? "P1" : "P2");
      return ng;
    });
    recordedRef.current = false;
    setPhase("playing");
  }, [gameNumber, resetGame]);

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
    seriesWinner: resolved.winner,
    seriesDraw: resolved.draw,
    lastOutcome,
    nextGame,
    resetSeries,
  };
}
