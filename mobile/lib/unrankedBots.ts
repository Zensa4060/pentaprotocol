/**
 * Unranked queue bot fillers — ported from ``frontend/lib/unrankedBots.ts``.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { EngineDifficulty } from "@/lib/botRewards";
import { pickMatchPatterns5 } from "@/lib/game/boardConfig";
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

const LEVEL_NUMERIC_RANGE: Record<UnrankedBotLevel, [number, number]> = {
  ROOKIE: [1, 10],
  SKILLED: [10, 25],
  ELITE: [25, 50],
  MYTHIC: [50, 75],
  CRACKED: [75, 99],
  CHRONICLE: [100, 500],
  SYROS: [1000, 1000],
};

export function numericLevelForTier(level: UnrankedBotLevel): number {
  const [min, max] = LEVEL_NUMERIC_RANGE[level];
  if (min >= max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

const LEVEL_DIFFICULTY_5X5: Record<UnrankedBotLevel, EngineDifficulty> = {
  ROOKIE: "easy",
  SKILLED: "medium",
  ELITE: "medium",
  MYTHIC: "hard",
  CRACKED: "hard",
  CHRONICLE: "hard",
  SYROS: "hard",
};

const LEVEL_DIFFICULTY_6X6: Record<UnrankedBotLevel, EngineDifficulty> = {
  ROOKIE: "hard",
  SKILLED: "normal",
  ELITE: "normal",
  MYTHIC: "normal",
  CRACKED: "machine_god",
  CHRONICLE: "machine_god",
  SYROS: "machine_god",
};

const LEVEL_DIFFICULTY_7X7: Record<UnrankedBotLevel, EngineDifficulty> = {
  ROOKIE: "easy",
  SKILLED: "hard",
  ELITE: "hard",
  MYTHIC: "hard",
  CRACKED: "danger",
  CHRONICLE: "danger",
  SYROS: "danger",
};

export type CoreBoardSize = "5x5" | "6x6" | "7x7";

export function difficultyForLevel(
  level: UnrankedBotLevel,
  boardSize: CoreBoardSize,
): EngineDifficulty {
  if (boardSize === "7x7") return LEVEL_DIFFICULTY_7X7[level];
  if (boardSize === "6x6") return LEVEL_DIFFICULTY_6X6[level];
  return LEVEL_DIFFICULTY_5X5[level];
}

export function simpleSizeFromBoardMode(mode: string): CoreBoardSize {
  const m = mode.trim();
  if (m === "5x5" || m === "6x6" || m === "7x7") return m;
  if (m.startsWith("5x5")) return "5x5";
  if (m.startsWith("6x6")) return "6x6";
  if (m.startsWith("7x7")) return "7x7";
  return "5x5";
}

export const UNRANKED_5X5_PATTERN_POOL: readonly string[] = [
  "V",
  "L",
  "ZZ-5",
  "T",
  "LINE",
  "DIAGONAL",
] as const;

/**
 * Active 5×5 set: LINE + DIAGONAL are core (always in); a random 3 of the
 * 4 special shapes join them — one special always sits out.
 */
export function pickRandomPatterns5x5(_count: number = 5): string[] {
  return pickMatchPatterns5();
}

export interface LevelStyle {
  color: string;
  glow: number;
  label: UnrankedBotLevel;
}

const LEVEL_STYLE: Record<UnrankedBotLevel, LevelStyle> = {
  ROOKIE: { color: "#9CA3AF", glow: 0.3, label: "ROOKIE" },
  SKILLED: { color: "#60A5FA", glow: 0.45, label: "SKILLED" },
  ELITE: { color: "#A78BFA", glow: 0.55, label: "ELITE" },
  MYTHIC: { color: "#10B981", glow: 0.65, label: "MYTHIC" },
  CRACKED: { color: "#FF3333", glow: 0.85, label: "CRACKED" },
  CHRONICLE: { color: "#F59E0B", glow: 1.0, label: "CHRONICLE" },
  SYROS: { color: "#9333EA", glow: 1.3, label: "SYROS" },
};

export function styleForLevel(level: UnrankedBotLevel): LevelStyle {
  return LEVEL_STYLE[level];
}

export const SYROS_CHANCE = 0.1;

const NORMAL_LEVEL_WEIGHTS: Array<{ level: UnrankedBotLevel; weight: number }> = [
  { level: "ROOKIE", weight: 4 },
  { level: "SKILLED", weight: 4 },
  { level: "ELITE", weight: 3 },
  { level: "MYTHIC", weight: 3 },
  { level: "CRACKED", weight: 2 },
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
  name: UnrankedBotName | "SYROS";
  level: UnrankedBotLevel;
  isSyros: boolean;
}

export function pickUnrankedBot(): PickedBot {
  const isSyros = Math.random() < SYROS_CHANCE;
  if (isSyros) {
    return { name: "SYROS", level: "SYROS", isSyros: true };
  }
  const name =
    UNRANKED_BOT_NAMES[Math.floor(Math.random() * UNRANKED_BOT_NAMES.length)];
  const level = pickWeighted(NORMAL_LEVEL_WEIGHTS).level;
  return { name, level, isSyros: false };
}

export const UNRANKED_BOT_MIN_WAIT_MS = 10_000;

export function pickQueueWaitMs(): number {
  const min = UNRANKED_BOT_MIN_WAIT_MS;
  const max = 15_000;
  return Math.floor(min + Math.random() * (max - min + 1));
}

const PP_UNRANKED_BOTS_ENABLED_KEY = "pp_unranked_allow_bots";

export async function isUnrankedBotsAllowed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PP_UNRANKED_BOTS_ENABLED_KEY);
  if (raw === null) return true;
  return raw === "1" || raw === "true";
}

export async function setUnrankedBotsAllowed(allowed: boolean): Promise<void> {
  await AsyncStorage.setItem(PP_UNRANKED_BOTS_ENABLED_KEY, allowed ? "1" : "0");
}

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

export const UNRANKED_BOT_BANNER_POOL: readonly string[] = [
  "void_rift",
  "blood_moon",
  "phantom_strike",
  "solar_flare",
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

/** VS splash hold time — matches web ``armMatchFoundSequence`` (10 s). */
export const MATCH_FOUND_HOLD_MS = 10_000;
