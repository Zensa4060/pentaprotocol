/**
 * AI bot roster + unlock chain — mirrors ``frontend/lib/botRewards.ts``
 * and the per-size difficulty mapping in ``frontend/components/AIScreen.tsx``.
 *
 * Unlock chains (sequential within each board size):
 *   5x5 : baltazar → salazar → jr     (always unlocked)
 *   6x6 : valdorin → eldorin → him     (unlocked after jr defeated)
 *   7x7 : seraphina → regina → her     (unlocked after him defeated)
 *
 * Each bot maps to a **backend-valid difficulty string** for its size
 * (this is the value POSTed to ``/api/bot/move``):
 *   5x5 : easy / medium / hard
 *   6x6 : hard / normal / machine_god   (6x6 validator rejects others → 422)
 *   7x7 : easy / hard / danger
 */

import type { BoardMode } from "@/lib/game/boardConfig";

export type BotBoardMode = "5x5" | "6x6" | "7x7";

export type BotId =
  | "baltazar" | "salazar" | "jr"
  | "valdorin" | "eldorin" | "him"
  | "seraphina" | "regina" | "her";

/** Every difficulty the backend bot routers accept across sizes. */
export type EngineDifficulty =
  | "easy" | "medium" | "normal" | "hard" | "machine_god" | "danger";

export interface BotCard {
  id: BotId;
  label: string;
  sub: string;
  difficulty: EngineDifficulty;
  color: string;
}

export const BOT_CHAIN_5X5: BotId[] = ["baltazar", "salazar", "jr"];
export const BOT_CHAIN_6X6: BotId[] = ["valdorin", "eldorin", "him"];
export const BOT_CHAIN_7X7: BotId[] = ["seraphina", "regina", "her"];

export const BOT_CHAINS: Record<BotBoardMode, BotId[]> = {
  "5x5": BOT_CHAIN_5X5,
  "6x6": BOT_CHAIN_6X6,
  "7x7": BOT_CHAIN_7X7,
};

export const BOTS_5X5: BotCard[] = [
  { id: "baltazar", label: "BALTAZAR", sub: "LEVEL 1", difficulty: "easy", color: "#22C55E" },
  { id: "salazar", label: "SALAZAR", sub: "LEVEL 10", difficulty: "medium", color: "#FFDD00" },
  { id: "jr", label: "JR.", sub: "LEVEL 100", difficulty: "hard", color: "#700B0B" },
];

export const BOTS_6X6: BotCard[] = [
  { id: "valdorin", label: "VALDORIN", sub: "LEVEL 1", difficulty: "hard", color: "#3A78D4" },
  { id: "eldorin", label: "ELDORIN", sub: "LEVEL 10", difficulty: "normal", color: "#FFDD00" },
  { id: "him", label: "HIM", sub: "LEVEL 100", difficulty: "machine_god", color: "#CC0000" },
];

export const BOTS_7X7: BotCard[] = [
  { id: "seraphina", label: "SERAPHINA", sub: "LEVEL 1", difficulty: "easy", color: "#22C55E" },
  { id: "regina", label: "REGINA", sub: "LEVEL 10", difficulty: "hard", color: "#700B0B" },
  { id: "her", label: "HER", sub: "LEVEL 100", difficulty: "danger", color: "#CC0000" },
];

export const BOTS_BY_MODE: Record<BotBoardMode, BotCard[]> = {
  "5x5": BOTS_5X5,
  "6x6": BOTS_6X6,
  "7x7": BOTS_7X7,
};

export const BOT_LABEL: Record<BotId, string> = {
  baltazar: "BALTAZAR",
  salazar: "SALAZAR",
  jr: "JR.",
  valdorin: "VALDORIN",
  eldorin: "ELDORIN",
  him: "HIM",
  seraphina: "SERAPHINA",
  regina: "REGINA",
  her: "HER",
};

/** Which board-mode chain a bot belongs to. */
export function botBoardMode(botId: BotId): BotBoardMode | null {
  for (const mode of ["5x5", "6x6", "7x7"] as BotBoardMode[]) {
    if (BOT_CHAINS[mode].includes(botId)) return mode;
  }
  return null;
}

/** The bot immediately before ``botId`` in its chain (null if first). */
export function prerequisiteBot(botId: BotId): BotId | null {
  const mode = botBoardMode(botId);
  if (!mode) return null;
  const chain = BOT_CHAINS[mode];
  const idx = chain.indexOf(botId);
  return idx > 0 ? chain[idx - 1] : null;
}

export function hasDefeated(
  defeated: Record<string, boolean> | undefined,
  botId: BotId,
): boolean {
  return !!defeated?.[botId];
}

/** Chain-level gate: 5x5 always; 6x6 after jr; 7x7 after him. */
export function isBoardModeUnlocked(
  defeated: Record<string, boolean> | undefined,
  mode: BotBoardMode,
): boolean {
  if (mode === "5x5") return true;
  if (mode === "6x6") return hasDefeated(defeated, "jr");
  return hasDefeated(defeated, "him");
}

/** The capstone bot that gates a board mode (for lock copy). */
export function boardModeGate(mode: BotBoardMode): BotId | null {
  if (mode === "6x6") return "jr";
  if (mode === "7x7") return "him";
  return null;
}

export function isBotUnlocked(
  defeated: Record<string, boolean> | undefined,
  botId: BotId,
): boolean {
  const mode = botBoardMode(botId);
  if (!mode) return false;
  if (!isBoardModeUnlocked(defeated, mode)) return false;
  const prev = prerequisiteBot(botId);
  if (!prev) return true;
  return hasDefeated(defeated, prev);
}

export function lockedByLabel(botId: BotId): string | null {
  const prev = prerequisiteBot(botId);
  return prev ? BOT_LABEL[prev] : null;
}

/** Roster for a board mode string. */
export function botsForMode(mode: BoardMode | BotBoardMode): BotCard[] {
  if (mode === "6x6") return BOTS_6X6;
  if (mode === "7x7") return BOTS_7X7;
  return BOTS_5X5;
}
