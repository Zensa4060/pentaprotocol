/**
 * Unranked queue bot fillers.
 *
 * While a user waits in the unranked queue, the AppShell races the real
 * matchmaker with a 1–10 s timer. If no human opponent is found first, a
 * synthetic bot "fills" the queue: the queue is quietly left, a VS card is
 * shown against a randomly-picked filler bot, and the user is routed into
 * a normal AI game with that bot as P2.
 *
 * The filler bot pool uses the user-supplied roster. Each bot is shown
 * with a random *level* (Rookie → Chronicle, plus a special Syros tier
 * at ~10 % weight) which drives the underlying engine difficulty per
 * board size. Levels intentionally reuse the rank palette (NavBar.RANKS)
 * so the VS card / in-game HUD can reuse the same badge styling.
 *
 * Nothing here is persisted or ranked — these games run through the
 * existing `gameMode: "ai"` code path, use `/api/bot/move`, and never
 * touch elo, rank, bot-rewards unlocks or mission progress.
 */

import type { Difficulty } from "@/lib/botEngine";
import type { BoardMode } from "@/lib/types";

/* ── Roster ─────────────────────────────────────────────────────────────── */

export const UNRANKED_BOT_NAMES = [
  "NADAF",
  "SARAH",
  "ANIRUDH",
  "ROXANNE",
  "ELINA",
  "SHARDUL",
  "SUSHRUTH",
  "NIHARIKA",
  "MAHIMNA",
  "YAGYA",
  "HARRISON",
  "ALEXIS",
  "MARK",
  "EDOUARD",
  "PAUL",
  "SANSKAR",
  "AKSHAY",
  "CHARLOTTE",
  "AMBRE",
  "PATRICIA",
  "MRINALINI",
  "PRARTHANA",
  "KEVIN",
] as const;

export type UnrankedBotName = (typeof UNRANKED_BOT_NAMES)[number];

/* ── Levels ─────────────────────────────────────────────────────────────── */

export const UNRANKED_BOT_LEVELS = [
  "ROOKIE",
  "SKILLED",
  "ELITE",
  "MYTHIC",
  "CRACKED",
  "CHRONICLE",
  "SYROS",
] as const;

export type UnrankedBotLevel = (typeof UNRANKED_BOT_LEVELS)[number];

/**
 * Numeric-level range shown on the match-found / VS card for each tier.
 * Unranked filler bots never have a real ELO, so we surface a "LEVEL NNN"
 * numeric readout instead (picked once at queue time). The ranges below
 * mirror the breakpoints the product asked for so the visible number
 * communicates relative strength at a glance:
 *
 *   ROOKIE     → LEVEL 1 – 10    (new-player lobby feel)
 *   SKILLED    → LEVEL 10 – 25   (casual)
 *   ELITE      → LEVEL 25 – 50   (strong casual)
 *   MYTHIC     → LEVEL 50 – 75   (high-level)
 *   CRACKED    → LEVEL 75 – 99   (sweaty)
 *   CHRONICLE  → LEVEL 100 – 500 (engine ceiling)
 *   SYROS     → LEVEL 1000      (fixed, boss tier)
 */
const LEVEL_NUMERIC_RANGE: Record<UnrankedBotLevel, [number, number]> = {
  ROOKIE:    [1, 10],
  SKILLED:   [10, 25],
  ELITE:     [25, 50],
  MYTHIC:    [50, 75],
  CRACKED:   [75, 99],
  CHRONICLE: [100, 500],
  SYROS:    [1000, 1000],
};

/** Pick a numeric level for a tier, uniformly distributed in that tier's range.
 *  Both endpoints inclusive. SYROS always returns 1000. */
