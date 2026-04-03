"use client";

import type { PatternInfo } from "@/lib/patterns_metadata";

type Props = {
  info: PatternInfo;
  accent: string;
  isSelected?: boolean;
  cellSize?: number;
};

/** Small grid preview of a pattern (same geometry as RuleshowScreen). */
export default function PatternDiagram({ info, accent, isSelected = true, cellSize = 14 }: Props) {
  const cells = info.cells;
  const gridSize = info.gridSize;
  const gap = 2;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
        gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
        gap,
        marginTop: 8,
      }}
    >
      {Array.from({ length: gridSize }, (_, r) =>
        Array.from({ length: gridSize }, (_, c) => {
          const filled = cellSet.has(`${r},${c}`);
          return (
            <div
              key={`${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                background: filled ? (isSelected ? accent : `${accent}66`) : "rgba(255,255,255,0.04)",
                border: filled ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.2s",
              }}
            />
          );
        })
      )}
    </div>
  );
}
