/**
 * Guided onboarding data — seven scripted "play & win" games across the three
 * boards, narrated by Syros. The player (P1) is shown the engine's best move as
 * a pulsing ring and can only advance through it; the opponent (P2) auto-replies.
 *
 *   5×5 (Baltazar tier): straight LINE · V-SHAPE pattern · 10-point connection
 *   6×6 (Valdorin tier): pattern DUAL-THREAT (no line) · 15-point connection
 *   7×7 (Seraphina tier): pattern DUAL-THREAT (no line) · 20-point connection
 *
 * Dual-threat (the real lesson): the opponent *blocks*, so a single threat is
 * useless. The fix is two win-patterns that share most of their cells, each
 * completed by a different empty cell — a fork the 1-ply blocking engine
 * (`backend/app/routers/bot.py`: try-win then try-block in row-major order)
 * cannot stop. It blocks one cell; you complete the other pattern.
 *   • 6×6: T-SHAPE {(0,0),(0,1),(0,2),(1,1),(2,1),(3,1)} and Y-SHAPE
 *     {(0,0),(1,1),(0,2),(2,1),(3,1),(4,1)} share 5 cells; T finishes at (0,1),
 *     Y finishes at (4,1). Bot blocks (0,1) (row-major first) → you play (4,1).
 *   • 7×7: V-SHAPE and Y-SHAPE share the (0,0)-(1,1)-(2,2) spine; V finishes at
 *     (3,3), Y at (2,4). Bot blocks (2,4) (earlier row) → you play (3,3).
 *
 * Connection games reuse the exact tutorial boards (`tutorialContent.ts`
 * 10/15/20-point examples) made playable: the player holds the winning chain
 * (a draw on the 6×6 board, where both sides reach 15). The opponent fills the
 * complement of the board, so only the player's cells + the chain are authored.
 *
 * Pattern cells come from `lib/patterns_metadata.ts` (the real win shapes).
 */

import type { BotId } from "@/lib/botRewards";
import type { DemoMove } from "@/lib/tutorialContent";

export type GuidedOutcome = "P1_WIN" | "DRAW";

export interface GuidedOpponent {
  id: BotId;
  label: string;
  /** Accent used for the opponent's stones / VS card glow. */
  color: string;
}

export interface GuidedGame {
  id: string;
  size: 5 | 6 | 7;
  opponent: GuidedOpponent;
  patterns?: string[];
  /** Scripted alternating moves. P1 = the player (hinted); P2 = opponent (auto). */
  moves: DemoMove[];
  /** Syros narration keyed by the active move index (0-based). */
  narration: Record<number, string>;
  outcome: GuidedOutcome;
  /** Win visualisation on completion (use whichever fits the game). */
  winLine?: { from: [number, number]; to: [number, number] };
  /** Ring these cells — a pattern win (V / T / Y …). */
  winPattern?: Array<[number, number]>;
  /** Polyline through the winning connected chain (connection games). */
  winPath?: Array<[number, number]>;
  /** The pattern the opponent blocked — dim-ringed to show the fork. */
  blockedPattern?: Array<[number, number]>;
  /** The two live threat cells, ringed gold during the fork. */
  dualThreatCells?: Array<[number, number]>;
  intro: string;
  outro: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Interleave player-first into an alternating P1/P2 move script. */
function interleave(
  player: Array<[number, number]>,
  opponent: Array<[number, number]>,
): DemoMove[] {
  const out: DemoMove[] = [];
  const n = Math.max(player.length, opponent.length);
  for (let i = 0; i < n; i++) {
    if (i < player.length) out.push({ r: player[i][0], c: player[i][1], p: "P1" });
    if (i < opponent.length) out.push({ r: opponent[i][0], c: opponent[i][1], p: "P2" });
  }
  return out;
}

/** All grid cells not in `taken` (row-major) — the opponent fills these. */
function complement(size: number, taken: Array<[number, number]>): Array<[number, number]> {
  const set = new Set(taken.map(([r, c]) => `${r},${c}`));
  const out: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!set.has(`${r},${c}`)) out.push([r, c]);
    }
  }
  return out;
}

