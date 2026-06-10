/**
 * Local triple-leg series controller — game outcomes, leg transitions,
 * breaker gates, and Limitbreaker trigger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  defaultStarterForGame,
  LIMITBREAKER_GAME,
  specGridForGame,
  specIsBreakerGate,
  specIsLegTransition,
  specMaxGames,
  specResolveSeries,
  type SeriesOutcome,
  type SeriesPhase,
  type SeriesPlayer,
  type SeriesSpec,
  winsOf,
} from "./seriesConfig";

const FULL_SPEC: SeriesSpec = { kind: "full", grid: 5 };

export interface TripleLegSeries {
  gameNumber: number;
  history: SeriesOutcome[];
  p1Points: number;
  p2Points: number;
  phase: SeriesPhase;
  seriesWinner: SeriesPlayer | null;
  seriesDraw: boolean;
  lastOutcome: SeriesOutcome | null;
  /** Advance after intermission or leg splash (not breaker/limitbreaker). */
  advanceToNextGame: () => void;
  /** Called when Protocol Breaker flow completes. */
  completeBreaker: () => void;
  /** Called when Limitbreaker picks are locked and G10 should start. */
  completeLimitbreaker: () => void;
  resetSeries: () => void;
  enterBreaker: () => void;
  enterLimitbreaker: () => void;
  legTransitionLabel: string | null;
}

interface GameResultLike {
  status: "playing" | "won" | "draw";
  winner: SeriesPlayer | null;
}

export function useTripleLegSeries(
  result: GameResultLike,
  onResetGame: (starter: SeriesPlayer, nextGameNumber: number) => void,
  spec: SeriesSpec = FULL_SPEC,
): TripleLegSeries {
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

    const resolved = specResolveSeries(spec, nextHistory);
    if (resolved.over) {
      setPhase("over");
      return;
    }
    if (resolved.needsLimitbreaker) {
      setPhase("limitbreaker");
      return;
    }
    if (specIsBreakerGate(spec, gameNumber)) {
      setPhase("breaker");
      return;
    }
    if (specIsLegTransition(spec, gameNumber)) {
      setPhase("leg_transition");
      return;
    }
    setPhase("intermission");
  }, [result.status, result.winner, phase, history, gameNumber, spec]);

  const { p1: p1Points, p2: p2Points } = useMemo(() => winsOf(history), [history]);
  const resolved = useMemo(() => specResolveSeries(spec, history), [history, spec]);

  const bumpGame = useCallback(() => {
    setGameNumber((g) => g + 1);
    recordedRef.current = false;
    setPhase("playing");
  }, []);

  const advanceToNextGame = useCallback(() => {
    if (gameNumber >= specMaxGames(spec) && phase !== "leg_transition") return;
    const nextGn = gameNumber + 1;
    setGameNumber(nextGn);
    onResetGame(defaultStarterForGame(nextGn), nextGn);
    recordedRef.current = false;
    setPhase("playing");
  }, [gameNumber, onResetGame, phase, spec]);

  const completeBreaker = useCallback(() => {
    bumpGame();
  }, [bumpGame]);

  const completeLimitbreaker = useCallback(() => {
    setGameNumber(LIMITBREAKER_GAME);
    onResetGame("P1", LIMITBREAKER_GAME);
    recordedRef.current = false;
    setPhase("playing");
  }, [onResetGame]);

  const enterBreaker = useCallback(() => setPhase("breaker"), []);
  const enterLimitbreaker = useCallback(() => setPhase("limitbreaker"), []);

  const resetSeries = useCallback(() => {
    setHistory([]);
    setGameNumber(1);
    recordedRef.current = false;
    setPhase("playing");
    onResetGame("P1", 1);
  }, [onResetGame]);

  const legTransitionLabel = useMemo(() => {
    if (phase !== "leg_transition") return null;
    const nextGrid = specGridForGame(spec, gameNumber + 1);
    return `${nextGrid}×${nextGrid} LEG`;
  }, [phase, gameNumber, spec]);

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
    advanceToNextGame,
    completeBreaker,
    completeLimitbreaker,
    resetSeries,
    enterBreaker,
    enterLimitbreaker,
    legTransitionLabel,
  };
}
