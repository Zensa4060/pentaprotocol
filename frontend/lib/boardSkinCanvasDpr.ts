/**
 * Canvas backing-store scale for animated bundle board skins.
 * 7×7 uses more cells in the same viewport; capping DPR cuts GPU fill rate
 * without changing gameplay (logical board size / clicks unchanged).
 */
export function boardSkinCanvasDpr(gridSize: number): number {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const quality =
    typeof window !== "undefined"
      ? window.localStorage.getItem("pp_graphics_quality")
      : null;
  if (quality === "low") return Math.min(raw, gridSize >= 7 ? 0.9 : 1.0);
  if (quality === "balanced") return Math.min(raw, gridSize >= 7 ? 1.1 : 1.25);
  if (gridSize >= 7) return Math.min(raw, 1.35);
  return Math.min(raw, 1.75);
}
