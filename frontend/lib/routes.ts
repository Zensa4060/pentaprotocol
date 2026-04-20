import { generateGameId } from "./gameId";
import type { BoardMode, Screen } from "./types";
import type { Difficulty } from "./botEngine";

/* ── Route path constants ─────────────────────────────────────────────────── */

export const ROUTES = {
  ROOT: "/",
  AUTH: "/auth",
  HOME: "/home",
  CAREER: "/career",
  PLAY_LOBBY: "/play/lobby",
  PLAY_MATCHFOUND: "/play/matchfound",
  UNRANKED_QUEUE: "/unranked/queue",
  RANKED_QUEUE: "/ranked/queue",
  CUSTOM_ROOM_CREATE: "/custom/room/create",
  TRAINING: "/training",
  TRAINING_5X5: "/training/5x5",
  TRAINING_6X6: "/training/6x6",
  TRAINING_7X7: "/training/7x7",
  CHALLENGE: "/challenge",
  MISSIONS: "/missions",
  MISSIONS_DAILY: "/missions/daily",
  MISSIONS_WEEKLY: "/missions/weekly",
  MISSIONS_PERMANENT: "/missions/permanent",
  COLLECTION: "/collection",
  COLLECTION_THEMES: "/collection/themes",
  COLLECTION_GRIDS: "/collection/grids",
  COLLECTION_BANNERS: "/collection/banners",
  COLLECTION_COINS: "/collection/coins",
  COLLECTION_BADGES: "/collection/badges",
  STORE: "/store",
  STORE_BUY_PS: "/store/buyps",
  STORE_BUY_PC: "/store/buypc",
  PROFILE: "/profile",
  PROFILE_EDIT: "/profile/edit",
  READY: "/ready",
  RULEBREAKER: "/rulebreaker",
  RULECHOICE: "/rulechoice",
  RULESSHOW: "/rulesshow",
  RULES: "/rules",
  PATCHNOTES: "/patchnotes",
  FRIENDS: "/friends",
} as const;

/**
 * Shell navbar destinations — prefetch these after boot so `router.push`
 * hits a warm cache and tab switches feel instant (no 2–3s cold load).
 */
export const MAIN_NAV_PREFETCH_PATHS: readonly string[] = [
  ROUTES.HOME,
  ROUTES.CAREER,
  ROUTES.PLAY_LOBBY,
  ROUTES.TRAINING,
  ROUTES.CHALLENGE,
  ROUTES.STORE,
  ROUTES.COLLECTION_THEMES,
  ROUTES.PROFILE,
  ROUTES.RULES,
  ROUTES.MISSIONS_DAILY,
  ROUTES.PATCHNOTES,
  ROUTES.FRIENDS,
  ROUTES.RANKED_QUEUE,
  ROUTES.UNRANKED_QUEUE,
  ROUTES.CUSTOM_ROOM_CREATE,
];

/* ── Bot-name ↔ (boardMode, difficulty) mapping ───────────────────────────── */

export const BOT_MAP: Record<string, { boardMode: "5x5" | "6x6" | "7x7"; difficulty: Difficulty }> = {
  baltazar:  { boardMode: "5x5", difficulty: "easy" },
  salazar:   { boardMode: "5x5", difficulty: "medium" },
  jr:        { boardMode: "5x5", difficulty: "hard" },
  valdorin:  { boardMode: "6x6", difficulty: "hard" },
  eldorin:   { boardMode: "6x6", difficulty: "normal" },
  him:       { boardMode: "6x6", difficulty: "machine_god" },
  seraphina: { boardMode: "7x7", difficulty: "easy" },
  regina:    { boardMode: "7x7", difficulty: "hard" },
  her:       { boardMode: "7x7", difficulty: "danger" },
};