export function numericLevelForTier(level: UnrankedBotLevel): number {
  const [min, max] = LEVEL_NUMERIC_RANGE[level];
  if (min >= max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Per-board-size Rust/Python engine difficulty keyed by level. Each tier is
 *  intentionally a blend of existing single-board personalities so a single
 *  filler bot can follow the full 5×5 → 6×6 → 7×7 series without ever
 *  feeling "off-tier" mid-leg:
 *
 *    ROOKIE     ← BALTAZAR   / VALDORIN   / SERAPHINA   (lightest)
 *    SKILLED    ← SALAZAR    / ELDORIN    / REGINA      (mid)
 *    MYTHIC     ← JR         / ELDORIN+   / REGINA+     (strong non-peak)
 *    CRACKED    ← JR         / HIM        / HER         (series peak)
 *    CHRONICLE  ← new blend: matches CRACKED on the engine side but is
 *                 flagged "chronicle" for future sharpening (reduced
 *                 think delay, aggressive openings) — the engine cap on
 *                 each board is already the hardest available today.
 *    SYROS     ← same top engines, but with a visibly faster think
 *                 animation and taunt bubbles (hidden boss tier).
 */
const LEVEL_DIFFICULTY_5X5: Record<UnrankedBotLevel, Difficulty> = {
  ROOKIE:    "easy",        // BALTAZAR (5×5 random-ish)
  SKILLED:   "medium",      // SALAZAR (depth-4 αβ)
  ELITE:     "medium",      // SALAZAR+ (depth-4 αβ, stricter selection)
  MYTHIC:    "hard",        // JR (depth-8 αβ)
  CRACKED:   "hard",        // JR (series peak)
  CHRONICLE: "hard",        // engine ceiling on 5×5 (→ depth-8 αβ)
  SYROS:    "hard",        // same engine, visibly faster
};

const LEVEL_DIFFICULTY_6X6: Record<UnrankedBotLevel, Difficulty> = {
  ROOKIE:    "hard",        // VALDORIN (Python easy_block)
  SKILLED:   "normal",      // ELDORIN (Rust hard)
  ELITE:     "normal",      // ELDORIN (Rust hard, same engine as SKILLED)
  MYTHIC:    "normal",      // ELDORIN+ (Rust hard)
  CRACKED:   "machine_god", // HIM (Rust machine god)
  CHRONICLE: "machine_god", // engine ceiling on 6×6
  SYROS:    "machine_god", // same engine, visibly faster
};

const LEVEL_DIFFICULTY_7X7: Record<UnrankedBotLevel, Difficulty> = {
  ROOKIE:    "easy",        // SERAPHINA (Bot7 easy)
  SKILLED:   "hard",        // REGINA (Rust hard)
  ELITE:     "hard",        // REGINA (Rust hard, shared ceiling with SKILLED)
  MYTHIC:    "hard",        // REGINA+ (Rust hard)
  CRACKED:   "danger",      // HER (Rust danger)
  CHRONICLE: "danger",      // engine ceiling on 7×7
  SYROS:    "danger",      // same engine, visibly faster
};

export type CoreBoardSize = "5x5" | "6x6" | "7x7";

export function difficultyForLevel(
  level: UnrankedBotLevel,
  boardSize: CoreBoardSize,
): Difficulty {
  if (boardSize === "7x7") return LEVEL_DIFFICULTY_7X7[level];
  if (boardSize === "6x6") return LEVEL_DIFFICULTY_6X6[level];
  return LEVEL_DIFFICULTY_5X5[level];
}

/** Narrow any BoardMode (including compound) to the single size used for
 *  the bot-filler match. For compound modes we fall back to the first leg. */
export function simpleSizeFromBoardMode(mode: BoardMode): CoreBoardSize {
  if (mode === "5x5" || mode === "6x6" || mode === "7x7") return mode;
  if (mode.startsWith("5x5")) return "5x5";
  if (mode.startsWith("6x6")) return "6x6";
  if (mode.startsWith("7x7")) return "7x7";
  return "5x5";
}

/* ── Random 5×5 pattern selection ──────────────────────────────────────────
 * Mirrors the server-side behaviour used by the real unranked matchmaker
 * (`backend/app/routers/room.py`: `random.sample(PATTERN_NAMES_5, 5)`).
 * For unranked filler-bot matches we need to pick patterns client-side so
 * we can (a) display them on the rules-show page and (b) forward them to
 * `/api/bot/move` so the bot respects the chosen pool. The shape pool
 * must stay in sync with the backend's `PATTERN_NAMES_5`. */
export const UNRANKED_5X5_PATTERN_POOL: readonly string[] = [
  "V",
  "L",
  "ZZ-5",
  "T",
  "LINE",
  "DIAGONAL",
] as const;

/** Core line patterns — always active on every grid, never deselectable or bannable. */
export const CORE_LINE_PATTERNS: readonly string[] = ["LINE", "DIAGONAL"] as const;
/** The 5×5 special pool — exactly one of these sits out of every match. */
export const SPECIAL_5X5_PATTERNS: readonly string[] = ["V", "L", "ZZ-5", "T"] as const;

export function isCoreLinePattern(id: string): boolean {
  const v = id.trim().toUpperCase();
  return v === "LINE" || v === "DIAGONAL";
}

/**
 * Active 5×5 set for a new match: LINE + DIAGONAL (core, always in) plus a
 * random 3 of the 4 special shapes — one special is always absent.
 */
export function pickRandomPatterns5x5(_count: number = 5): string[] {
  const pool = [...SPECIAL_5X5_PATTERNS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return [...pool.slice(0, 3), ...CORE_LINE_PATTERNS];
}

/* ── Level cosmetics (mirrors the rank palette) ─────────────────────────── */

export interface LevelStyle {
  /** Hex color used for VS glow, avatar ring, tier label. */
  color: string;
  /** Relative glow intensity (0 → none, 1 → Chronicle, >1 → Syros). */
  glow: number;
  /** Short human label drawn above the VS card avatar. */
  label: UnrankedBotLevel;
}

const LEVEL_STYLE: Record<UnrankedBotLevel, LevelStyle> = {
  ROOKIE:    { color: "#9CA3AF", glow: 0.3, label: "ROOKIE" },
  SKILLED:   { color: "#60A5FA", glow: 0.45, label: "SKILLED" },
  ELITE:     { color: "#A78BFA", glow: 0.55, label: "ELITE" },
  MYTHIC:    { color: "#10B981", glow: 0.65, label: "MYTHIC" },
  CRACKED:   { color: "#FF3333", glow: 0.85, label: "CRACKED" },
  CHRONICLE: { color: "#F59E0B", glow: 1.0, label: "CHRONICLE" },
  SYROS:    { color: "#9333EA", glow: 1.3, label: "SYROS" },
};

export function styleForLevel(level: UnrankedBotLevel): LevelStyle {
  return LEVEL_STYLE[level];
}

/* ── Random selection ───────────────────────────────────────────────────── */

/** Probability SYROS is picked as the level on a given queue. Kept low
 *  so SYROS stays a rare, memorable boss-tier encounter rather than a
 *  routine opponent. */
export const SYROS_CHANCE = 0.1;

/** Non-SYROS tiers, roughly descending in weight so Rookie/Skilled appear
 *  more often than Chronicle. */
const NORMAL_LEVEL_WEIGHTS: Array<{ level: UnrankedBotLevel; weight: number }> = [
  { level: "ROOKIE",    weight: 4 },
  { level: "SKILLED",   weight: 4 },
  { level: "ELITE",     weight: 3 },
  { level: "MYTHIC",    weight: 3 },
  { level: "CRACKED",   weight: 2 },
  { level: "CHRONICLE", weight: 1 },
];

function pickWeighted<T extends { weight: number }>(opts: T[]): T {
  const total = opts.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of opts) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return opts[opts.length - 1];
}

export interface PickedBot {
  /** Display name for the VS card / in-game HUD. Regular filler bots
   *  pull from `UNRANKED_BOT_NAMES`; the boss-tier SYROS overrides
   *  this to the literal string "SYROS" so it never inherits a
   *  human-roster name on the match-found screen. */
  name: UnrankedBotName | "SYROS";
  level: UnrankedBotLevel;
  /** Convenience: true iff `level === "SYROS"`. */
  isSyros: boolean;
}

/** Pick a random filler bot. ~SYROS_CHANCE of queues spawn the
 *  boss-tier SYROS instead of a normal roster name; everything else
 *  draws a name from `UNRANKED_BOT_NAMES` and a tier from the weighted
 *  pool. Safe to call repeatedly — pure RNG, no state. */
export function pickUnrankedBot(): PickedBot {
  const isSyros = Math.random() < SYROS_CHANCE;
  if (isSyros) {
    // SYROS is its own identity, not a roster member. Hard-coding the
    // name here keeps the VS card / sidebar / URL all consistent —
    // upstream code doesn't have to special-case "use SYROS instead
    // of the picked name". The literal "SYROS" widens
    // `PickedBot.name`'s type accordingly.
    return { name: "SYROS", level: "SYROS", isSyros: true };
  }
  const name =
    UNRANKED_BOT_NAMES[Math.floor(Math.random() * UNRANKED_BOT_NAMES.length)];
  const level = pickWeighted(NORMAL_LEVEL_WEIGHTS).level;
  return { name, level, isSyros: false };
}

/**
 * Minimum time (ms) the unranked queue waits before falling back to a
 * filler bot. Below this window we always favour real human matchmaking
 * — only after 10s without a human pairing does the bot timer fire.
 * Kept as a named constant so the lobby UI can show a consistent
 * "after ~10 seconds" hint to the player.
 */
export const UNRANKED_BOT_MIN_WAIT_MS = 10_000;

/**
 * Queue-wait time in ms before falling back to a filler bot, uniformly
 * distributed in [10s, 15s]. The window starts at the user-visible
 * 10-second floor so a real human still has the full 10s to be paired
 * before any bot is considered, and we stagger the upper bound up to
 * 15s so simultaneous filler timers don't all fire at the exact same
 * instant in load-test scenarios.
 */
export function pickQueueWaitMs(): number {
  const min = UNRANKED_BOT_MIN_WAIT_MS;
  const max = 15_000;
  return Math.floor(min + Math.random() * (max - min + 1));
}

/* ── User preference: allow filler bots in unranked queue ─────────────────── */

const PP_UNRANKED_BOTS_ENABLED_KEY = "pp_unranked_allow_bots";

/**
 * Whether the user has opted into bot fillers for unranked matchmaking.
 * Persisted in localStorage. Defaults to TRUE so first-time visitors
 * get the historic "queue auto-fills with a bot" behaviour without
 * having to discover the toggle. Setting this to false makes the
 * unranked queue wait indefinitely for a real human opponent — the
 * filler-bot timer in AppShell short-circuits when this returns false.
 */
export function isUnrankedBotsAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(PP_UNRANKED_BOTS_ENABLED_KEY);
  if (raw === null) return true;
  return raw === "1" || raw === "true";
}

export function setUnrankedBotsAllowed(allowed: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PP_UNRANKED_BOTS_ENABLED_KEY,
    allowed ? "1" : "0",
  );
  // Broadcast to any listening component so the lobby toggle and
  // matchmaking logic can react instantly to changes from other tabs
  // or remote storage events.
  window.dispatchEvent(new Event(PP_UNRANKED_BOTS_PREF_EVENT));
}

