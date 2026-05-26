/**
 * Mini grid preview for a win pattern (mirrors web ``PatternDiagram``).
 */

import { useMemo } from "react";
import { View } from "react-native";

import type { PatternInfo } from "@/lib/game/patterns";
interface PatternDiagramProps {
  info: PatternInfo;
  accent: string;
  isSelected?: boolean;
  cellSize?: number;
}

export function PatternDiagram({
  info,
  accent,
  isSelected = true,
  cellSize = 11,
}: PatternDiagramProps) {
  const cellSet = useMemo(
    () => new Set(info.cells.map(([r, c]) => `${r},${c}`)),
    [info.cells],
  );
  const n = info.gridSize;
  const gap = 2;

  return (
    <View style={{ marginTop: 8, gap }}>
      {Array.from({ length: n }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {Array.from({ length: n }, (_, c) => {
            const filled = cellSet.has(`${r},${c}`);
            return (
              <View
                key={`${r}-${c}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  backgroundColor: filled
                    ? isSelected
                      ? accent
                      : `${accent}66`
                    : "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: filled ? accent : "rgba(255,255,255,0.06)",
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
