/**
 * Animated bot-vs-bot demo board for the tutorial — RN port of the web
 * ``TutorialDemoBoard``. Plays the scripted moves out one stone at a
 * time with play / pause / step / replay controls, then highlights the
 * winning cells and shows an outcome banner. Pure Views (no SVG dep);
 * the web's win *line* becomes a winning-cell highlight.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePalette } from "@/theme/ThemeProvider";
import { radii, space } from "@/theme/tokens";

export interface DemoMove {
  r: number;
  c: number;
  p: "P1" | "P2";
}

export interface DemoGame {
  id: string;
  size: 5 | 6 | 7;
  moves: DemoMove[];
  /** Cells highlighted once the demo resolves (win line / pattern / path). */
  winCells?: Array<[number, number]>;
  outcome?: "P1_WIN" | "P2_WIN" | "DRAW";
  caption?: string;
  moveDelayMs?: number;
  loopPauseMs?: number;
}

const DEFAULT_MOVE_DELAY_MS = 700;
const DEFAULT_LOOP_PAUSE_MS = 2400;

export function DemoBoard({ demo, maxWidth = 320 }: { demo: DemoGame; maxWidth?: number }) {
  const palette = usePalette();
  const total = demo.moves.length;
  const moveDelay = demo.moveDelayMs ?? DEFAULT_MOVE_DELAY_MS;
  const loopPause = demo.loopPauseMs ?? DEFAULT_LOOP_PAUSE_MS;

  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    setShown(0);
    setPlaying(true);
  }, [demo.id]);

  // Autoplay: advance one stone per tick, hold on the resolved board,
  // then loop so late viewers still see the animation.
  useEffect(() => {
    if (!playing) return;
    if (shown < total) {
      const t = setTimeout(() => setShown((s) => s + 1), moveDelay);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (playingRef.current) setShown(0);
    }, loopPause);
    return () => clearTimeout(t);
  }, [playing, shown, total, moveDelay, loopPause]);

  const sz = demo.size;
  const cell = Math.floor(maxWidth / sz);
  const boardW = cell * sz;
  const finished = shown >= total;
  const safeShown = Math.min(shown, total);
  const lastMove = safeShown > 0 ? demo.moves[safeShown - 1] : null;

  const owners = useMemo(() => {
    const grid: ("P1" | "P2" | null)[][] = Array.from({ length: sz }, () =>
      Array.from({ length: sz }, () => null),
    );
    for (let i = 0; i < safeShown; i++) {
      const m = demo.moves[i];
      if (m) grid[m.r][m.c] = m.p;
    }
    return grid;
  }, [demo.moves, safeShown, sz]);

  const winSet = useMemo(
    () => (finished && demo.winCells ? new Set(demo.winCells.map(([r, c]) => `${r},${c}`)) : null),
    [demo.winCells, finished],
  );

  const outcomeLabel =
    demo.outcome === "P1_WIN"
      ? "P1 WINS"
      : demo.outcome === "P2_WIN"
        ? "P2 WINS"
        : demo.outcome === "DRAW"
          ? "DRAW"
          : null;
  const outcomeColor =
    demo.outcome === "P1_WIN" ? palette.p1 : demo.outcome === "P2_WIN" ? palette.p2 : palette.textMuted;

  return (
    <View style={{ alignItems: "center", gap: space[3] }}>
      <View
        style={{
          width: boardW,
          height: boardW,
          backgroundColor: palette.boardBg,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: radii.md,
          overflow: "hidden",
        }}
      >
        {owners.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((owner, c) => {
              const isWin = winSet?.has(`${r},${c}`);
              const isLast = !finished && lastMove && lastMove.r === r && lastMove.c === c;
              return (
                <View
                  key={c}
                  style={{
                    width: cell,
                    height: cell,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: palette.boardLine,
                    backgroundColor: isWin ? `${palette.accent}33` : palette.boardCell,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {owner ? (
                    <View
                      style={{
                        width: cell * 0.62,
                        height: cell * 0.62,
                        borderRadius: cell,
                        backgroundColor: owner === "P1" ? palette.p1 : palette.p2,
                        borderWidth: isWin || isLast ? 2 : 0,
                        borderColor: palette.accent,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {finished && outcomeLabel ? (
        <View
          style={{
            paddingHorizontal: space[4],
            paddingVertical: space[2],
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: outcomeColor,
            backgroundColor: `${outcomeColor}22`,
          }}
        >
          <Text style={{ color: outcomeColor, fontWeight: "800", letterSpacing: 3, fontSize: 14 }}>
            {outcomeLabel}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Ctrl
          label="⟲"
          onPress={() => {
            setShown(0);
            setPlaying(true);
          }}
        />
        <Ctrl
          label="⟵"
          disabled={shown === 0}
          onPress={() => {
            setPlaying(false);
            setShown((s) => Math.max(0, s - 1));
          }}
        />
        <Ctrl label={playing ? "⏸" : "▶"} primary onPress={() => setPlaying((p) => !p)} />
        <Ctrl
          label="⟶"
          disabled={shown >= total}
          onPress={() => {
            setPlaying(false);
            setShown((s) => Math.min(total, s + 1));
          }}
        />
        <Text style={{ color: palette.textMuted, fontSize: 12, letterSpacing: 1, marginLeft: space[2] }}>
          MOVE {safeShown} / {total}
        </Text>
      </View>

      {demo.caption ? (
        <Text
          style={{
            color: palette.textMuted,
            fontSize: 13,
            lineHeight: 19,
            textAlign: "center",
            maxWidth: boardW + 40,
          }}
        >
          {demo.caption}
        </Text>
      ) : null}
    </View>
  );
}

function Ctrl({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: 44,
        height: 38,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: primary ? palette.accent : palette.border,
        backgroundColor: primary ? palette.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={{
          color: primary ? palette.bg : palette.text,
          fontSize: 18,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
