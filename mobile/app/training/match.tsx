/**
 * Training match — the actual gameplay screen.
 *
 * Layout (portrait phone):
 *
 *   ┌────────────────────────────────────┐
 *   │  ← BACK              EASY · 12 mv  │   ← top bar
 *   │                                    │
 *   │  YOU (P1)         BOT (P2)         │   ← scoreboard / turn
 *   │  ▼ YOUR TURN                       │
 *   │                                    │
 *   │  ┌──────────────────────────────┐  │
 *   │  │                              │  │
 *   │  │       7 × 7 board            │  │   ← <Board7 />
 *   │  │                              │  │
 *   │  └──────────────────────────────┘  │
 *   │                                    │
 *   │  [ Rematch ]      [ Pick again ]   │   ← controls
 *   └────────────────────────────────────┘
 *
 * State management is delegated to ``useTrainingMatch``; this
 * screen is just a renderer + nav glue.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Spinner,
  Title,
} from "@/components/ui";
import { Board7 } from "@/components/game/Board7";
import type { BotDifficulty } from "@/lib/game/botEngine7";
import { useTrainingMatch } from "@/lib/hooks/useTrainingMatch";
import { colors, radii, space } from "@/theme/tokens";

export default function TrainingMatchScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: BotDifficulty = params.difficulty === "easy" ? "easy" : "hard";

  const match = useTrainingMatch({ difficulty });

  const { result, botThinking, current } = match;
  const status = useMemo(() => {
    if (result.status === "won") {
      return result.winner === "P1" ? "YOU WIN" : "BOT WINS";
    }
    if (result.status === "draw") return "DRAW";
    if (botThinking) return "BOT THINKING…";
    return current === "P1" ? "YOUR TURN" : "BOT TURN";
  }, [botThinking, current, result]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    match.result.status === "won"
      ? match.result.winner === "P1"
        ? "accent"
        : "info"
      : match.result.status === "draw"
      ? "warn"
      : match.botThinking
      ? "muted"
      : match.current === "P1"
      ? "accent"
      : "info";

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/training");
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
          <Caption tone="muted">← BACK</Caption>
        </Pressable>
        <Caption tone="muted">
          {difficulty.toUpperCase()} · {match.movesPlayed} MV
        </Caption>
      </Row>

      {/* ── Scoreboard ──────────────────────────────────────────── */}
      <Row justify="between" align="center" style={{ marginTop: space[5] }}>
        <PlayerTile label="YOU" color={colors.accent} active={match.current === "P1" && match.result.status === "playing"} />
        <PlayerTile label="BOT" color={colors.info} active={match.current === "P2" && match.result.status === "playing"} />
      </Row>

      {/* ── Status line ─────────────────────────────────────────── */}
      <Row gap={2} align="center" justify="center" style={{ marginTop: space[3] }}>
        {match.botThinking ? <Spinner tone="muted" /> : null}
        <Eyebrow tone={statusTone}>{status}</Eyebrow>
      </Row>

      {/* ── Board ───────────────────────────────────────────────── */}
      <View style={{ marginTop: space[4], flex: 1, justifyContent: "center" }}>
        <Board7
          board={match.board}
          lastMove={match.lastMove}
          winningLine={match.result.line}
          disabled={!match.inputEnabled}
          onCellPress={match.placeHuman}
        />
      </View>

      {/* ── Bottom controls ─────────────────────────────────────── */}
      {match.result.status !== "playing" ? (
        <ResultSummary
          status={match.result.status}
          winner={match.result.winner}
          connectionScores={match.result.connectionScores}
        />
      ) : null}

      <Row gap={3} style={{ marginTop: space[4], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={() => router.replace("/training")}>
            Pick again
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" onPress={match.reset}>
            Rematch
          </Btn>
        </View>
      </Row>
    </Screen>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlayerTile({
  label,
  color,
  active,
}: {
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <View
      style={[
        styles.playerTile,
        { borderColor: active ? color : colors.border, opacity: active ? 1 : 0.6 },
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Title style={{ color: active ? colors.text : colors.textMuted }}>{label}</Title>
    </View>
  );
}

function ResultSummary({
  status,
  winner,
  connectionScores,
}: {
  status: "won" | "draw";
  winner: "P1" | "P2" | null;
  connectionScores?: { p1: number; p2: number };
}) {
  const headline =
    status === "draw"
      ? "Draw — neither chain reached 20."
      : winner === "P1"
      ? "Well played."
      : "Engine took it. Try again?";
  return (
    <View style={styles.resultCard}>
      <Body>{headline}</Body>
      {connectionScores ? (
        <Caption tone="muted" style={{ marginTop: space[2] }}>
          Chain · YOU {connectionScores.p1} · BOT {connectionScores.p2}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  playerTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colors.bgCard,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: radii.sm,
  },
  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[4],
    marginTop: space[3],
  },
});
