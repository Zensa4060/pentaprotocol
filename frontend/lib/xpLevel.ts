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

/** Cumulative total XP needed to reach a target level from level 1 (0 XP). */
export function totalXpToReachLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0;
  let total = 0;
  for (let level = 1; level < targetLevel; level++) {
    total += xpForLevel(level);
  }
  return total;
}

export type LevelStats = {
  level: number;
  rem: number;
  nextXp: number;
  progress: number;
};

/** XP into current level, XP required for current level, and bar width %. */
export function computeLevelStatsFromTotalXp(totalXp: number): LevelStats {
  let level = 1;
  let rem = totalXp;
  while (level < 1000 && rem >= xpForLevel(level)) {
    rem -= xpForLevel(level);
    level++;
  }
  const nextXp = xpForLevel(level);
  const progress = (rem / nextXp) * 100;
  return { level, rem, nextXp, progress };
}
