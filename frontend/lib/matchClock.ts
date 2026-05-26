/**
 * Per-player match clock budgets (ms). Timebreaker cut-to-1:00 is separate (60_000).
 */

export type PlayGridSize = 5 | 6 | 7;

export const MATCH_MS_5 = 5 * 60 * 1000;
export const MATCH_MS_6 = 8 * 60 * 1000;
export const MATCH_MS_7 = 10 * 60 * 1000;

/** Timebreaker: one player's clock after the cut (unchanged). */
export const TIMEBREAKER_CUT_MS = 60 * 1000;

export function matchMsForGridSize(s: PlayGridSize): number {
  if (s === 7) return MATCH_MS_7;
  if (s === 6) return MATCH_MS_6;
  return MATCH_MS_5;
}