/* ── 5×5 · GAME 1 — straight line (Baltazar) ─────────────────────────────── */
const G5_LINE: GuidedGame = {
  id: "g5-line",
  size: 5,
  opponent: { id: "baltazar", label: "BALTAZAR", color: "#22C55E" },
  patterns: ["LINE", "DIAGONAL"],
  intro: "We begin on 5 by 5. Baltazar moves without a plan. Take the simplest win — a straight line.",
  moves: [
    { r: 2, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
    { r: 2, c: 1, p: "P1" }, { r: 0, c: 4, p: "P2" },
    { r: 2, c: 2, p: "P1" }, { r: 4, c: 0, p: "P2" },
    { r: 2, c: 3, p: "P1" }, { r: 4, c: 4, p: "P2" },
    { r: 2, c: 4, p: "P1" },
  ],
  narration: {
    0: "Place your stone on the centre row. We build a line of five.",
    4: "Three in a row. Baltazar guards corners, not you.",
    6: "Four. One cell remains.",
    8: "Five in a row. The instant a line closes, the game is yours.",
  },
  outcome: "P1_WIN",
  winLine: { from: [2, 0], to: [2, 4] },
  outro: "A line win. Simple, because Baltazar allowed it. Now learn a shape.",
};

/* ── 5×5 · GAME 2 — V-shape pattern ──────────────────────────────────────── */
const G5_V: GuidedGame = {
  id: "g5-v",
  size: 5,
  opponent: { id: "baltazar", label: "BALTAZAR", color: "#22C55E" },
  patterns: ["V", "LINE", "DIAGONAL"],
  intro: "A line is not the only win. Geometry wins too. Build the V-shape.",
  moves: [
    { r: 0, c: 0, p: "P1" }, { r: 4, c: 0, p: "P2" },
    { r: 1, c: 1, p: "P1" }, { r: 4, c: 4, p: "P2" },
    { r: 2, c: 2, p: "P1" }, { r: 4, c: 2, p: "P2" },
    { r: 1, c: 3, p: "P1" }, { r: 3, c: 0, p: "P2" },
    { r: 0, c: 4, p: "P1" },
  ],
  narration: {
    0: "Start at the top-left corner. This stone is the tip of the V.",
    2: "Down into the valley.",
    4: "The bottom of the V — the centre.",
    6: "Now climb back up the other side.",
    8: "V-shape complete. A pattern win counts exactly like a line.",
  },
  outcome: "P1_WIN",
  winPattern: [
    [0, 0],
    [1, 1],
    [2, 2],
    [1, 3],
    [0, 4],
  ],
  outro: "Shapes give you more ways to win — and harder threats to see. Remember the V.",
};

/* ── 5×5 · GAME 3 — 10-point connection (tutorial board, you win) ─────────── */
const G5_CONN_PLAYER: Array<[number, number]> = [
  [0, 2], [0, 4], [1, 0], [1, 1], [1, 3], [1, 4], [2, 2],
  [3, 0], [3, 1], [3, 2], [4, 1], [4, 3],
];
const G5_CONN: GuidedGame = {
  id: "g5-conn",
  size: 5,
  opponent: { id: "jr", label: "JR.", color: "#A855F7" },
  patterns: ["LINE", "DIAGONAL"],
  intro: "Hard play, now. When the board fills with no line or shape, the longest connected chain wins — 10 cells on 5 by 5. Fill the board; keep your stones touching.",
  moves: interleave(G5_CONN_PLAYER, complement(5, G5_CONN_PLAYER)),
  narration: {
    0: "Place each stone so it touches your others — edges and corners both count.",
    12: "Keep the chain unbroken. Diagonals link your stones together.",
  },
  outcome: "P1_WIN",
  winPath: [
    [0, 4], [1, 4], [1, 3], [0, 2], [1, 1], [2, 2], [3, 1], [3, 0], [4, 1], [3, 2], [4, 3],
  ],
  outro: "Eleven connected stones — past the ten you needed. No line, no shape, yet you won by connection.",
};

/* ── 6×6 · GAME 4 — pattern dual-threat (Valdorin blocks) ─────────────────── */
const G6_FORK: GuidedGame = {
  id: "g6-fork",
  size: 6,
  opponent: { id: "valdorin", label: "VALDORIN", color: "#3A78D4" },
  intro: "6 by 6. No lines here — Valdorin blocks them on sight. We win with two shapes at once.",
  moves: [
    { r: 0, c: 0, p: "P1" }, { r: 5, c: 0, p: "P2" },
    { r: 1, c: 1, p: "P1" }, { r: 5, c: 5, p: "P2" },
    { r: 0, c: 2, p: "P1" }, { r: 0, c: 5, p: "P2" },
    { r: 2, c: 1, p: "P1" }, { r: 4, c: 5, p: "P2" },
    { r: 3, c: 1, p: "P1" }, { r: 0, c: 1, p: "P2" },
    { r: 4, c: 1, p: "P1" },
  ],
  narration: {
    0: "Forget lines. These stones will form a T and a Y — and they overlap.",
    4: "Five stones now belong to both shapes at once.",
    8: "Both shapes need one more cell. The T needs the top. The Y needs the foot. Valdorin can block only one.",
    9: "He blocks the T. He had to choose — and he chose wrong.",
    10: "Y-shape complete. One threat blocked, the other won. That is a dual threat.",
  },
  outcome: "P1_WIN",
  winPattern: [
    [0, 0],
    [1, 1],
    [0, 2],
    [2, 1],
    [3, 1],
    [4, 1],
  ],
  blockedPattern: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  dualThreatCells: [
    [0, 1],
    [4, 1],
  ],
  outro: "Against a defender, one threat dies. Two threats win. This is the heart of the game.",
};

/* ── 6×6 · GAME 5 — 15-point connection (tutorial board, a draw) ──────────── */
const G6_CONN_PLAYER: Array<[number, number]> = [
  [0, 0], [0, 1], [0, 2], [0, 4], [1, 2], [1, 5], [2, 0], [2, 3], [3, 2], [3, 4],
  [3, 5], [4, 0], [4, 1], [4, 3], [4, 5], [5, 0], [5, 3], [5, 4], [5, 5],
];
const G6_CONN: GuidedGame = {
  id: "g6-conn",
  size: 6,
  opponent: { id: "eldorin", label: "ELDORIN", color: "#FBBF24" },
  intro: "On 6 by 6 the chain threshold is 15. Both of you are strong here — watch what happens when you each reach it.",
  moves: interleave(G6_CONN_PLAYER, complement(6, G6_CONN_PLAYER)),
  narration: {
    0: "Build one long connected mass. Fifteen touching stones takes the game.",
    18: "You have your fifteen. But so does Eldorin.",
  },
  outcome: "DRAW",
  winPath: [
    [0, 0], [0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [4, 3], [3, 2], [4, 1], [4, 0],
  ],
  outro: "Both chains reached 15. When both of you convert, no one wins — it is a draw. Connection is a race, not a guarantee.",
};

/* ── 7×7 · GAME 6 — pattern dual-threat (Seraphina blocks) ────────────────── */
const G7_FORK: GuidedGame = {
  id: "g7-fork",
  size: 7,
  opponent: { id: "seraphina", label: "SERAPHINA", color: "#FF6B35" },
  intro: "7 by 7. Seraphina defends shapes too. So we hide two shapes inside one diagonal.",
  moves: [
    { r: 0, c: 0, p: "P1" }, { r: 0, c: 6, p: "P2" },
    { r: 1, c: 1, p: "P1" }, { r: 1, c: 6, p: "P2" },
    { r: 2, c: 3, p: "P1" }, { r: 0, c: 5, p: "P2" },
    { r: 3, c: 1, p: "P1" }, { r: 1, c: 5, p: "P2" },
    { r: 4, c: 0, p: "P1" }, { r: 5, c: 6, p: "P2" },
    { r: 4, c: 2, p: "P1" }, { r: 6, c: 6, p: "P2" },
    { r: 5, c: 1, p: "P1" }, { r: 6, c: 5, p: "P2" },
    { r: 6, c: 0, p: "P1" }, { r: 5, c: 5, p: "P2" },
    { r: 2, c: 2, p: "P1" }, { r: 2, c: 4, p: "P2" },
    { r: 3, c: 3, p: "P1" },
  ],
  narration: {
    0: "Lay the diagonal spine — top-left, heading down.",
    8: "A V-shape and a Y-shape grow from the same spine, sharing three cells.",
    16: "This stone finishes the spine. Now the V needs one cell, the Y needs another.",
    17: "Seraphina blocks the Y. She cannot reach the V as well.",
    18: "V-shape complete, corner to centre. Two threats, one defender — the defender loses.",
  },
  outcome: "P1_WIN",
  winPattern: [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 1],
    [6, 0],
  ],
  blockedPattern: [
    [0, 0],
    [1, 1],
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 1],
    [4, 0],
  ],
  dualThreatCells: [
    [3, 3],
    [2, 4],
  ],
  outro: "The board grew, the principle did not. Two patterns, shared cells, one wins. You are ready for the connection.",
};

