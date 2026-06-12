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

import { boardSkinFor, type BoardSkin } from "@/lib/cosmetics/boardSkin";
import type { GridSize } from "@/lib/game/boardConfig";
import { useAuthStore } from "@/lib/store";
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
  /** Lock total square side (px) — stops relayout when HUD above changes. */
  sideLength?: number;
  style?: StyleProp<ViewStyle>;
}

export function BoardGrid({
  gridSize,
  board,
  lastMove,
  winningLine,
  onCellPress,
  disabled = false,
  sideLength,
  style,
}: BoardGridProps) {
  const palette = usePalette();
  // Equipped board skin (Collection → Grids). Overrides the theme's board
  // surface colors; pieces keep the theme glyphs/colors.
  const boardStyle = useAuthStore((s) => s.user?.board_style);
  const skin = boardSkinFor(boardStyle);
  const locked = sideLength != null && sideLength > 0;
  const [measured, setMeasured] = useState(0);
  const size = locked ? sideLength! : measured;

  useEffect(() => {
    if (locked) setMeasured(sideLength!);
  }, [locked, sideLength]);

  const handleLayout = (e: LayoutChangeEvent) => {
    if (locked) return;
    const next = Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
    if (next !== measured && next > 0) setMeasured(next);
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
    <View
      style={[
        styles.boardWrap,
        locked && size > 0 ? { width: size, height: size, flex: undefined } : null,
        style,
      ]}
      onLayout={locked ? undefined : handleLayout}
    >
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
                  backgroundColor: skin?.boardBg ?? palette.boardBg,
                  borderColor: skin?.boardLine ?? palette.boardLine,
                },
              ]}
            >
              {skin ? <SkinAtmosphere skin={skin} /> : null}
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
                        skin={skin}
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
  skin: BoardSkin | null;
  disabled: boolean;
  onPress: () => void;
}

function Cell({ size, owner, isLast, isWinning, palette, skin, disabled, onPress }: CellProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  // Stone-place pop: when a cell goes empty → occupied, spring the glyph in.
  const pop = useRef(new Animated.Value(1)).current;
  const prevOwnerRef = useRef<string | null>(owner);

  useEffect(() => {
    if (prevOwnerRef.current === null && owner !== null) {
      pop.setValue(0.3);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    prevOwnerRef.current = owner;
  }, [owner, pop]);

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
  // Bundle piece skins recolor the stones (glacier shards / bloodmoon sigils).
  const pieceColor =
    owner === "P1" || owner === "X"
      ? skin?.p1Color ?? palette.p1
      : owner === "P2" || owner === "O" || owner === "Y"
      ? skin?.p2Color ?? palette.p2
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
          backgroundColor: skin?.cellBg ?? palette.boardCell,
          borderRadius: radii.xs,
          borderWidth: 1,
          borderColor: skin?.cellBorder ?? palette.boardLine,
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
            transform: isWinning ? [{ scale: pulse }] : [{ scale: pop }],
            ...(skin
              ? {
                  textShadowColor: skin.pieceGlow,
                  textShadowRadius: 8,
                  textShadowOffset: { width: 0, height: 0 },
                }
              : null),
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

/**
 * Bundle atmosphere — two slow-breathing tinted washes layered over the
 * board surface (glacier aurora / bloodmoon omen). Pointer-transparent and
 * driven by a single looped Animated.Value, so it costs almost nothing.
 */
function SkinAtmosphere({ skin }: { skin: BoardSkin }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const innerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const outerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.2] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: skin.atmosphereInner, opacity: innerOpacity, borderRadius: radii.md },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: skin.atmosphereOuter, opacity: outerOpacity, borderRadius: radii.md },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: {
    // Fill the (flexible) parent slot and size the square board to the
    // smaller of the available width/height — so the whole board always
    // fits on screen instead of forcing a width-sized square that pushes
    // the bottom row / controls out of bounds on shorter phones.
    width: "100%",
    flex: 1,
    minHeight: 0,
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
