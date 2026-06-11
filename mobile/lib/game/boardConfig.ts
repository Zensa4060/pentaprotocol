/**
 * Grid size / board mode helpers — aligned with web ``GameScreen``.
 */

import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import type { Board } from "@/lib/game/winChecker7";

export type GridSize = 5 | 6 | 7;
export type BoardMode = "5x5" | "6x6" | "7x7";
export type CompoundBoardMode =
  | BoardMode
  | "5x5_7x7"
  | "5x5_6x6"
  | "6x6_7x7"
  | "5x5_6x6_7x7";

export function startingLegFromBoardMode(mode: string | undefined | null): BoardMode {
  const m = (mode ?? "5x5").trim();
  if (m === "5x5" || m === "6x6" || m === "7x7") return m;
  const seg = m.split("_").filter((p): p is BoardMode => p === "5x5" || p === "6x6" || p === "7x7");
  return seg[0] ?? "5x5";
}

/** Playable leg size for a room `board_mode` (matches backend `_effective_board_mode`). */
export function effectivePlayBoardMode(mode: string | undefined | null): BoardMode {
  const m = (mode ?? "5x5").trim();
  if (m === "5x5" || m === "6x6" || m === "7x7") return m;
  return startingLegFromBoardMode(m);
}

export function isTripleLegMode(mode: string | undefined | null): boolean {
  return (mode ?? "").includes("_");
}

export function boardModeFromGrid(grid: GridSize): BoardMode {
  if (grid === 5) return "5x5";
  if (grid === 6) return "6x6";
  return "7x7";
}

export function gridFromBoardMode(mode: string | undefined | null): GridSize {
  const leg = effectivePlayBoardMode(mode);
  if (leg === "5x5") return 5;
  if (leg === "6x6") return 6;
  return 7;
}

export function gridParamFromBoardMode(mode: string | undefined | null): "5" | "6" | "7" {
  const g = gridFromBoardMode(mode);
  if (g === 5) return "5";
  if (g === 6) return "6";
  return "7";
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
  if (grid === 7) return 10 * 60 * 1000;
  if (grid === 6) return 8 * 60 * 1000;
  return 5 * 60 * 1000;
}

/** Timebreaker cut clock (unchanged). */
export const TIMEBREAKER_CUT_MS = 60 * 1000;

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

// ── Core vs special split ────────────────────────────────────────────────────
// STRAIGHT LINE and DIAGONAL are CORE rules on every grid — always active,
// never deselectable, never bannable (alongside the N-point connection rule).
// On 5×5 the four special shapes are the variable pool: exactly ONE of them
// sits out of every match (player-picked in solo, server-drawn in MP).
export const CORE_LINE_PATTERNS = ["LINE", "DIAGONAL"] as const;
export const SPECIAL_PATTERNS_5 = ["V", "L", "ZZ-5", "T"] as const;

export function isCorePatternId(id: string): boolean {
  const v = id.trim().toUpperCase();
  return v === "LINE" || v === "DIAGONAL";
}

/** Active 5×5 set for a new match: both cores + a random 3 of the 4 specials. */
export function pickMatchPatterns5(): string[] {
  const pool = [...SPECIAL_PATTERNS_5];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return [...pool.slice(0, 3), ...CORE_LINE_PATTERNS];
}
