/**
 * Grid size / board mode helpers — aligned with web ``GameScreen``.
 */

import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import type { Board } from "@/lib/game/winChecker7";

export type GridSize = 5 | 6 | 7;
export type BoardMode = "5x5" | "6x6" | "7x7";

export function boardModeFromGrid(grid: GridSize): BoardMode {
  if (grid === 5) return "5x5";
  if (grid === 6) return "6x6";
  return "7x7";
}

export function gridFromBoardMode(mode: string | undefined | null): GridSize {
  if (mode === "5x5") return 5;
  if (mode === "6x6") return 6;
  return 7;
}

export function parseGridParam(value: string | undefined): GridSize {
  if (value === "5" || value === "5x5") return 5;
  if (value === "6" || value === "6x6") return 6;
  return 7;
}

/** Center cell index (0-based) for center-opening rule. */
export function centerCell(grid: GridSize): number {
  return Math.floor(grid / 2);
}

/** Per-player match clock (ms), same as web ``matchMsForGridSize``. */
export function matchMsForGrid(grid: GridSize): number {
  if (grid === 7) return 300_000;
  if (grid === 6) return 180_000;
  return 120_000;
}

export function emptyBoard(grid: GridSize): Board {
  return Array.from({ length: grid }, () =>
    Array.from({ length: grid }, () => null),
  );
}

export const DEFAULT_PATTERNS_5 = ["V", "L", "ZZ-5", "T", "LINE", "DIAGONAL"] as const;
export const DEFAULT_PATTERNS_6 = ["ZZ", "T", "L", "Y", "A", "LINE", "DIAGONAL"] as const;

export function defaultPatternsForGrid(grid: GridSize): string[] {
  if (grid === 5) return [...DEFAULT_PATTERNS_5];
  if (grid === 6) return [...DEFAULT_PATTERNS_6];
  return [...DEFAULT_PATTERNS_7];
}
