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
  RULES: "/rules",
  PATCHNOTES: "/patchnotes",
} as const;

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
  if (p.startsWith("/game/")) return "game";
  if (p === "/training" || p.startsWith("/training/")) return "singleplayer";
  if (p === "/challenge") return "ai";
  if (p.startsWith("/challenge/")) return "aiGame";
  if (p === "/missions" || p.startsWith("/missions/")) return "battlepass";
  if (p === "/collection" || p.startsWith("/collection/")) return "collection";
  if (p === "/store" || p.startsWith("/store/")) return "store";
  if (p === "/profile" || p.startsWith("/profile/")) return "profile";
  if (p === "/rules") return "rules";
  if (p === "/patchnotes") return "patchNotes";
  return "home";
}

/** Routes that guests (not signed in) are blocked from. */
export const GUEST_BLOCKED_SCREENS: Screen[] = ["lobby", "profile", "career", "battlepass"];
