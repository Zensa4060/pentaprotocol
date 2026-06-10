/** Protocol breaker UI phases (subset of web ``Phase``). */
export const RB_PHASES = [
  "rb_splash",
  "rb_coin",
  "rule_choice",
  "who_first_winner",
  "c3_choice",
  "c3_choice_loser",
  "who_first_loser",
  "ban_pattern_winner",
  "ban_pattern_loser",
  "grid_block_warning",
  "grid_block_selection",
  "grid_block_waiting",
  "toss_summary",
] as const;

export type RbPhase = (typeof RB_PHASES)[number];

export function isRbPhase(phase: string | null | undefined): phase is RbPhase {
  return !!phase && (RB_PHASES as readonly string[]).includes(phase);
}

/**
 * Breaker name follows the BOARD SIZE, not the game number (web parity:
 * splash uses is6x6/is7x7). Game numbers differ between the full ladder
 * (breakers before G3/G6/G9) and local BO3 (breaker before G3 on any
 * board), so keying off the number showed "RULEBREAKER" for 6×6/7×7 BO3.
 */
export function breakerTitle(boardMode: string, _gameNumber: number): string {
  if (boardMode.startsWith("6x6")) return "TIMEBREAKER";
  if (boardMode.startsWith("7x7")) return "MINDBREAKER";
  if (boardMode.startsWith("5x5")) return "RULEBREAKER";
  return "PROTOCOL BREAKER";
}
