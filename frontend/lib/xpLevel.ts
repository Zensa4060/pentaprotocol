/**
 * Level / XP curve — must match backend app.routers.game.xp_for_level and compute_level.
 */
export function xpForLevel(level: number): number {
  if (level >= 1000) return 999_999_999;
  return 5000 + Math.floor(1000 * Math.pow(1.1, level - 1)) + (level - 1) * 500;
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
