/**
 * Canvas backing-store scale for animated bundle board skins.
 * 7×7 uses more cells in the same viewport; capping DPR cuts GPU fill rate
 * without changing gameplay (logical board size / clicks unchanged).
 */
export function boardSkinCanvasDpr(gridSize: number): number {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  // Performance mode was removed: always use quality-mode caps.
  if (gridSize >= 7) return Math.min(raw, 1.05);
  return Math.min(raw, 1.25);
}
