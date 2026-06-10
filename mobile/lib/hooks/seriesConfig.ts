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

/** BO3 short-series caps (web ``isLocalShortSeries``). */
export const BO3_WINS_TARGET = 2;
export const BO3_MAX_GAMES = 3;

export type SeriesPlayer = "P1" | "P2";
export type SeriesOutcome = "P1" | "P2" | "DRAW";

/**
 * Which series shape a local match runs:
 *  - ``bo3``  — training / AI ladder: ONE board size, max 3 games, first to
 *    2 wins, drawable (1–1 / 0–0 after G3), Rulebreaker before the G3
 *    decider only. Mirrors web ``isLocalShortSeries``.
 *  - ``full`` — unranked queue filler bots: the multiplayer triple-leg
 *    ladder (5×5 G1–3 → 6×6 G4–6 → 7×7 G7–9, first to 3, breakers before
 *    G3/G6/G9, Limitbreaker G10 at 3–3).
 */
export interface SeriesSpec {
  kind: "bo3" | "full";
  /** The single board size for ``bo3``; ignored by ``full`` (ladder). */
  grid: GridSize;
}

export function specGridForGame(spec: SeriesSpec, gameNumber: number): GridSize {
  return spec.kind === "bo3" ? spec.grid : gridForGameNumber(gameNumber);
}

export function specBoardModeForGame(spec: SeriesSpec, gameNumber: number): BoardMode {
  return boardModeFromGrid(specGridForGame(spec, gameNumber));
}

/** After completing this game number, enter a Protocol Breaker before the next. */
export function specIsBreakerGate(spec: SeriesSpec, completedGameNumber: number): boolean {
  if (spec.kind === "bo3") return completedGameNumber === 2;
  return isBreakerGate(completedGameNumber);
}

/** BO3 never escalates board size. */
export function specIsLegTransition(spec: SeriesSpec, completedGameNumber: number): boolean {
  if (spec.kind === "bo3") return false;
  return isLegTransition(completedGameNumber);
}

export function specMaxGames(spec: SeriesSpec): number {
  return spec.kind === "bo3" ? BO3_MAX_GAMES : MAX_REGULATION_GAMES;
}

export function specWinsTarget(spec: SeriesSpec): number {
  return spec.kind === "bo3" ? BO3_WINS_TARGET : SERIES_WINS_TARGET;
}

export function specPatternsForGame(
  spec: SeriesSpec,
  gameNumber: number,
  picked: string[] | undefined,
): string[] {
  if (spec.kind === "bo3") {
    return picked?.length ? picked : defaultPatternsForGrid(spec.grid);
  }
  return patternsForLeg(gameNumber, picked);
}

export function specResolveSeries(
  spec: SeriesSpec,
  history: SeriesOutcome[],
): { winner: SeriesPlayer | null; draw: boolean; over: boolean; needsLimitbreaker: boolean } {
  if (spec.kind === "full") return resolveSeries(history);
  const { p1, p2 } = winsOf(history);
  if (p1 >= BO3_WINS_TARGET) return { winner: "P1", draw: false, over: true, needsLimitbreaker: false };
  if (p2 >= BO3_WINS_TARGET) return { winner: "P2", draw: false, over: true, needsLimitbreaker: false };
  if (history.length >= BO3_MAX_GAMES) {
    if (p1 > p2) return { winner: "P1", draw: false, over: true, needsLimitbreaker: false };
    if (p2 > p1) return { winner: "P2", draw: false, over: true, needsLimitbreaker: false };
    return { winner: null, draw: true, over: true, needsLimitbreaker: false };
  }
  return { winner: null, draw: false, over: false, needsLimitbreaker: false };
}

export function specScoreSuffix(spec: SeriesSpec): string {
  return spec.kind === "bo3"
    ? `first to ${BO3_WINS_TARGET} · BO${BO3_MAX_GAMES}`
    : `first to ${SERIES_WINS_TARGET}`;
}

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
  /** Mindbreaker: per-player win-condition lists (bans hit only the banner's opponent). */
  patternsP1?: string[];
  patternsP2?: string[];
  c3Blocked?: boolean;
  p1ClockMs?: number;
  p2ClockMs?: number;
  /** Timebreaker: hidden cell — any stone placed there counts as the owner's symbol. */
  rb6SpecialCell?: { r: number; c: number; owner: SeriesPlayer } | null;
  /** Mindbreaker: center-opening bonus is off for the decider. */
  suppressCenterOpening?: boolean;
  /** Mindbreaker: who may cash the one-time extra-turn token. */
  extraTurnTokenHolder?: SeriesPlayer | null;
}

export function clockMsForGameReset(
  grid: GridSize,
  gameNumber: number,
  rb6TimerOwner: SeriesPlayer | null,
): { p1: number; p2: number } {
  const base = matchMsForGrid(grid);
  let p1 = base;
  let p2 = base;
  // `rb6TimerOwner` is only ever set by the 6×6 Timebreaker, so its
  // presence is the gate — not the game number, which is 6 in the full
  // ladder but 3 in a local BO3 series.
  if (grid === 6 && rb6TimerOwner === "P1") p1 = TIMEBREAKER_CUT_MS;
  if (grid === 6 && rb6TimerOwner === "P2") p2 = TIMEBREAKER_CUT_MS;
  return { p1, p2 };
}

export function seriesScoreLine(p1: number, p2: number): string {
  return `First to ${SERIES_WINS_TARGET} · ${p1} – ${p2} · up to ${MAX_REGULATION_GAMES} games`;
}