/* ── 7×7 · GAME 7 — 20-point connection (tutorial board, you win) ─────────── */
const G7_CONN_PLAYER: Array<[number, number]> = [
  [0, 1], [0, 3], [0, 5],
  [1, 0], [1, 1], [1, 4], [1, 5],
  [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 0], [3, 5], [3, 6],
  [4, 0], [4, 2], [4, 5], [4, 6],
  [5, 0], [5, 1], [5, 2],
  [6, 3], [6, 4], [6, 5],
];
const G7_CONN: GuidedGame = {
  id: "g7-conn",
  size: 7,
  opponent: { id: "regina", label: "REGINA", color: "#A78BFA" },
  intro: "The largest board, the highest threshold — 20 connected stones. Hold your stones together and fill the board.",
  moves: interleave(G7_CONN_PLAYER, complement(7, G7_CONN_PLAYER)),
  narration: {
    0: "Twenty touching stones. Keep them adjacent — never spread thin.",
    24: "Your chain crosses the board. Twenty cells, all connected.",
  },
  outcome: "P1_WIN",
  winPath: [
    [0, 3], [1, 4], [0, 5], [1, 5], [2, 4], [2, 3], [2, 2], [1, 1], [0, 1], [1, 0], [2, 1], [3, 0], [4, 0], [5, 0], [5, 1], [4, 2], [5, 2], [6, 3], [6, 4], [6, 5],
  ],
  outro: "Twenty connected — the hardest threshold, met. You have won by line, by shape, by dual threat, and by connection. Enough.",
};

