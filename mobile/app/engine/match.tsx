/**
 * AI Engine match — human vs server bot (``/api/bot/move``).
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
import type { EngineDifficulty } from "@/lib/botApi/botMove";
import { useEngineMatch } from "@/lib/hooks/useEngineMatch";
import { colors, radii, space } from "@/theme/tokens";

export default function EngineMatchScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; label?: string }>();
  const difficulty: EngineDifficulty =
    params.difficulty === "easy" || params.difficulty === "danger"
      ? params.difficulty
      : "hard";
  const botName = (params.label ?? "BOT").toUpperCase();

  const match = useEngineMatch({ difficulty });

  const status = useMemo(() => {
    if (match.result.status === "won") {
      return match.result.winner === "P1" ? "YOU WIN" : `${botName} WINS`;
    }
    if (match.result.status === "draw") return "DRAW";
    if (match.botThinking) return "ENGINE THINKING…";
    if (match.botError) return match.botError;
    return match.current === "P1" ? "YOUR TURN" : `${botName} TURN`;
  }, [
    botName,
    match.botError,
    match.botThinking,
    match.current,
    match.result.status,
    match.result.winner,
  ]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    match.botError
      ? "warn"
      : match.result.status === "won"
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
    else router.replace("/engine");
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
          <Caption tone="muted">← BACK</Caption>
        </Pressable>
        <Caption tone="muted">
          {botName} · {match.movesPlayed} MV
        </Caption>
      </Row>

      <Row justify="between" align="center" style={{ marginTop: space[5] }}>
        <PlayerTile label="YOU" color={colors.accent} active={match.current === "P1" && match.result.status === "playing"} />
        <PlayerTile label={botName} color={colors.info} active={match.current === "P2" && match.result.status === "playing"} />
      </Row>

      <Row gap={2} align="center" justify="center" style={{ marginTop: space[3] }}>
        {match.botThinking ? <Spinner tone="muted" /> : null}
        <Eyebrow tone={statusTone} center>
          {status}
        </Eyebrow>
      </Row>

      <View style={{ marginTop: space[4], flex: 1, justifyContent: "center" }}>
        <Board7
          board={match.board}
          lastMove={match.lastMove}
          winningLine={match.result.line}
          disabled={!match.inputEnabled}
          onCellPress={match.placeHuman}
        />
      </View>

      {match.result.status !== "playing" ? (
        <View style={styles.resultCard}>
          <Body>
            {match.result.status === "draw"
              ? "Draw — neither chain reached 20."
              : match.result.winner === "P1"
              ? "Well played."
              : `${botName} took it. Try again?`}
          </Body>
          {match.result.connectionScores ? (
            <Caption tone="muted" style={{ marginTop: space[2] }}>
              Chain · YOU {match.result.connectionScores.p1} · {botName}{" "}
              {match.result.connectionScores.p2}
            </Caption>
          ) : null}
        </View>
      ) : null}

      <Row gap={3} style={{ marginTop: space[4], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={() => router.replace("/engine")}>
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
      <Title style={{ color: active ? colors.text : colors.textMuted }} numberOfLines={1}>
        {label}
      </Title>
    </View>
  );
}

const styles = StyleSheet.create({
  playerTile: {
    flex: 1,
    maxWidth: "48%",
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
