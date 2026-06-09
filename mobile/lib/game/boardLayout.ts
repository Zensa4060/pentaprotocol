/**
 * Fixed board sizing — keeps the grid square stable for the whole game.
 */

import type { GridSize } from "@/lib/game/boardConfig";

/** Total square side (labels + grid) in px for a leg size. */
export function boardSideForGrid(gridSize: GridSize, screenWidth: number): number {
  const horizontalPad = 40;
  const byWidth = Math.floor(screenWidth - horizontalPad);
  const cap: Record<GridSize, number> = {
    5: 380,
    6: 400,
    7: 412,
  };
  return Math.min(byWidth, cap[gridSize]);
}
