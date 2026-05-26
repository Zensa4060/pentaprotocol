/**
 * Shared match rules (center bonus, extra turns, clocks) for 5×5 / 6×6 / 7×7.
 */

import { centerCell, matchMsForGrid, type GridSize } from "./boardConfig";

export type Player7 = "P1" | "P2";

export const CENTER_7 = 3;
export const MATCH_MS_7 = matchMsForGrid(7);
export const MATCH_MS_6 = matchMsForGrid(6);
export const MATCH_MS_5 = matchMsForGrid(5);

export function opponent(p: Player7): Player7 {
  return p === "P1" ? "P2" : "P1";
}

export function cellLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

export function pieceGlyph(p: Player7): string {
  return p === "P1" ? "X" : "Y";
}

export interface TurnResolution {
  next: Player7;
  extraTurns: number;
  centerBonus: boolean;
}

export function resolveTurnAfterMove(
  mover: Player7,
  movesAfter: number,
  row: number,
  col: number,
  extraTurnsBefore: number,
  grid: GridSize,
  opts?: { suppressCenterOpening?: boolean; c3Blocked?: boolean },
): TurnResolution {
  const center = centerCell(grid);
  const suppressCenter = opts?.suppressCenterOpening ?? false;
  const centerOpenBonus =
    !suppressCenter &&
    movesAfter === 1 &&
    row === center &&
    col === center;

  if (centerOpenBonus) {
    return { next: opponent(mover), extraTurns: 2, centerBonus: true };
  }
  if (extraTurnsBefore > 0) {
    const left = extraTurnsBefore - 1;
    return {
      next: left === 0 ? opponent(mover) : mover,
      extraTurns: left,
      centerBonus: false,
    };
  }
  return { next: opponent(mover), extraTurns: 0, centerBonus: false };
}

export function isBlockedCenterOpening(
  movesBefore: number,
  row: number,
  col: number,
  c3Blocked: boolean,
  grid: GridSize,
): boolean {
  const center = centerCell(grid);
  return c3Blocked && movesBefore === 0 && row === center && col === center;
}

export interface MoveLogEntry {
  text: string;
  player: Player7;
}

export function buildMoveLogEntry(
  index: number,
  row: number,
  col: number,
  player: Player7,
  centerBonus?: boolean,
): MoveLogEntry {
  const suffix = centerBonus ? " · center → 2 extra turns" : "";
  return {
    player,
    text: `${index}. ${pieceGlyph(player)}→${cellLabel(row, col)}${suffix}`,
  };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
