/**
 * AI Engine bot roster — mirrors ``frontend/lib/botRewards.ts``.
 *
 * Mobile v1 ships 7×7 only. The full web unlock chain normally
 * requires clearing 5×5 and 6×6 first; on mobile we always allow
 * the 7×7 chain so new installs can play, but sequential bot
 * unlocks within 7×7 still read ``user.bot_defeats`` from the API.
 */

export type BotId = "seraphina" | "regina" | "her";

export type EngineDifficulty = "easy" | "hard" | "danger";

export interface BotCard {
  id: BotId;
  label: string;
  sub: string;
  difficulty: EngineDifficulty;
  color: string;
}

export const BOT_CHAIN_7X7: BotId[] = ["seraphina", "regina", "her"];

export const BOT_LABEL: Record<BotId, string> = {
  seraphina: "SERAPHINA",
  regina: "REGINA",
  her: "HER",
};

export const BOTS_7X7: BotCard[] = [
  { id: "seraphina", label: "SERAPHINA", sub: "LEVEL 1", difficulty: "easy", color: "#22C55E" },
  { id: "regina", label: "REGINA", sub: "LEVEL 10", difficulty: "hard", color: "#700B0B" },
  { id: "her", label: "HER", sub: "LEVEL 100", difficulty: "danger", color: "#CC0000" },
];

export function prerequisiteBot(botId: BotId): BotId | null {
  const idx = BOT_CHAIN_7X7.indexOf(botId);
  if (idx <= 0) return null;
  return BOT_CHAIN_7X7[idx - 1];
}

export function hasDefeated(
  defeated: Record<string, boolean> | undefined,
  botId: BotId,
): boolean {
  return !!defeated?.[botId];
}

/** First bot in chain is always open; later bots need the previous defeat. */
export function isBotUnlocked(
  defeated: Record<string, boolean> | undefined,
  botId: BotId,
): boolean {
  const prev = prerequisiteBot(botId);
  if (!prev) return true;
  return hasDefeated(defeated, prev);
}

export function lockedByLabel(botId: BotId): string | null {
  const prev = prerequisiteBot(botId);
  return prev ? BOT_LABEL[prev] : null;
}