export const PP_UNRANKED_BOTS_PREF_EVENT = "pp_unranked_bots_pref_change";

/* ── Cosmetic profile assignment ────────────────────────────────────────── */

/** Fallback "profile picture" pool used for regular (non-SYROS) filler bots
 *  on the match-found screen. Filler bots don't have uploaded avatars, so we
 *  pick a random animal-ish emoji and render it in place of an <img>. The
 *  MatchPlayerCard honours a new `avatarEmoji` prop — see LobbyScreen.tsx. */
export const UNRANKED_BOT_EMOJI_POOL: readonly string[] = [
  "🐱", "🐶", "🦊", "🐯", "🐺", "🐭", "🐹", "🐰", "🦝", "🐻",
  "🐼", "🦁", "🐨", "🐷", "🐸", "🐵", "🐙", "🦄", "🦉", "🦅",
  "🐲", "🦈", "🦀", "🐢", "🦜", "🦋", "🦂", "🦖", "🐝", "🐌",
] as const;

export function pickUnrankedBotEmoji(): string {
  return UNRANKED_BOT_EMOJI_POOL[
    Math.floor(Math.random() * UNRANKED_BOT_EMOJI_POOL.length)
  ];
}

/** Pool of banner ids (keys of `BannerRenderer.BANNERS_DATA`) assigned to
 *  non-SYROS filler bots. Keep this list in sync with the real store —
 *  every id here must resolve in `BANNERS_DATA`. We intentionally skip
 *  "default" so filler bots always show a vivid animated banner. */
