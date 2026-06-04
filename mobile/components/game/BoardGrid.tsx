/**
 * Square board renderer for 5×5, 6×6, or 7×7.
 */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { GridSize } from "@/lib/game/boardConfig";
import { colors, radii } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

import type { Board, Coord } from "@/lib/game/winCheck";

const CELL_GAP = 4;
const BOARD_PAD = 8;
/** Gutter reserved for the A–E / 1–5 coordinate labels. */
const LABEL_GUTTER = 18;

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
  const palette = usePalette();
  const [size, setSize] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const next = Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
    if (next !== size && next > 0) setSize(next);
  };

  // The square is split into a label gutter (top + left) and the board.
  const boardSize = size > 0 ? size - LABEL_GUTTER : 0;
  const cellSize =
    boardSize > 0
      ? Math.floor((boardSize - BOARD_PAD * 2 - CELL_GAP * (gridSize - 1)) / gridSize)
      : 0;

  const winningSet = new Set<string>();
  if (winningLine) {
    for (const [r, c] of winningLine) winningSet.add(`${r},${c}`);
  }
  const lastKey = lastMove ? `${lastMove[0]},${lastMove[1]}` : null;

  const colLabels = Array.from({ length: gridSize }, (_, i) => String.fromCharCode(65 + i));

  return (
    <View style={[styles.boardWrap, style]} onLayout={handleLayout}>
      {size > 0 ? (
        <View style={{ width: size, height: size }}>
          {/* ── Column labels (A–E) ── */}
          <View style={{ flexDirection: "row", height: LABEL_GUTTER, marginLeft: LABEL_GUTTER + BOARD_PAD }}>
            {colLabels.map((ch, c) => (
              <Text
                key={`col-${c}`}
                style={[
                  styles.coordLabel,
                  { width: cellSize, marginRight: CELL_GAP, color: palette.textDim },
                ]}
              >
                {ch}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row" }}>
            {/* ── Row labels (1–5) ── */}
            <View style={{ width: LABEL_GUTTER, marginTop: BOARD_PAD }}>
              {board.map((_, r) => (
                <View
                  key={`rowlbl-${r}`}
                  style={{ height: cellSize, marginBottom: CELL_GAP, justifyContent: "center" }}
                >
                  <Text style={[styles.coordLabel, { color: palette.textDim }]}>{r + 1}</Text>
                </View>
              ))}
            </View>

            {/* ── Board ── */}
            <View
              style={[
                styles.board,
                {
                  width: boardSize,
                  height: boardSize,
                  backgroundColor: palette.boardBg,
                  borderColor: palette.boardLine,
                },
              ]}
            >
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
                        palette={palette}
                        disabled={disabled || cell !== null}
                        onPress={() => onCellPress?.(r, c)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
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
  palette: ThemePalette;
  disabled: boolean;
  onPress: () => void;
}

function Cell({ size, owner, isLast, isWinning, palette, disabled, onPress }: CellProps) {
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

  // Per-theme glyphs: P1/P2 use the active theme's piece glyphs
  // (X/Y, α/Ω, ⚔/🛡, …); legacy X/O owners render literally.
  const glyph =
    owner === "P1"
      ? palette.glyphP1
      : owner === "P2"
      ? palette.glyphP2
      : owner === "X" || owner === "O"
      ? owner
      : null;
  const pieceColor =
    owner === "P1" || owner === "X"
      ? palette.p1
      : owner === "P2" || owner === "O" || owner === "Y"
      ? palette.p2
      : palette.textMuted;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={!disabled ? { color: palette.bgRaised } : undefined}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          marginRight: CELL_GAP,
          backgroundColor: palette.boardCell,
          borderRadius: radii.xs,
          borderWidth: 1,
          borderColor: palette.boardLine,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && !disabled ? { backgroundColor: palette.bgCard } : null,
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
            borderColor: palette.borderStrong,
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
            borderColor: palette.accentHot,
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
  coordLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
