/**
 * Guided onboarding data — the three "play & win" games + the home tour.
 *
 * A brand-new user plays one short game on each board against the lightest
 * bot in that tier (Baltazar 5×5 → Valdorin 6×6 → Seraphina 7×7), guided the
 * whole way by Syros. Each game is scripted: the player (P1) is shown the
 * engine's best move as a pulsing ring and can only advance through it, while
 * the opponent (P2) auto-replies — so the win is 100% guaranteed. The final
 * line is a *real* winning line on each board, so the same scripts stay valid
 * if/when a live win-check is layered on top (the "hybrid" requirement).
 *
 * Narration is delivered by Syros via the browser TTS voice (`useSyrosVoice`)
 * with the same text on screen.
 *
 * NOTE on the dual-threat lesson (6×6 / 7×7): the scripts below win on a clean
 * straight line and *teach* the dual-threat idea through narration +
 * `dualThreatCells` highlights. Turning the opponent into a true blocker that
 * forces a real fork must be authored against the live engine win-checker —
 * see TODO(integration) — because line length equals board width here, so the
 * classic "open four" fork does not exist and forks must come from two
 * intersecting line/pattern threats. Refine the scripts while running the
 * dev board so the engine validates each finish.
 */

import type { BotId } from "@/lib/botRewards";
import type { DemoMove } from "@/lib/tutorialContent";

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
  /** Active pattern ids for the board. 5×5 needs an explicit pool; 6/7 use
   *  their full default set (left undefined → caller fills defaults). */
  patterns?: string[];
  /** Scripted alternating moves. Even (P1) = the player (hinted); odd (P2) =
   *  the opponent (auto-played). */
  moves: DemoMove[];
  /** Syros narration keyed by the move index it accompanies (0-based). The
   *  line shows/speaks as that move becomes the active step. */
  narration: Record<number, string>;
  /** Decisive line drawn on completion. */
  winLine: { from: [number, number]; to: [number, number] };
  /** Two threat cells spotlighted for the dual-threat lesson (6×6 / 7×7). */
  dualThreatCells?: Array<[number, number]>;
  /** Syros line before the first move. */
  intro: string;
  /** Syros line after the win. */
  outro: string;
}

/* ── 5×5 · Baltazar — the basic line win ─────────────────────────────────────
 * Player builds the centre row; Baltazar (random/harmless) guards the corners
 * and never contests the line. Verified winning line (mirrors the existing
 * tutorial `practice-5x5-win`). */