export const UNRANKED_BOT_BANNER_POOL: readonly string[] = [
  "blood_moon",
  "phantom_strike",

  "cryo_storm",
  "neon_circuit",
  "static_glitch",
  "golden_nexus",
  "plasma_core",
  "toxic_spill",
  "storm_protocol",
  "arctic_veil",
  "starfield",
  "digital_rain",
  "inferno",
] as const;

export function pickUnrankedBotBanner(): string {
  return UNRANKED_BOT_BANNER_POOL[
    Math.floor(Math.random() * UNRANKED_BOT_BANNER_POOL.length)
  ];
}

/* ── URL plumbing ──────────────────────────────────────────────────────── */

/** Build the `/game/{sizeKey}/{id}` URL that routes a filler-bot match
 *  through the existing AI game flow. All filler-specific metadata is
 *  encoded as query params so `(match)/layout.tsx` can wire it up without
 *  extending BOT_MAP.
 *
 *  `patterns` is an optional ordered 5×5 pattern pool (comma-joined ids,
 *  e.g. "V,L,T,LINE,DIAGONAL"). Encoding it here lets the match layout
 *  hydrate `selectedPatterns` directly from the URL and short-circuit
 *  the React/AppShell state race that used to leave the overlay with
 *  a stale 4-entry list. */
