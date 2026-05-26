/**
 * 7×7 match rules — thin aliases over grid-aware ``matchRules``.
 */
export {
  opponent,
  cellLabel,
  pieceGlyph,
  buildMoveLogEntry,
  formatClock,
  type TurnResolution,
  type MoveLogEntry,
  type Player7,
} from "./matchRules";

import {
  resolveTurnAfterMove as resolveTurnAfterMoveGrid,
  isBlockedCenterOpening as isBlockedCenterOpeningGrid,
  type TurnResolution,
} from "./matchRules";

export const CENTER_7 = 3;
export const MATCH_MS_7 = 10 * 60 * 1000;

export function resolveTurnAfterMove(
  mover: "P1" | "P2",
  movesAfter: number,
  row: number,
  col: number,
  extraTurnsBefore: number,
  opts?: { suppressCenterOpening?: boolean; c3Blocked?: boolean },
): TurnResolution {
  return resolveTurnAfterMoveGrid(mover, movesAfter, row, col, extraTurnsBefore, 7, opts);
}

export function isBlockedCenterOpening(
  movesBefore: number,
  row: number,
  col: number,
  c3Blocked: boolean,
): boolean {
  return isBlockedCenterOpeningGrid(movesBefore, row, col, c3Blocked, 7);
}
