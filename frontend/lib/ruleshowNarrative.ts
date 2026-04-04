/**
 * Rules copy for RuleshowScreen only — per leg / breaker, aligned with engine behaviour.
 * (RulesScreen.tsx remains the long-form “How to play”.)
 */
export type RuleshowRuleBlock = { id: string; title: string; detail: string };

export const RULESHOW_BLOCKS_5X5: RuleshowRuleBlock[] = [
  {
    id: "objective",
    title: "MATCH FORMAT",
    detail: `Ranked triple-leg matches are first to 5 series points. A game win is 1 point; a draw gives 0.5 to each player. The 5×5 leg is the first segment of the match (games 1–3 on this grid, with Rulebreaker before game 3 when the schedule requires it).`,
  },
  {
    id: "turns",
    title: "TURNS AND TIMER",
    detail: `P1 opens unless the schedule or Rulebreaker says otherwise. Players alternate placing on empty cells. Pieces cannot be moved. If your clock hits zero, you lose that game.`,
  },
  {
    id: "centre",
    title: "CENTRE RULE (C3 ON 5×5)",
    detail: `On 5×5 only: the centre cell (column C, row 3) is special for the opening move. If your very first stone of the game lands on C3, your opponent immediately gets 2 consecutive extra turns. After move one, C3 is normal.

In Rulebreaker before game 3 on this leg, the toss winner may block C3 for the first move.`,
  },
  {
    id: "line",
    title: "WIN: LINE",
    detail: `Five of your stones in one straight row — horizontal, vertical, or diagonal — with no gaps.`,
  },
  {
    id: "shapes",
    title: "WIN: SHAPE PATTERNS",
    detail: `Complete any legal 5-cell shape pattern recognised for this board (V, L, W, etc.). Rotations and reflections count.`,
  },
  {
    id: "chain",
    title: "WIN: FULL BOARD",
    detail: `If the board fills with no line or pattern win, the game is decided by longest connected chain of your stones (orthogonal + diagonal neighbours). On 5×5 the threshold is 10+ cells; ties resolve per engine rules.`,
  },
  {
    id: "rb",
    title: "RULEBREAKER (BEFORE GAME 3 HERE)",
    detail: `When the match flow schedules Rulebreaker on this leg, a coin toss and choices (who starts, C3 block, etc.) run before the next game on 5×5. Follow the on-screen Rulebreaker flow.`,
  },
];

export const RULESHOW_BLOCKS_6X6: RuleshowRuleBlock[] = [
  {
    id: "leg",
    title: "6×6 LEG",
    detail: `This segment uses a 6×6 grid. Wins still feed the same first-to-5 series. Games 4–6 of the overall match are typically played here before the next breaker (Timebreaker before game 6 on this leg when applicable).`,
  },
  {
    id: "turns",
    title: "TURNS AND TIMER",
    detail: `Standard alternating play and per-game clocks apply. Opening rules for 6×6 follow what the engine enforces (no 5×5 C3 bonus on this grid).`,
  },
  {
    id: "line",
    title: "WIN: LINE",
    detail: `Six of your stones in one straight line — horizontal, vertical, or diagonal — with no gaps.`,
  },
  {
    id: "shapes",
    title: "WIN: FIXED SHAPE PATTERNS",
    detail: `Exactly five mandatory 6-cell patterns are always active on 6×6 (Zigzag, P, T, L, Y and their symmetries). Complete any one as your stones — same as in the diagrams below.`,
  },
  {
    id: "chain",
    title: "WIN: FULL BOARD",
    detail: `If the grid fills with no prior win, longest connected chain decides the game; on 6×6 the chain threshold is 15+ cells unless the engine declares a draw.`,
  },
  {
    id: "timebreaker",
    title: "TIMEBREAKER (GAME 6 ON THIS LEG)",
    detail: `Before the third game on 6×6, Timebreaker runs: a coin toss picks a toss winner. They choose between (A) assigning the halved match clock (2:00) to one player for that game, or (B) entering the secret “special cell” path where the chooser picks a trapped cell — playing there transfers ownership of the stone to the trap owner. Follow the on-screen flow for exact picks.`,
  },
];

export const RULESHOW_BLOCKS_7X7: RuleshowRuleBlock[] = [
  {
    id: "leg",
    title: "7×7 LEG",
    detail: `This segment uses a 7×7 grid and structural pattern wins. Games 7–9 of the overall match are usually played here; Mindbreaker applies before game 9 on this leg when the flow requires it.`,
  },
  {
    id: "turns",
    title: "TURNS, TOKEN, OPENING",
    detail: `Alternating play with the match clock. The engine may grant a one-time extra-turn token on 7×7 (shown in-game when active). Centre / opening constraints follow the engine for this size — not the 5×5 C3 rule.`,
  },
  {
    id: "line",
    title: "WIN: LINE",
    detail: `Seven of your stones in one straight line — horizontal, vertical, or diagonal.`,
  },
  {
    id: "patterns",
    title: "WIN: STRUCTURAL PATTERNS",
    detail: `All listed 7-cell structural patterns shown below are in play for this match (server-authoritative set). Complete any one pattern with your stones; rotations and reflections count.`,
  },
  {
    id: "chain",
    title: "WIN: FULL BOARD",
    detail: `If the board fills with no prior win, longest connected chain at 20+ cells (or engine draw) resolves the game.`,
  },
  {
    id: "mindbreaker",
    title: "MINDBREAKER (GAME 9 ON THIS LEG)",
    detail: `Before the third game on 7×7, Mindbreaker runs: toss winner picks between the extra-turn token track or the pattern-ban track (hiding a pattern class from one side). Ban and token behaviour follow the on-screen Rulebreaker steps.`,
  },
];

export const RULESHOW_BLOCKS_PROTOCOLBREAKER: RuleshowRuleBlock[] = [
  {
    id: "what",
    title: "PROTOCOLBREAKER / LIMITBREAKER",
    detail: `If the series is still tied after nine decisive games on the triple-leg path, Protocolbreaker (shown here as Limitbreaker) decides the match with one final game (“game 10”).`,
  },
  {
    id: "flow",
    title: "WHAT HAPPENS",
    detail: `• A coin toss picks a toss winner.

• They choose a track:
  — Choose who plays first in the decider, then opponents alternate banning two board sizes, OR
  — Ban a board first, then the other player chooses who starts and bans the second board.

• Two of the three sizes (5×5, 6×6, 7×7) are banned. The remaining size is used for exactly one sudden-death game.`,
  },
  {
    id: "play",
    title: "DECIDER GAME",
    detail: `That final game uses normal rules for the surviving board size. Winner takes the match; there is no further escalation after this game.`,
  },
];

export type RuleshowSheetKind = "5x5" | "6x6" | "7x7" | "protocolbreaker";

export function getRuleshowBlocks(sheet: RuleshowSheetKind): RuleshowRuleBlock[] {
  switch (sheet) {
    case "5x5":
      return RULESHOW_BLOCKS_5X5;
    case "6x6":
      return RULESHOW_BLOCKS_6X6;
    case "7x7":
      return RULESHOW_BLOCKS_7X7;
    case "protocolbreaker":
      return RULESHOW_BLOCKS_PROTOCOLBREAKER;
    default:
      return RULESHOW_BLOCKS_5X5;
  }
}
