/**
 * Square board renderer for 5×5, 6×6, or 7×7.
 */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { GridSize } from "@/lib/game/boardConfig";
import { pieceGlyph } from "@/lib/game/matchRules";
import { colors, radii } from "@/theme/tokens";

import type { Board, Coord } from "@/lib/game/winCheck";

const CELL_GAP = 4;
const BOARD_PAD = 8;

export interface BoardGridProps {
  gridSize: GridSize;
  board: Board;
  lastMove?: Coord | null;
  winningLine?: Coord[] | null;
  onCellPress?: (row: number, col: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BoardGrid({
  gridSize,
  board,
  lastMove,
  winningLine,
  onCellPress,
  disabled = false,
  style,
}: BoardGridProps) {
  const [size, setSize] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const next = Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
    if (next !== size && next > 0) setSize(next);
  };

  const cellSize =
    size > 0
      ? Math.floor((size - BOARD_PAD * 2 - CELL_GAP * (gridSize - 1)) / gridSize)
      : 0;

  const winningSet = new Set<string>();
  if (winningLine) {
    for (const [r, c] of winningLine) winningSet.add(`${r},${c}`);
  }
  const lastKey = lastMove ? `${lastMove[0]},${lastMove[1]}` : null;

  return (
    <View style={[styles.boardWrap, style]} onLayout={handleLayout}>
      {size > 0 ? (
        <View style={[styles.board, { width: size, height: size }]}>
          {board.map((row, r) => (
            <View key={`row-${r}`} style={styles.row}>
              {row.map((cell, c) => {
                const isLast = lastKey === `${r},${c}`;
                const isWinning = winningSet.has(`${r},${c}`);
                return (
                  <Cell
                    key={`${r}-${c}`}
                    size={cellSize}
                    owner={cell}
                    isLast={isLast}
                    isWinning={isWinning}
                    disabled={disabled || cell !== null}
                    onPress={() => onCellPress?.(r, c)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** @deprecated Use ``BoardGrid`` with ``gridSize={7}``. */
export function Board7(
  props: Omit<BoardGridProps, "gridSize"> & { board: Board },
) {
  return <BoardGrid gridSize={7} {...props} />;
}

interface CellProps {
  size: number;
  owner: string | null;
  isLast: boolean;
  isWinning: boolean;
  disabled: boolean;
  onPress: () => void;
}

function Cell({ size, owner, isLast, isWinning, disabled, onPress }: CellProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isWinning) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isWinning, pulse]);

  const glyph =
    owner === "P1" || owner === "P2"
      ? pieceGlyph(owner)
      : owner === "X" || owner === "O"
      ? owner
      : null;
  const pieceColor =
    owner === "P1" || owner === "X"
      ? colors.p1
      : owner === "P2" || owner === "O" || owner === "Y"
      ? colors.p2
      : colors.textMuted;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={!disabled ? { color: colors.bgRaised } : undefined}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          marginRight: CELL_GAP,
          backgroundColor: colors.bgRaised,
          borderRadius: radii.xs,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && !disabled ? { backgroundColor: colors.bgCard } : null,
      ]}
    >
      {glyph ? (
        <Animated.Text
          style={{
            fontSize: Math.max(12, Math.floor(size * (gridSizeFontScale(size)))),
            fontWeight: "800",
            color: pieceColor,
            transform: isWinning ? [{ scale: pulse }] : undefined,
          }}
        >
          {glyph}
        </Animated.Text>
      ) : null}
      {isLast && !isWinning ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.xs,
            borderWidth: 2,
            borderColor: colors.borderStrong,
          }}
        />
      ) : null}
      {isWinning ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.xs,
            borderWidth: 2,
            borderColor: colors.accentHot,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function gridSizeFontScale(cellSize: number): number {
  if (cellSize < 36) return 0.38;
  if (cellSize < 44) return 0.4;
  return 0.42;
}

const styles = StyleSheet.create({
  boardWrap: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  board: {
    padding: BOARD_PAD,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    marginBottom: CELL_GAP,
  },
});
