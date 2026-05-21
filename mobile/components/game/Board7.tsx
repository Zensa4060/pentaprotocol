/**
 * ``<Board7 />`` — 7×7 board renderer (default skin, no cosmetics).
 *
 * Design choices:
 *   - Grid is laid out with a single ``<View>`` parent + ``flexWrap``
 *     children, sized to a measured square. We do NOT use any
 *     external SVG/Skia library — pure RN ``View`` is plenty for a
 *     49-cell grid, keeps the bundle small, and renders fast on
 *     low-end Android.
 *   - Sizing: parent measures available width via ``onLayout`` and
 *     each cell becomes ``floor((width - paddings) / 7) - gap``.
 *     This auto-fits portrait phones (the most common case) and
 *     tablets without us guessing breakpoints.
 *   - Players: P1 = blood-red, P2 = info-blue. Both flat squares
 *     with a faint inner glow on the **last** move so the user
 *     never loses track of the bot's reply. Pure RN, no animation
 *     primitive other than ``Pressable``'s native press feedback.
 *   - Winning line is highlighted with a 2-px accent ring drawn
 *     on top of the player marker for any cell ``coord`` passed in
 *     ``winningLine``.
 *   - The board is uncontrolled visually — it just renders what
 *     it's handed. Move legality, turn switching, win detection,
 *     bot scheduling, etc. all live in the parent controller
 *     (``usePracticeMatch`` / ``useEngineMatch``).
 *
 * NO web cosmetics. NO themes, banners, board skins, border
 * styles, board mode glyphs, AI bot avatars. Those are future
 * Phase-6 mobile-native assets per user direction.
 */

import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radii } from "@/theme/tokens";

import type { Board, Coord } from "@/lib/game/winChecker7";

const GRID = 7;
const CELL_GAP = 4;
const BOARD_PAD = 8;

export interface Board7Props {
  /** 7×7 cell state. Each cell is ``"P1"`` | ``"P2"`` | ``null``. */
  board: Board;
  /** Last placed cell — highlighted with an outer glow. */
  lastMove?: Coord | null;
  /** Winning line cells — outlined with an accent border. */
  winningLine?: Coord[] | null;
  /** Called with ``(row, col)`` for an empty cell tap. */
  onCellPress?: (row: number, col: number) => void;
  /** True ⇒ ignore taps (bot's turn, game over, etc.). */
  disabled?: boolean;
  /** Style escape hatch on the outer board container. */
  style?: StyleProp<ViewStyle>;
}

export function Board7({
  board,
  lastMove,
  winningLine,
  onCellPress,
  disabled = false,
  style,
}: Board7Props) {
  const [size, setSize] = useState(0);

  // Measure available width once — recalc only on actual layout
  // changes (orientation, parent resize) to avoid render churn.
  const handleLayout = (e: LayoutChangeEvent) => {
    const next = Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
    if (next !== size && next > 0) setSize(next);
  };

  const cellSize = size > 0
    ? Math.floor((size - BOARD_PAD * 2 - CELL_GAP * (GRID - 1)) / GRID)
    : 0;

  // Hash the winning line for O(1) cell lookup. The line is small
  // (≤20 cells) so this is essentially free.
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

interface CellProps {
  size: number;
  owner: string | null;
  isLast: boolean;
  isWinning: boolean;
  disabled: boolean;
  onPress: () => void;
}

function Cell({ size, owner, isLast, isWinning, disabled, onPress }: CellProps) {
  const baseStyle: ViewStyle = {
    width: size,
    height: size,
    marginRight: CELL_GAP,
    backgroundColor: colors.bgRaised,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  };

  const ownerStyle: ViewStyle | null = owner
    ? {
        width: Math.max(8, Math.floor(size * 0.72)),
        height: Math.max(8, Math.floor(size * 0.72)),
        borderRadius: radii.sm,
        backgroundColor: owner === "P1" ? colors.accent : colors.info,
      }
    : null;

  const winningOverlay: ViewStyle | null = isWinning
    ? {
        position: "absolute",
        left: 0, right: 0, top: 0, bottom: 0,
        borderRadius: radii.xs,
        borderWidth: 2,
        borderColor: colors.warn,
      }
    : null;

  const lastMoveRing: ViewStyle | null = isLast && !isWinning
    ? {
        position: "absolute",
        left: 0, right: 0, top: 0, bottom: 0,
        borderRadius: radii.xs,
        borderWidth: 2,
        borderColor: colors.borderStrong,
      }
    : null;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={!disabled ? { color: colors.bgRaised } : undefined}
      style={({ pressed }) => [
        baseStyle,
        pressed && !disabled ? { backgroundColor: colors.bgCard } : null,
      ]}
    >
      {ownerStyle ? <View style={ownerStyle} /> : null}
      {lastMoveRing ? <View style={lastMoveRing} pointerEvents="none" /> : null}
      {winningOverlay ? <View style={winningOverlay} pointerEvents="none" /> : null}
    </Pressable>
  );
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
    // Last row's bottom margin is cosmetically absorbed by the
    // board's bottom padding — visually identical to flex gap, but
    // gap on Android < 11 has historically been flaky.
  },
});