function buildUnrankedBotQueryString(params: {
  bot: PickedBot;
  boardSize: CoreBoardSize;
  patterns?: string[];
  /** Banner id already assigned to the bot at queue time. Encoded on the URL
   *  so the (match) layout can pipe it straight into GameScreen's `p2Banner`
   *  state without depending on AppShell's `matchupOpponent` (which is
   *  cleared once the VS timer elapses and the router navigates away). */
  botBanner?: string;
  /** Numeric level picked at queue time (1..1000). We keep it on the URL
   *  so a refresh on the rules-show / game page preserves the same level
   *  shown on the VS card — otherwise a remount would re-randomise it. */
  botLevel?: number;
  /** Emoji picked at queue time (non-SYROS filler bots only). Same
   *  rationale as `botBanner`: survive navigation. */
  botEmoji?: string;
}): string {
  const qs = new URLSearchParams({
    unranked_bot: "1",
    bot: params.bot.name.toLowerCase(),
    level: params.bot.level,
    size: params.boardSize,
    syros: params.bot.isSyros ? "1" : "0",
  });
  if (params.patterns && params.patterns.length > 0) {
    qs.set("patterns", params.patterns.join(","));
  }
  if (params.botBanner) qs.set("banner", params.botBanner);
  if (typeof params.botLevel === "number" && Number.isFinite(params.botLevel)) {
    qs.set("lvl", String(Math.floor(params.botLevel)));
  }
  if (params.botEmoji) qs.set("emoji", params.botEmoji);
  return qs.toString();
}

export function buildUnrankedBotGameUrl(params: {
  sizeKey: string; // "g1" | "g2" | "g3"
  gameId: string;
  bot: PickedBot;
  boardSize: CoreBoardSize;
  patterns?: string[];
  botBanner?: string;
  botLevel?: number;
  botEmoji?: string;
}): string {
  return `/game/${params.sizeKey}/${params.gameId}?${buildUnrankedBotQueryString(params)}`;
}

/** Build a direct-to-/rulesshow URL for unranked filler bots. Used to jump
 *  from the VS screen straight into the rules page (bypassing an intermediate
 *  /game/… frame) so the RulesShow overlay is visible immediately after
 *  match-found. The (match) layout renders GameScreen on this route just
 *  like /game/, so the AI flow continues unchanged. */
export function buildUnrankedBotRulesShowUrl(params: {
  gameId: string;
  bot: PickedBot;
  boardSize: CoreBoardSize;
  patterns?: string[];
  botBanner?: string;
  botLevel?: number;
  botEmoji?: string;
}): string {
  return `/rulesshow/${params.gameId}?${buildUnrankedBotQueryString(params)}`;
}

/* ── SYROS taunts ─────────────────────────────────────────────────────── */

