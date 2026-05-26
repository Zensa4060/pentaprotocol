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

export function breakerTitle(boardMode: string, gameNumber: number): string {
  const gn = gameNumber;
  if (gn === 6 || boardMode === "6x6") return "TIMEBREAKER";
  if (gn === 9 || boardMode === "7x7") return "MINDBREAKER";
  return "RULEBREAKER";
}