export const GUIDED_GAMES: GuidedGame[] = [
  G5_LINE,
  G5_V,
  G5_CONN,
  G6_FORK,
  G6_CONN,
  G7_FORK,
  G7_CONN,
];

/* ── The home tour ──────────────────────────────────────────────────────── */

export type TourTarget =
  | "home-play"
  | "home-training"
  | "home-bots"
  | "home-store"
  | "home-collection"
  | "nav-home"
  | "nav-friends"
  | "nav-missions"
  | "nav-profile"
  | "currency";

export interface TourStep {
  target: TourTarget;
  title: string;
  line: string;
}

export const HOME_TOUR: TourStep[] = [
  {
    target: "home-play",
    title: "PLAY ONLINE",
    line: "Play Online. Ranked and unranked humans. Your rating is won and lost here.",
  },
  {
    target: "home-training",
    title: "TRAINING",
    line: "Training. Drill the boards with nothing at stake.",
  },
  {
    target: "home-bots",
    title: "AI BOTS",
    line: "The bot ladder. Named opponents, each harder than the last. Defeat them in order. I wait at the end.",
  },
  {
    target: "home-store",
    title: "STORE",
    line: "The Store. Themes and banners. Appearance only — it changes nothing on the board.",
  },
  {
    target: "home-collection",
    title: "COLLECTION",
    line: "Your Collection. Everything you own. Equip it here.",
  },
  {
    target: "currency",
    title: "CURRENCIES",
    line: "Shards and Protocredits. Earn them, spend them on appearance. Nothing more.",
  },
  {
    target: "nav-home",
    title: "HOME",
    line: "Home. Every path begins here.",
  },
  {
    target: "nav-friends",
    title: "FRIENDS",
    line: "Friends. Add them by code. Challenge them directly.",
  },
  {
    target: "nav-missions",
    title: "MISSIONS",
    line: "Missions. Objectives that grant experience.",
  },
  {
    target: "nav-profile",
    title: "PROFILE",
    line: "Profile. Your identity, your security, your equipped cosmetics.",
  },
];

export const TOUR_OUTRO =
  "You know the boards. You know the screens. The Protocol is open to you now. Do not waste my instruction.";