/** Full SYROS taunt pool — one is picked uniformly at random each time
 *  a taunt fires. A future upgrade can replace the uniform RNG with a
 *  real move-quality heuristic (harsher lines after blunders, softer
 *  lines after decent moves). */
export const SYROS_TAUNTS: readonly string[] = [
  "Are you sure I'm the bot here?",
  "That move had confidence. Not accuracy.",
  "Interesting strategy. Not a good one, but interesting.",
  "I'll pretend that was a distraction tactic.",
  "You're playing 4D chess… unfortunately in the wrong dimension.",
  "That move reduces your win probability to 'optimistic.'",
  "I've seen better decisions from random number generators.",
  "Statistically speaking, that was unfortunate.",
  "You just helped me. Appreciate it.",
  "Prediction updated: you lose faster now.",
  "You trained for this?",
  "Blink twice if that was an accident.",
  "I'd ask 'why'… but I don't think there's an answer.",
  "That move belongs in a museum. As a warning.",
  "You vs me isn't a match. It's a lesson.",
  "Processing… yep, that was bad.",
  "I didn't even need to calculate that.",
  "Even my idle state plays better.",
  "You're making this too easy.",
  "At this rate, I might start feeling bad. Almost.",
  "You keep doing that. I keep winning.",
  "Pattern detected: bad moves.",
  "Consistency is key… unfortunately for you.",
  "Not your best move… but I respect the confidence.",
  "You're getting there. Slowly. Very slowly.",
  "I see the idea. Execution? Needs work.",
  "Bold choice. Let's call it… experimental.",
  "You almost had something there.",
  "I'll allow it. This time.",
  "You're learning. Painfully, but learning.",
  "That move had potential. Past tense.",
  "Better. Still losing, but better.",
  "You're making this interesting. Accidentally, but still.",
  "Suboptimal, but I appreciate the attempt.",
  "You're adapting. I've seen worse.",
  "Slight improvement. Continue.",
  "That move didn't collapse your position. Impressive.",
  "Acceptable. Don't get used to hearing that.",
] as const;

/** Probability a SYROS taunt fires after a given player move (cosmetic
 *  flavor — not every move should get a bubble). */
export const SYROS_TAUNT_FIRE_RATE = 0.6;

/** Pick a SYROS taunt uniformly at random from the pool. */
export function pickSyrosTaunt(): string {
  return SYROS_TAUNTS[Math.floor(Math.random() * SYROS_TAUNTS.length)];
}

/* ── SYROS presence ───────────────────────────────────────────────────── */

/** Public URL of the SYROS profile picture (served from
 *  `frontend/public/syros-pfp.png`). */
export const SYROS_PFP_URL = "/syros-pfp.png";

/** Longer in-match "analysis" lines narrated by SYROS. Unlike the quick
 *  taunts above, these read as detached philosophical commentary and are
 *  designed to rotate in the sidebar analysis card every few placements.
 *  Pure flavour — no game-state coupling. */
export const SYROS_ANALYSIS_LINES: readonly string[] = [
  "From above, their movements form patterns they themselves cannot see. What they call strategy is often just instinct dressed in confidence.",
  "They hesitate at the wrong moments and rush when patience would crown them. Mortals rarely lose to opponents. They lose to themselves.",
  "They pray for fortune, yet ignore the discipline that shapes it. Luck is merely the shadow cast by preparation.",
  "See how victory intoxicates them. A single triumph, and they forget how fragile their dominance truly is.",
  "Defeat is the only honest teacher they have. And still, they resist learning from it.",
  "They repeat the same battles, hoping for different outcomes. Persistence without reflection is just ritual.",
  "They believe they are adapting, yet they all follow the same evolving script. Even rebellion becomes predictable.",
  "No game is ever truly balanced. It merely shifts the illusion of fairness from one side to another.",
  "In the end, it is not the strongest who prevail, but the ones who understand the game beneath the game.",
] as const;

