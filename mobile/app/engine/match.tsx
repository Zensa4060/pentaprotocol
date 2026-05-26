/**
 * AI Engine match — human vs server bot (``/api/bot/move``).
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BoardGrid } from "@/components/game/BoardGrid";
import { PatternsToggle } from "@/components/game/PatternsToggle";
import {
  CenterRuleBanner,
  ExtraTurnsBadge,
  MatchClockRow,
  MoveLogPanel,
  WinOverlay,
} from "@/components/game/MatchExtras";
import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Spinner,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import type { EngineDifficulty } from "@/lib/botApi/botMove";
import { matchMsForGrid, parseGridParam } from "@/lib/game/boardConfig";
import { useEngineMatch } from "@/lib/hooks/useEngineMatch";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  useGameEndSounds,
  useMatchGameBgm,
} from "@/lib/hooks/useMatchSounds";
import { colors, radii, space } from "@/theme/tokens";

export default function EngineMatchScreen() {
  const params = useLocalSearchParams<{
    difficulty?: string;
    label?: string;
    grid?: string;
  }>();
  const difficulty: EngineDifficulty =
    params.difficulty === "easy" || params.difficulty === "danger"
      ? params.difficulty
      : "hard";
  const botName = (params.label ?? "BOT").toUpperCase();
  const gridSize = parseGridParam(params.grid);

  const match = useEngineMatch({ difficulty, gridSize });
  const clock = useMatchClock(
    match.current,
    match.result.status === "playing",
    matchMsForGrid(gridSize),
  );
  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "P1");

  const onCellPress = useCallback(
    (row: number, col: number) => {
      if (match.inputEnabled) audio.sfx.place();
      match.placeHuman(row, col);
    },
    [audio, match],
  );

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

  const winTitle =
    match.result.status === "won"
      ? match.result.winner === "P1"
        ? "VICTORY"
        : "DEFEAT"
      : match.result.status === "draw"
      ? "DRAW"
      : "";

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/engine");
  };

  const onRematch = () => {
    audio.sfx.transition();
    match.reset();
    clock.reset();
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
          <Caption tone="muted">← BACK</Caption>
        </Pressable>
        <Row gap={2} align="center">
          <PatternsToggle
            gridSize={gridSize}
            enabled={match.result.status === "playing"}
          />
          <Caption tone="muted">
            {botName} · {gridSize}×{gridSize} · {match.movesPlayed} MV
          </Caption>
        </Row>
      </Row>

      <View style={{ marginTop: space[3] }}>
        <MatchClockRow
          p1Label={clock.p1Label}
          p2Label={clock.p2Label}
          active={clock.active}
          p1Name="X"
          p2Name="Y"
        />
      </View>

      <Row justify="between" align="center" style={{ marginTop: space[4] }}>
        <PlayerTile label="YOU · X" color={colors.p1} active={match.current === "P1" && match.result.status === "playing"} />
        <PlayerTile label={`${botName} · Y`} color={colors.p2} active={match.current === "P2" && match.result.status === "playing"} />
      </Row>

      <CenterRuleBanner
        visible={match.centerRuleHint && match.movesPlayed === 0}
        gridSize={gridSize}
      />
      <ExtraTurnsBadge count={match.extraTurns} player={match.extraTurnsHolder} />

      <Row gap={2} align="center" justify="center" style={{ marginTop: space[2] }}>
        {match.botThinking ? <Spinner tone="muted" /> : null}
        <Eyebrow tone={statusTone} center>
          {status}
        </Eyebrow>
      </Row>

      <View style={{ marginTop: space[3], flex: 1, justifyContent: "center", minHeight: 280 }}>
        <BoardGrid
          gridSize={gridSize}
          board={match.board}
          lastMove={match.lastMove}
          winningLine={match.result.line}
          disabled={!match.inputEnabled}
          onCellPress={onCellPress}
        />
      </View>

      <WinOverlay
        visible={match.result.status !== "playing"}
        title={winTitle}
        subtitle={
          match.result.connectionScores
            ? `Chains · X ${match.result.connectionScores.p1} · Y ${match.result.connectionScores.p2}`
            : undefined
        }
      />

      <MoveLogPanel entries={match.moveLog} />

      <Row gap={3} style={{ marginTop: space[4], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={() => router.replace("/engine")}>
            Pick again
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" onPress={onRematch}>
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
      <Caption style={{ color, fontWeight: "800" }}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  playerTile: {
    flex: 1,
    maxWidth: "48%",
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colors.bgCard,
    alignItems: "center",
  },
});