export function difficultyToBotName(boardMode: BoardMode, difficulty: Difficulty): string {
  for (const [name, cfg] of Object.entries(BOT_MAP)) {
    if (cfg.boardMode === boardMode && cfg.difficulty === difficulty) return name;
  }
  return "baltazar";
}

/* ── Size-key helpers (g1 = 5×5, g2 = 6×6, g3 = 7×7) ────────────────────── */

export function boardModeToSizeKey(bm: BoardMode): "g1" | "g2" | "g3" {
  if (bm === "5x5" || bm.startsWith("5x5")) return "g1";
  if (bm === "6x6" || bm.startsWith("6x6")) return "g2";
  return "g3";
}

export function sizeKeyToBoardMode(key: string): BoardMode {
  if (key === "g1") return "5x5";
  if (key === "g2") return "6x6";
  return "7x7";
}

export function sizeKeyToSimple(key: string): "5x5" | "6x6" | "7x7" {
  if (key === "g1") return "5x5";
  if (key === "g2") return "6x6";
  return "7x7";
}

/* ── URL builders ─────────────────────────────────────────────────────────── */

export function buildGameUrl(boardMode: BoardMode, variant?: string): string {
  const id = generateGameId();
  const sk = boardModeToSizeKey(boardMode);
  return variant ? `/game/${sk}/${variant}/${id}` : `/game/${sk}/${id}`;
}

export function buildReadyUrl(id: string): string {
  return `${ROUTES.READY}/${id}`;
}

export function buildRulebreakerUrl(id: string): string {
  return `${ROUTES.RULEBREAKER}/${id}`;
}

export function buildRuleChoiceUrl(id: string): string {
  return `${ROUTES.RULECHOICE}/${id}`;
}

export function buildRulesShowUrl(id: string): string {
  return `${ROUTES.RULESSHOW}/${id}`;
}

/**
 * Build a bot game URL. Uses the same /game/g{n}/{15-digit-id} structure as
 * singleplayer/multiplayer games (chess.com-style) and carries the bot name
 * as a query parameter so the coin-toss flow & board size routing stay consistent.
 */
export function buildChallengeUrl(boardMode: BoardMode, difficulty: Difficulty): string {
  const bot = difficultyToBotName(boardMode, difficulty);
  const id = generateGameId();
  const sk = boardModeToSizeKey(boardMode);
  return `/game/${sk}/${id}?bot=${bot}`;
}

/** Build a legacy /challenge/{size}/{botname} URL — used only for redirects. */
export function buildLegacyChallengeUrl(boardMode: BoardMode, difficulty: Difficulty): string {
  const bot = difficultyToBotName(boardMode, difficulty);
  const size = boardMode === "5x5" ? "5x5" : boardMode === "6x6" ? "6x6" : "7x7";
  return `/challenge/${size}/${bot}`;
}

/**
 * Build a preview URL for a store item. Previews live under the store at
 * /store/preview/{slug} (e.g. /store/preview/sptheme, /store/preview/pxtheme,
 * /store/preview/glaciergrid, /store/preview/infernogrid).
 */
export function buildPreviewUrl(itemName: string): string {
  return `/store/preview/${itemName.toLowerCase().replace(/\s+/g, "")}`;
}

/** @deprecated Use buildPreviewUrl instead. */
export const buildStorePreviewUrl = buildPreviewUrl;

/* ── Screen ↔ URL mapping (for legacy setScreenAction compat) ─────────────── */

export function screenToUrl(screen: Screen): string | null {
  switch (screen) {
    case "home":
      return ROUTES.HOME;
    case "career":
      return ROUTES.CAREER;
    case "auth":
      return ROUTES.AUTH;
    case "lobby":
      return ROUTES.PLAY_LOBBY;
    case "singleplayer":
      return ROUTES.TRAINING;
    case "ai":
      return ROUTES.CHALLENGE;
    case "store":
      return ROUTES.STORE;
    case "collection":
      // Collection has no standalone index; always land on /collection/themes.
      return ROUTES.COLLECTION_THEMES;
    case "profile":
      return ROUTES.PROFILE;
    case "rules":
      return ROUTES.RULES;
    case "battlepass":
      // Missions has no standalone index; always land on /missions/daily.
      return ROUTES.MISSIONS_DAILY;
    case "patchNotes":
      return null; // new-tab
    case "friends":
      return ROUTES.FRIENDS;
    case "game":
    case "aiGame":
    case "multiGame":
      return null; // handled separately with URL builders
    default:
      return ROUTES.HOME;
  }
}

