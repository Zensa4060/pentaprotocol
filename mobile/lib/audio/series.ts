/**
 * Series ladder labels — mirrors web GameScreen leg / breaker mapping.
 */

export type BreakerKind = "rulebreaker" | "timebreaker" | "mindbreaker";

/** Which ProtocolBreaker variant applies at G2 / G5 / G8. */
export function breakerKindForGame(
  gameNumber: number,
  boardMode: string,
): BreakerKind | null {
  if (gameNumber !== 2 && gameNumber !== 5 && gameNumber !== 8) return null;
  if (boardMode === "7x7") return "mindbreaker";
  if (boardMode === "6x6") return "timebreaker";
  return "rulebreaker";
}

export function breakerDisplayName(kind: BreakerKind): string {
  switch (kind) {
    case "mindbreaker":
      return "Mindbreaker";
    case "timebreaker":
      return "Timebreaker";
    default:
      return "Rulebreaker";
  }
}

/** Leg game within current board size (G1–G3 on 5×5, G4–G6 on 6×6, G7–G9 on 7×7). */
export function legGameIndex(gameNumber: number): 1 | 2 | 3 {
  return (((gameNumber - 1) % 3) + 1) as 1 | 2 | 3;
}

export function legBoardLabel(boardMode: string): string {
  if (boardMode === "7x7") return "7×7";
  if (boardMode === "6x6") return "6×6";
  return "5×5";
}
