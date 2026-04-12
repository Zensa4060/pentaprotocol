/**
 * Level / XP curve — must match backend app.routers.game.xp_for_level and compute_level.
 */
export function xpForLevel(level: number): number {
  if (level >= 1000) return 999_999_999;
  if (level <= 0) return 1000;
  return 1000 + (level - 1) * 500;
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
