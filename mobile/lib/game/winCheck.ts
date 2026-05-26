/**
 * Dispatch win checks by grid size (5 / 6 / 7).
 */

import type { GridSize } from "./boardConfig";
import { checkWin } from "./winChecker5";
import { checkWin6 } from "./winChecker6";
import { checkWin7 } from "./winChecker7";

export type { Board, Coord } from "./winChecker7";

export type WinResult = {
  winner: string;
  line: [number, number][];
  connectionScores?: { p1: number; p2: number };
};

export function checkWinForGrid(
  grid: GridSize,
  board: (string | null)[][],
  r: number,
  c: number,
  player: string,
  movesPlayed: number,
  patterns: string[],
): WinResult | null {
  if (grid === 5) return checkWin(board, r, c, player, movesPlayed, patterns);
  if (grid === 6) return checkWin6(board, r, c, player, movesPlayed, patterns);
  return checkWin7(board, r, c, player, movesPlayed, patterns);
}