export function pathnameToScreen(p: string): Screen {
  if (p === "/" || p === "/auth") return "auth";
  if (p === "/home") return "home";
  if (p === "/career" || p.startsWith("/career/")) return "career";
  if (p.startsWith("/play/")) return "lobby";
  if (p.startsWith("/unranked/") || p.startsWith("/ranked/") || p.startsWith("/custom/")) return "lobby";
  if (
    p.startsWith("/game/") ||
    p.startsWith("/ready/") ||
    p.startsWith("/rulebreaker/") ||
    p.startsWith("/rulechoice/") ||
    p.startsWith("/rulesshow/")
  ) {
    return "game";
  }
  if (p === "/training" || p.startsWith("/training/")) return "singleplayer";
  if (p === "/challenge") return "ai";
  if (p.startsWith("/challenge/")) return "aiGame";
  if (p === "/missions" || p.startsWith("/missions/")) return "battlepass";
  if (p === "/collection" || p.startsWith("/collection/")) return "collection";
  if (p === "/store" || p.startsWith("/store/")) return "store";
  if (p === "/profile" || p.startsWith("/profile/")) return "profile";
  if (p === "/rules") return "rules";
  if (p === "/patchnotes") return "patchNotes";
  if (p === "/friends" || p.startsWith("/friends/")) return "friends";
  return "home";
}

export type MatchPhasePath = "game" | "ready" | "rulebreaker" | "rulechoice" | "rulesshow";

export interface ParsedMatchPath {
  phasePath: MatchPhasePath;
  gameId: string;
  boardMode: BoardMode | null;
  sizeKey: "g1" | "g2" | "g3" | null;
  variant?: string;
}

/**
 * Parse active match routes:
 * - /game/g{n}/{id}
 * - /game/g{n}/{variant}/{id}
 * - /ready/{id}
 * - /rulebreaker/{id}
 * - /rulechoice/{id}
 * - /rulesshow/{id}
 */
export function parseMatchPath(pathname: string): ParsedMatchPath | null {
  const [cleanPath] = pathname.split(/[?#]/);
  const parts = cleanPath.split("/").filter(Boolean);
  if (!parts.length) return null;

  const phaseHead = parts[0];
  if (phaseHead === "game") {
    const sizeKey = parts[1];
    if (sizeKey !== "g1" && sizeKey !== "g2" && sizeKey !== "g3") return null;

    if (parts.length === 3) {
      return {
        phasePath: "game",
        gameId: parts[2],
        boardMode: sizeKeyToBoardMode(sizeKey),
        sizeKey,
      };
    }

    if (parts.length >= 4) {
      return {
        phasePath: "game",
        gameId: parts[3],
        boardMode: sizeKeyToBoardMode(sizeKey),
        sizeKey,
        variant: parts[2],
      };
    }
    return null;
  }

  if (phaseHead === "ready" || phaseHead === "rulebreaker" || phaseHead === "rulechoice" || phaseHead === "rulesshow") {
    const gameId = parts[1];
    if (!gameId) return null;
    return {
      phasePath: phaseHead,
      gameId,
      boardMode: null,
      sizeKey: null,
    };
  }

  return null;
}

/** Routes that guests (not signed in) are blocked from. */
export const GUEST_BLOCKED_SCREENS: Screen[] = ["lobby", "profile", "career", "battlepass", "friends"];
