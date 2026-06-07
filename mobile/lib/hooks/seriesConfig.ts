/**
 * Triple-leg match ladder — mirrors ranked multiplayer (room.py) and web
 * ``GameScreen`` local AI flow: 5×5 G1–3 → 6×6 G4–6 → 7×7 G7–9, first to 3
 * wins, Protocol Breakers before G3/G6/G9, Limitbreaker decider at 3–3.
 */

import {
  boardModeFromGrid,
  defaultPatternsForGrid,
  matchMsForGrid,
  TIMEBREAKER_CUT_MS,
  type BoardMode,
  type GridSize,
} from "@/lib/game/boardConfig";

export const SERIES_WINS_TARGET = 3;
export const MAX_REGULATION_GAMES = 9;
export const LIMITBREAKER_GAME = 10;

export type SeriesPlayer = "P1" | "P2";
export type SeriesOutcome = "P1" | "P2" | "DRAW";

export type SeriesPhase =
  | "playing"
  | "intermission"
  | "breaker"
  | "leg_transition"
  | "limitbreaker"
  | "over";

export function gridForGameNumber(gameNumber: number): GridSize {
  if (gameNumber <= 3) return 5;
  if (gameNumber <= 6) return 6;
  return 7;
}

export function boardModeForGameNumber(gameNumber: number): BoardMode {
  return boardModeFromGrid(gridForGameNumber(gameNumber));
}

/** After completing this game number, enter a Protocol Breaker before the next. */
export function isBreakerGate(completedGameNumber: number): boolean {
  return completedGameNumber === 2 || completedGameNumber === 5 || completedGameNumber === 8;
}

/** After completing this game number, escalate board size (if series continues). */
export function isLegTransition(completedGameNumber: number): boolean {
  return completedGameNumber === 3 || completedGameNumber === 6;
}

export function patternsForLeg(
  gameNumber: number,
  picked5x5: string[] | undefined,
): string[] {
  const grid = gridForGameNumber(gameNumber);
  if (grid === 5 && picked5x5?.length) return picked5x5;
  return defaultPatternsForGrid(grid);
}

export function winsOf(history: SeriesOutcome[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const w of history) {
    if (w === "P1") p1 += 1;
    else if (w === "P2") p2 += 1;
  }
  return { p1, p2 };
}

export function resolveSeries(history: SeriesOutcome[]): {
  winner: SeriesPlayer | null;
  draw: boolean;
  over: boolean;
  needsLimitbreaker: boolean;
} {
  const { p1, p2 } = winsOf(history);
  if (p1 >= SERIES_WINS_TARGET) return { winner: "P1", draw: false, over: true, needsLimitbreaker: false };
  if (p2 >= SERIES_WINS_TARGET) return { winner: "P2", draw: false, over: true, needsLimitbreaker: false };
  if (history.length >= MAX_REGULATION_GAMES) {
    if (p1 === 3 && p2 === 3) {
      return { winner: null, draw: false, over: false, needsLimitbreaker: true };
    }
    if (p1 > p2) return { winner: "P1", draw: false, over: true, needsLimitbreaker: false };
    if (p2 > p1) return { winner: "P2", draw: false, over: true, needsLimitbreaker: false };
    return { winner: null, draw: true, over: true, needsLimitbreaker: false };
  }
  return { winner: null, draw: false, over: false, needsLimitbreaker: false };
}

/** Who opens a normal (non-breaker) game in the ladder. */
export function defaultStarterForGame(gameNumber: number): SeriesPlayer {
  return gameNumber % 2 === 1 ? "P1" : "P2";
}

export interface GameResetOptions {
  starter?: SeriesPlayer;
  gridSize?: GridSize;
  patterns?: string[];
  c3Blocked?: boolean;
  p1ClockMs?: number;
  p2ClockMs?: number;
}

export function clockMsForGameReset(
  grid: GridSize,
  gameNumber: number,
  rb6TimerOwner: SeriesPlayer | null,
): { p1: number; p2: number } {
  const base = matchMsForGrid(grid);
  let p1 = base;
  let p2 = base;
  if (grid === 6 && gameNumber === 3 && rb6TimerOwner === "P1") p1 = TIMEBREAKER_CUT_MS;
  if (grid === 6 && gameNumber === 3 && rb6TimerOwner === "P2") p2 = TIMEBREAKER_CUT_MS;
  if (grid === 6 && gameNumber === 6 && rb6TimerOwner === "P1") p1 = TIMEBREAKER_CUT_MS;
  if (grid === 6 && gameNumber === 6 && rb6TimerOwner === "P2") p2 = TIMEBREAKER_CUT_MS;
  return { p1, p2 };
}

export function seriesScoreLine(p1: number, p2: number): string {
  return `First to ${SERIES_WINS_TARGET} · ${p1} – ${p2} · up to ${MAX_REGULATION_GAMES} games`;
}
