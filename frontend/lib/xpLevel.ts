/**
 * Level / XP curve — must match backend app.routers.game.xp_for_level and compute_level.
 */
const XP_CURVE_LEVELS_1_TO_30 = Array.from({ length: 30 }, (_, i) => 1000 + i * 50);

export function xpForLevel(level: number): number {
  if (level >= 1000) return 999_999_999;
  if (level <= 0) return XP_CURVE_LEVELS_1_TO_30[0];
  if (level <= 30) return XP_CURVE_LEVELS_1_TO_30[level - 1];
  return XP_CURVE_LEVELS_1_TO_30[XP_CURVE_LEVELS_1_TO_30.length - 1] + (level - 30) * 50;
}

export type LevelStats = {
  level: number;
  rem: number;
  nextXp: number;
  progress: number;
};

/** Compute progress toward next level based on current level and current XP */
export function computeLevelProgress(level: number, currentXp: number): LevelStats {
  const safeLevel = Math.max(1, Math.min(1000, level));
  const safeXp = Math.max(0, currentXp);
  const nextXp = xpForLevel(safeLevel);
  let progress = (safeXp / nextXp) * 100;
  if (safeLevel >= 1000) progress = 100;
  return { level: safeLevel, rem: safeXp, nextXp, progress };
}
