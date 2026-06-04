/**
 * Training practice match — local alternating play, no bot.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";

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
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { matchMsForGrid, parseGridParam } from "@/lib/game/boardConfig";
import { pieceGlyph } from "@/lib/game/matchRules";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  useGameEndSounds,
  useMatchGameBgm,
} from "@/lib/hooks/useMatchSounds";
import { usePracticeMatch } from "@/lib/hooks/usePracticeMatch";
import { colors, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function TrainingPracticeScreen() {
  const params = useLocalSearchParams<{ grid?: string; patterns?: string }>();
  const gridSize = parseGridParam(params.grid);
  const palette = usePalette();
  // Fixed board box (width minus the screen's horizontal gutter) so the
  // board never resizes/recenters as HUD or move-log content changes.
  const boardDim = Dimensions.get("window").width - space[5] * 2;
  const patterns = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;
  const match = usePracticeMatch({ gridSize, patterns });
  const clock = useMatchClock(
    match.current,
    match.result.status === "playing",
    matchMsForGrid(gridSize),
  );
  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "any");

  const onCellPress = useCallback(
    (row: number, col: number) => {
      audio.sfx.place();
      match.place(row, col);
    },
    [audio, match],
  );

  const status = useMemo(() => {
    if (match.result.status === "won") {
      return `${pieceGlyph(match.result.winner!)} WINS`;
    }
    if (match.result.status === "draw") return "DRAW";
    return `${pieceGlyph(match.current)} TO PLAY`;
  }, [match.current, match.result.status, match.result.winner]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    match.result.status === "won"
      ? match.result.winner === "P1"
        ? "accent"
        : "info"
      : match.result.status === "draw"
      ? "warn"
      : match.current === "P1"
      ? "accent"
      : "info";

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/training");
  };

  const onReset = () => {
    audio.sfx.transition();
    match.reset();
    clock.reset();
  };

  return (
    <Screen padded background={palette.bg}>
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
            {gridSize}×{gridSize} · {match.movesPlayed} MV
          </Caption>
        </Row>
      </Row>

      <View style={{ marginTop: space[3] }}>
        <MatchClockRow
          p1Label={clock.p1Label}
          p2Label={clock.p2Label}
          active={clock.active}
        />
      </View>

      <Row justify="between" align="center" style={{ marginTop: space[4] }}>
        <PlayerTile label={palette.glyphP1} color={palette.p1} active={match.current === "P1" && match.result.status === "playing"} />
        <PlayerTile label={palette.glyphP2} color={palette.p2} active={match.current === "P2" && match.result.status === "playing"} />
      </Row>

      {/* Fixed-height HUD slot so the board never shifts when the
          center-rule banner / extra-turns badge appear or disappear. */}
      <View style={styles.hudSlot}>
        <CenterRuleBanner
          visible={match.centerRuleHint && match.movesPlayed === 0 && gridSize !== 6}
          gridSize={gridSize}
        />
        <ExtraTurnsBadge count={match.extraTurns} player={match.extraTurnsHolder} />
        <Row gap={2} align="center" justify="center" style={{ marginTop: space[2] }}>
          <Eyebrow tone={statusTone}>{status}</Eyebrow>
        </Row>
      </View>

      <View style={{ height: boardDim, justifyContent: "center" }}>
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
        title={match.result.status === "draw" ? "DRAW" : status}
        subtitle={
          match.result.connectionScores
            ? `Chains · X ${match.result.connectionScores.p1} · Y ${match.result.connectionScores.p2}`
            : undefined
        }
      />

      <MoveLogPanel entries={match.moveLog} />

      <Row gap={3} style={{ marginTop: space[4], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={match.undo} disabled={!match.canUndo}>
            Undo
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={() => router.replace("/training")}>
            Back
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" onPress={onReset}>
            Reset
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
      <Caption style={{ color, fontWeight: "800", fontSize: 18 }}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  hudSlot: {
    height: 92,
    justifyContent: "center",
  },
  playerTile: {
    flex: 1,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colors.bgCard,
    alignItems: "center",
  },
});
