/**
 * Compact rules copy for multiplayer RuleshowScreen (aligned with RulesScreen).
 * Images omitted; text only for parity with single-player “How to Play”.
 */
export type MultiplayerRuleBlock = { id: string; title: string; detail: string };

/** Core blocks shown above the pattern grid for every sheet (5×5 / 6×6 / 7×7). */
export const MULTIPLAYER_RULE_BLOCKS: MultiplayerRuleBlock[] = [
  {
    id: "objective",
    title: "OBJECTIVE",
    detail: `The goal of PentaProtocol is to outmaneuver your opponent by placing your pieces strategically. You win a game by completing one of the recognized winning patterns before your opponent does.

Each match is First-to-5 — the first player to accumulate 5 total points wins the series. A win grants 1 point. A drawn game awards 0.5 points to each player.`,
  },
  {
    id: "turns",
    title: "TAKING TURNS",
    detail: `P1 places first, then players alternate turns. On your turn, click any empty cell on the board to place your piece.

P1 and P2 use distinct piece styles (visuals depend on your theme).

You cannot skip a turn, and once placed a piece cannot be moved. The timer counts down during your turn — if it reaches zero, you forfeit that game.`,
  },
  {
    id: "centre",
    title: "CENTRE RULE (C3 ON 5×5)",
    detail: `On the 5×5 leg, the centre cell (column C, row 3) is a powerful position. If you place your very first piece of the game on C3, your opponent immediately receives 2 consecutive extra turns.

This applies only to the first move of each game on that board size. In Rulebreaker before Game 3, the toss winner may block C3 for the first move.

On 6×6 and 7×7 legs, follow the centre / opening rules enforced by the engine for that size.`,
  },
  {
    id: "win-line",
    title: "WIN: 5 IN A LINE",
    detail: `Place 5 of your pieces in a continuous straight line — horizontal, vertical, or diagonal. All 5 cells must be yours with no gaps.`,
  },
  {
    id: "win-pattern",
    title: "WIN: SHAPE PATTERNS",
    detail: `Complete a recognized shape with exactly 5 of your pieces — V / Chevron, L / Corner, W / Zigzag, Diagonal V, Zigzag Arrow, etc. All rotations and reflections count.`,
  },
  {
    id: "win-chain",
    title: "WIN: FULL BOARD (10-CELL CHAIN)",
    detail: `If the board fills with no prior win, the game resolves by longest connected chain (10+ cells), or a draw if rules dictate.`,
  },
  {
    id: "series",
    title: "MATCH FORMAT: FIRST TO 5",
    detail: `Each win is 1 point; each draw gives 0.5 to both players. First to 5 points wins the match. Games alternate starting players where applicable. Tiebreaker phases (Rulebreaker, etc.) use coin toss flow as in the main rules.`,
  },
];
