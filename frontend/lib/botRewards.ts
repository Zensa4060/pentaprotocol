/**
 * Bot-reward / unlock chain for AI matches.
 *
 * Unlock chains (sequential within each board size):
 *   5x5 : baltazar → salazar → jr
 *   6x6 : valdorin → eldorin → him   (locked until 5x5 cleared)
 *   7x7 : seraphina → regina → her   (locked until 6x6 cleared)
 *
 * XP rewards are granted ONCE on the first series victory against each bot.
 * Defeating all 9 bots unlocks a one-time "pick any banner free" store reward.
 *
 * The backend (`backend/app/core/bot_rewards.py`) MUST mirror these tables —
 * both are read when awarding XP and validating claims. Keep in sync.
 */

import type { BoardMode } from "@/lib/types";

/** Only the three pure board sizes have a bot roster. */
export type BotBoardMode = "5x5" | "6x6" | "7x7";

export type BotId =
  | "baltazar" | "salazar"   | "jr"
  | "valdorin" | "eldorin"   | "him"
  | "seraphina"| "regina"    | "her";

export const BOT_CHAIN_5X5: BotId[] = ["baltazar", "salazar", "jr"];
export const BOT_CHAIN_6X6: BotId[] = ["valdorin", "eldorin", "him"];
export const BOT_CHAIN_7X7: BotId[] = ["seraphina", "regina", "her"];

export const BOT_CHAINS: Record<BotBoardMode, BotId[]> = {
  "5x5": BOT_CHAIN_5X5,
  "6x6": BOT_CHAIN_6X6,
  "7x7": BOT_CHAIN_7X7,
};

export const ALL_BOT_IDS: BotId[] = [
  ...BOT_CHAIN_5X5,
  ...BOT_CHAIN_6X6,
  ...BOT_CHAIN_7X7,
];

/** XP awarded the first time each bot's series is won. */
export const BOT_XP_REWARD: Record<BotId, number> = {
  baltazar:  1000,
  salazar:   2000,
  jr:        4000,
  valdorin:  5000,
  eldorin:   8000,
  him:      10000,
  seraphina: 6000,
  regina:   10000,
  her:      15000,
};

/** Display label shown in the AI picker (mirrors AIScreen labels). */
export const BOT_LABEL: Record<BotId, string> = {
  baltazar:  "BALTAZAR",
  salazar:   "SALAZAR",
  jr:        "JR.",
  valdorin:  "VALDORIN",
  eldorin:   "ELDORIN",
  him:       "HIM",
  seraphina: "SERAPHINA",
  regina:    "REGINA",
  her:       "HER",
};

/** The bot immediately before `botId` in its chain (null if first in chain). */
export function prerequisiteBot(botId: BotId): BotId | null {
  for (const chain of Object.values(BOT_CHAINS)) {
    const idx = chain.indexOf(botId);
    if (idx > 0) return chain[idx - 1];
    if (idx === 0) return null;
  }
  return null;
}

/** Which board-mode chain a bot belongs to. */
export function botBoardMode(botId: BotId): BotBoardMode | null {
  for (const [mode, chain] of Object.entries(BOT_CHAINS) as [BotBoardMode, BotId[]][]) {
    if (chain.includes(botId)) return mode;
  }
  return null;
}

/** Did the player defeat `botId` (reads the user's server-persisted set)? */
export function hasDefeated(defeated: Record<string, boolean> | undefined, botId: BotId): boolean {
  if (!defeated) return false;
  return !!defeated[botId];
}

/**
 * A bot is "unlocked" iff:
 *   - it is the first bot in its chain AND the chain itself is unlocked, OR
 *   - the immediately prior bot in its chain has been defeated AND the chain is unlocked.
 *
 * Chain-level unlocks:
 *   - 5x5 chain: always unlocked.
 *   - 6x6 chain: unlocked after `jr` is defeated.
 *   - 7x7 chain: unlocked after `him` is defeated.
 */
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

/** Can the user even enter this board-mode chain? */
export function isBoardModeUnlocked(
  defeated: Record<string, boolean> | undefined,
  mode: BoardMode,
): boolean {
  if (mode === "5x5") return true;
  if (mode === "6x6") return hasDefeated(defeated, "jr");
  if (mode === "7x7") return hasDefeated(defeated, "him");
  // Combined-pattern modes (e.g. "5x5_6x6") are only used in multiplayer
  // variants — bots never run in those, so treat as locked.
  return false;
}

/** True if every bot has been defeated. */
export function allBotsDefeated(defeated: Record<string, boolean> | undefined): boolean {
  if (!defeated) return false;
  return ALL_BOT_IDS.every((id) => !!defeated[id]);
}

/** Gate-keeper label shown on a locked bot card. */
export function lockedByLabel(botId: BotId): string | null {
  const prev = prerequisiteBot(botId);
  if (prev) return BOT_LABEL[prev];
  const mode = botBoardMode(botId);
  if (mode === "6x6") return BOT_LABEL.jr;
  if (mode === "7x7") return BOT_LABEL.him;
  return null;
}

/** Friendly XP reward formatting (e.g. `+1,000 XP`). */
export function formatXpPrize(botId: BotId): string {
  return `+${BOT_XP_REWARD[botId].toLocaleString()} XP`;
}