/** Deterministic scalar hash used to pick a stable-but-random analysis line
 *  for a given 5-move bucket. We need the output to be:
 *   (a) stable within a bucket — so re-renders inside the same 5-move
 *       window don't flicker to a different line mid-bucket,
 *   (b) varied across buckets — a simple `bucket % N` modulo lands on the
 *       same line repeatedly for small N, which is exactly what the
 *       product was pushing back on ("analysis of syros always shows this
 *       statement first"). A plain hash smears the index across the full
 *       pool so consecutive buckets feel independent.
 *
 * Implementation: a lightweight xorshift-ish mixer over `bucket` — good
 * enough for visual variety, zero dependencies. */
function hashBucket(bucket: number): number {
  let h = (bucket + 0x9e3779b1) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Per-tab session salt. Initialised lazily on first use so SSR builds
 *  don't burn entropy at module-load (and so the first call always
 *  happens client-side, where `Math.random()` is fine). The salt only
 *  matters when a caller doesn't provide its own `seed`; with a salt
 *  in play, every browser tab/session sees a different SYROS opener
 *  even if the caller forgot to pass a per-match seed. */
let _sessionSalt: number | null = null;
function getSessionSalt(): number {
  if (_sessionSalt === null) {
    _sessionSalt = (Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  return _sessionSalt;
}

/** Hash an arbitrary string seed (e.g. `gameId`) into a 32-bit unsigned
 *  number suitable for combining with the bucket index. Cheap polynomial
 *  rolling hash — collisions are fine here, we only need spread. */
function stringSeedToSalt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Resolve a caller-supplied seed (string | number | undefined) into a
 *  numeric salt. `undefined` → session-level salt fallback so the
 *  sequence still varies across browser sessions. */
function resolveSeedSalt(seed: string | number | undefined): number {
  if (seed === undefined) return getSessionSalt();
  if (typeof seed === "number") return seed >>> 0;
  return stringSeedToSalt(seed);
}

/** Return the analysis line for a given move counter. The pool is
 *  partitioned into buckets of `cadence` placements (default 5) and each
 *  bucket is mapped to a pseudo-random line via `hashBucket`. The output
 *  is stable within a bucket and spreads across the full pool as moves
 *  accumulate, which prevents the "always opens on the same line" feel.
 *
 *  `seed` (per-match identifier — usually the gameId) reshuffles the
 *  bucket→index mapping so two consecutive matches start on different
 *  lines and progress through different orderings. Without a seed the
 *  function falls back to a per-tab `getSessionSalt()` so even a stale
 *  caller still varies across sessions. */
export function syrosAnalysisForMove(
  movesPlayed: number,
  cadence: number = 5,
  seed?: string | number,
): string {
  if (SYROS_ANALYSIS_LINES.length === 0) return "";
  const step = Math.max(1, Math.floor(cadence));
  const bucket = Math.floor(Math.max(0, movesPlayed) / step);
  const salt = resolveSeedSalt(seed);
  const idx = hashBucket(bucket + salt) % SYROS_ANALYSIS_LINES.length;
  return SYROS_ANALYSIS_LINES[idx];
}

/** Same idea as `syrosAnalysisForMove`, but pulls from the short-form
 *  taunt pool (`SYROS_TAUNTS`). Used in SYROS encounters to power the
 *  in-sidebar "live chat" feed — the card rotates a fresh taunt every
 *  `cadence` placements so it reads like SYROS is actively trash-talking
 *  the player rather than narrating philosophical analysis.
 *
 *  We salt the bucket index (`+ 7919`) so the taunt rotation never
 *  aligns with `syrosAnalysisForMove`'s sequence — keeps the two feeds
 *  visually independent if both are ever surfaced together.
 *
 *  `seed` (per-match identifier) randomises the opener and the entire
 *  rotation order on a per-match basis. Without it, the function used to
 *  always open with the same taunt because `hashBucket(0 + 7919)` is a
 *  constant. With a per-`gameId` seed, every match's chat looks fresh. */
export function syrosTauntForMove(
  movesPlayed: number,
  cadence: number = 3,
  seed?: string | number,
): string {
  if (SYROS_TAUNTS.length === 0) return "";
  const step = Math.max(1, Math.floor(cadence));
  const bucket = Math.floor(Math.max(0, movesPlayed) / step);
  const salt = resolveSeedSalt(seed);
  const idx = hashBucket(bucket + 7919 + salt) % SYROS_TAUNTS.length;
  return SYROS_TAUNTS[idx];
}
