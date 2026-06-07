/**
 * Training practice match — local triple-leg series with Protocol Breakers.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BoardGrid } from "@/components/game/BoardGrid";
import { LimitbreakerOverlay } from "@/components/game/LimitbreakerOverlay";
import { PatternsToggle } from "@/components/game/PatternsToggle";
import { RulebreakerOverlay } from "@/components/game/RulebreakerOverlay";
import {
  CenterRuleBanner,
  ExtraTurnsBadge,
  MatchClockRow,
  MoveLogPanel,
  SeriesOverlay,
} from "@/components/game/MatchExtras";
import {
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Stack as VStack,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import {
  matchMsForGrid,
} from "@/lib/game/boardConfig";
import { pieceGlyph } from "@/lib/game/matchRules";
import { useLocalLimitbreaker } from "@/lib/hooks/useLocalLimitbreaker";
import { useLocalRulebreaker } from "@/lib/hooks/useLocalRulebreaker";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  useGameEndSounds,
  useMatchGameBgm,
  useRulebreakerPendingSound,
} from "@/lib/hooks/useMatchSounds";
import { usePracticeMatch } from "@/lib/hooks/usePracticeMatch";
import {
  boardModeForGameNumber,
  clockMsForGameReset,
  gridForGameNumber,
  patternsForLeg,
  seriesScoreLine,
  type SeriesPlayer,
} from "@/lib/hooks/seriesConfig";
import { useTripleLegSeries } from "@/lib/hooks/useTripleLegSeries";
import { useAuthStore } from "@/lib/store";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

const P1_LABEL = "PLAYER 1";
const P2_LABEL = "PLAYER 2";

export default function TrainingPracticeScreen() {
  const params = useLocalSearchParams<{ grid?: string; patterns?: string }>();
  const palette = usePalette();
  const username = useAuthStore((s) => s.user?.username);
  const picked5 = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;

  const match = usePracticeMatch({ gridSize: 5, patterns: picked5 });
  const gridSize = match.gridSize;

  const clock = useMatchClock(
    match.current,
    match.result.status === "playing",
    matchMsForGrid(gridSize),
  );

  const onResetGame = useCallback(
    (starter: SeriesPlayer, nextGameNumber: number) => {
      const grid = gridForGameNumber(nextGameNumber);
      const pats = patternsForLeg(nextGameNumber, picked5);
      const clocks = clockMsForGameReset(grid, nextGameNumber, null);
      match.reset(starter, { gridSize: grid, patterns: pats, c3Blocked: false });
      clock.reset(clocks.p1, clocks.p2);
    },
    [clock, match, picked5],
  );

  const series = useTripleLegSeries(match.result, onResetGame);

  const onBreakerComplete = useCallback(
    (outcome: { reset: Parameters<typeof match.reset>[1] }) => {
      const nextGn = series.gameNumber + 1;
      const grid = outcome.reset?.gridSize ?? gridForGameNumber(nextGn);
      const clocks = clockMsForGameReset(grid, nextGn, null);
      match.reset(outcome.reset?.starter ?? "P1", outcome.reset);
      clock.reset(
        outcome.reset?.p1ClockMs ?? clocks.p1,
        outcome.reset?.p2ClockMs ?? clocks.p2,
      );
      series.completeBreaker();
    },
    [match, series],
  );

  const breaker = useLocalRulebreaker({
    active: series.phase === "breaker",
    gridSize: gridForGameNumber(series.gameNumber + 1),
    gameNumber: series.gameNumber + 1,
    boardMode: boardModeForGameNumber(series.gameNumber + 1),
    patterns: patternsForLeg(series.gameNumber + 1, picked5),
    botMode: false,
    onComplete: onBreakerComplete,
  });

  const onLimitComplete = useCallback(
    (outcome: { reset: Parameters<typeof match.reset>[1] }) => {
      match.reset(outcome.reset?.starter ?? "P1", outcome.reset);
      clock.reset(matchMsForGrid(outcome.reset?.gridSize ?? 5));
      series.completeLimitbreaker();
    },
    [match, series],
  );

  const limitbreaker = useLocalLimitbreaker({
    active: series.phase === "limitbreaker",
    botMode: false,
    onComplete: onLimitComplete,
  });

  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "any");
  useRulebreakerPendingSound(series.phase === "breaker" || series.phase === "limitbreaker");

  const handleNextGame = () => {
    audio.sfx.transition();
    series.advanceToNextGame();
  };
  const handlePlayAgain = () => {
    audio.sfx.transition();
    series.resetSeries();
  };

  const p1Display = username ? username.toUpperCase() : P1_LABEL;
  const p2Display = P2_LABEL;

  const lastGlyph =
    series.lastOutcome === "P1"
      ? palette.glyphP1
      : series.lastOutcome === "P2"
      ? palette.glyphP2
      : null;
  const intermissionTitle =
    series.lastOutcome === "DRAW"
      ? `GAME ${series.gameNumber} DRAWN`
      : `${lastGlyph} WINS GAME ${series.gameNumber}`;
  const scoreLine = `${palette.glyphP1} ${series.p1Points} – ${series.p2Points} ${palette.glyphP2} · ${seriesScoreLine(series.p1Points, series.p2Points)}`;

  const onCellPress = useCallback(
    (row: number, col: number) => {
      if (series.phase !== "playing") return;
      audio.sfx.place();
      match.place(row, col);
    },
    [audio, match, series.phase],
  );

  const status = useMemo(() => {
    if (series.phase === "breaker") return "PROTOCOL BREAKER";
    if (series.phase === "limitbreaker") return "LIMITBREAKER";
    if (match.result.status === "won") {
      return `${pieceGlyph(match.result.winner!)} WINS`;
    }
    if (match.result.status === "draw") return "DRAW";
    return `${pieceGlyph(match.current)} TO PLAY`;
  }, [match.current, match.result.status, match.result.winner, series.phase]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    series.phase === "breaker" || series.phase === "limitbreaker"
      ? "warn"
      : match.result.status === "won"
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
    series.resetSeries();
  };

  const rbMySlot =
    breaker.tossWinner === "P2" ? "P2" : breaker.tossWinner === "P1" ? "P1" : "P1";

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
            activePatternIds={match.activePatterns}
          />
          <Caption tone="muted">
            G{series.gameNumber} · {gridSize}×{gridSize} · {match.movesPlayed} MV
          </Caption>
        </Row>
      </Row>

      <View style={{ marginTop: space[3] }}>
        <MatchClockRow
          p1Label={clock.p1Label}
          p2Label={clock.p2Label}
          active={clock.active}
          p1Name={p1Display}
          p2Name={p2Display}
        />
      </View>

      <View style={styles.hudSlot}>
        <CenterRuleBanner
          visible={match.centerRuleHint && match.movesPlayed === 0 && gridSize !== 6}
          gridSize={gridSize}
        />
        <ExtraTurnsBadge count={match.extraTurns} player={match.extraTurnsHolder} />
        <VStack gap={1} align="center" style={{ marginTop: space[2] }}>
          <Eyebrow tone={statusTone}>{status}</Eyebrow>
          <Caption tone="muted" center style={styles.scoreLine}>
            {scoreLine}
          </Caption>
        </VStack>
      </View>

      <View style={{ flex: 1, minHeight: 0, justifyContent: "center", marginTop: space[2] }}>
        <BoardGrid
          gridSize={gridSize}
          board={match.board}
          lastMove={match.lastMove}
          winningLine={match.result.line}
          disabled={!match.inputEnabled || series.phase !== "playing"}
          onCellPress={onCellPress}
        />
      </View>

      <SeriesOverlay
        visible={series.phase === "intermission"}
        title={intermissionTitle}
        subtitle={`Series  ${scoreLine}`}
        actionLabel={`NEXT GAME (G${series.gameNumber + 1})`}
        onAction={handleNextGame}
      />
      <SeriesOverlay
        visible={series.phase === "leg_transition"}
        title={`LEVEL UP · ${series.legTransitionLabel ?? "NEXT LEG"}`}
        subtitle="New board size — new patterns"
        actionLabel={`START ${series.legTransitionLabel ?? "NEXT LEG"}`}
        onAction={handleNextGame}
      />
      <SeriesOverlay
        visible={series.phase === "over"}
        title={
          series.seriesWinner === "P1"
            ? `${palette.glyphP1} WINS THE MATCH`
            : series.seriesWinner === "P2"
            ? `${palette.glyphP2} WINS THE MATCH`
            : "MATCH DRAWN"
        }
        subtitle={`Final  ${palette.glyphP1} ${series.p1Points} – ${series.p2Points} ${palette.glyphP2}`}
        actionLabel="PLAY AGAIN"
        onAction={handlePlayAgain}
      />

      <RulebreakerOverlay
        visible={breaker.visible}
        phase={breaker.phase}
        boardMode={breaker.boardMode}
        gameNumber={series.gameNumber + 1}
        mySlot={rbMySlot}
        tossWinner={breaker.tossWinner}
        coinResult={breaker.coinResult}
        gridSize={gridForGameNumber(series.gameNumber + 1)}
        rb6CellChooser={breaker.rb6CellChooser}
        onTossAction={breaker.handleTossAction}
      />
      <LimitbreakerOverlay
        visible={limitbreaker.visible}
        phase={limitbreaker.phase}
        tossWinner={limitbreaker.tossWinner}
        coinResult={limitbreaker.coinResult}
        mySlot="P1"
        nextSlot={limitbreaker.nextSlot}
        bans={limitbreaker.bans}
        remainingBoard={limitbreaker.remainingBoard}
        onPickChoice={limitbreaker.pickChoice}
        onPickFirst={limitbreaker.pickFirst}
        onPickBan={limitbreaker.pickBan}
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

const styles = StyleSheet.create({
  hudSlot: {
    minHeight: 72,
    justifyContent: "center",
    marginTop: space[2],
  },
  scoreLine: {
    paddingHorizontal: space[2],
  },
});