const GAME_5X5: GuidedGame = {
  id: "guided-5x5",
  size: 5,
  opponent: { id: "baltazar", label: "BALTAZAR", color: "#22C55E" },
  patterns: ["LINE", "DIAGONAL"],
  intro:
    "We begin on the 5 by 5 board. Your opponent is Baltazar. He moves without a plan. Take the line.",
  moves: [
    { r: 2, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
    { r: 2, c: 1, p: "P1" }, { r: 0, c: 4, p: "P2" },
    { r: 2, c: 2, p: "P1" }, { r: 4, c: 0, p: "P2" },
    { r: 2, c: 3, p: "P1" }, { r: 4, c: 4, p: "P2" },
    { r: 2, c: 4, p: "P1" },
  ],
  narration: {
    0: "Place your stone on the centre row. We are building a line of five.",
    2: "Again, beside it. Baltazar guards a corner. He does not guard you.",
    4: "Three in a row. He still does not see it.",
    6: "Four. One cell remains.",
    8: "Five in a row. The moment a line closes, the game is over. You win.",
  },
  winLine: { from: [2, 0], to: [2, 4] },
  outro: "That is a line win. Simple, because Baltazar let it be simple. The next one will not.",
};

/* ── 6×6 · Valdorin — introduce the dual threat ──────────────────────────────
 * TODO(integration): make Valdorin actually block one threat and force a real
 * fork validated by the engine. For now the win is a clean six-in-a-row and the
 * dual-threat idea is taught via narration + `dualThreatCells`. */
const GAME_6X6: GuidedGame = {
  id: "guided-6x6",
  size: 6,
  opponent: { id: "valdorin", label: "VALDORIN", color: "#3A78D4" },
  intro:
    "The 6 by 6 board. Valdorin is here. He blocks. A single threat is not enough against him — you must build two.",
  moves: [
    { r: 3, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
    { r: 3, c: 1, p: "P1" }, { r: 0, c: 5, p: "P2" },
    { r: 3, c: 2, p: "P1" }, { r: 5, c: 0, p: "P2" },
    { r: 3, c: 3, p: "P1" }, { r: 5, c: 5, p: "P2" },
    { r: 3, c: 4, p: "P1" }, { r: 1, c: 1, p: "P2" },
    { r: 3, c: 5, p: "P1" },
  ],
  narration: {
    0: "Build along the centre row, as before. But watch what Valdorin does.",
    4: "Three. Now you threaten the row. A weaker mind would defend only this.",
    6: "Here is the lesson: leave two ways to win. If he blocks one, you take the other.",
    8: "Two threats are live at once. Valdorin can stop one. Not both.",
    10: "Six in a row. He blocked the wrong threat. That is the dual threat.",
  },
  winLine: { from: [3, 0], to: [3, 5] },
  dualThreatCells: [
    [3, 4],
    [3, 5],
  ],
  outro:
    "Against anyone who defends, the single threat dies. The double threat does not. Remember it.",
};

/* ── 7×7 · Seraphina — reinforce the dual threat ─────────────────────────────
 * First move is off-centre (3,0) so the centre-rule penalty (opening on D4)
 * never triggers. TODO(integration): same as 6×6 — upgrade to an engine-true
 * fork with Seraphina blocking. */
const GAME_7X7: GuidedGame = {
  id: "guided-7x7",
  size: 7,
  opponent: { id: "seraphina", label: "SERAPHINA", color: "#FF6B35" },
  intro:
    "The 7 by 7 board. Seraphina defends well. The board is larger, so your threats can be wider. Build two again.",
  moves: [
    { r: 3, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
    { r: 3, c: 1, p: "P1" }, { r: 6, c: 6, p: "P2" },
    { r: 3, c: 2, p: "P1" }, { r: 0, c: 6, p: "P2" },
    { r: 3, c: 3, p: "P1" }, { r: 6, c: 0, p: "P2" },
    { r: 3, c: 4, p: "P1" }, { r: 1, c: 1, p: "P2" },
    { r: 3, c: 5, p: "P1" }, { r: 5, c: 5, p: "P2" },
    { r: 3, c: 6, p: "P1" },
  ],
  narration: {
    0: "Begin away from the centre. Opening on the true centre would hand Seraphina extra turns.",
    6: "Do not commit to one line. Keep a second threat alive on the flank.",
    8: "Seraphina sees the row and moves to block. Let her. Your other threat still stands.",
    10: "She defended one side. The other is open.",
    12: "Seven in a row. The same lesson, a larger board. Win conditions grow; the principle does not.",
  },
  winLine: { from: [3, 0], to: [3, 6] },
  dualThreatCells: [
    [3, 5],
    [3, 6],
  ],
  outro:
    "You have won on every board. You understand the line, and the threat that cannot be stopped. Enough lessons.",
};

export const GUIDED_GAMES: GuidedGame[] = [GAME_5X5, GAME_6X6, GAME_7X7];

/* ── The home tour ──────────────────────────────────────────────────────────
 * Run after the three games, on the Home screen. Each step spotlights a target
 * element (matched by `target` key on each platform) and Syros narrates it.
 * Targets that don't exist on a given platform are skipped by the tour runner.
 */

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

/** Syros's closing line once the tour ends and the player is set loose. */
export const TOUR_OUTRO =
  "You know the boards. You know the screens. The Protocol is open to you now. Do not waste my instruction.";
