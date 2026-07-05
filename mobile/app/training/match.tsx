/**
 * Training practice match — local BO3 on the chosen board size (web
 * ``isLocalShortSeries``): max 3 games, first to 2 wins, drawable, with a
 * Rulebreaker before the G3 decider. No leg escalation, no Limitbreaker.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AudioSettingsButton } from "@/components/game/AudioSettingsButton";
import { BoardGrid } from "@/components/game/BoardGrid";
import { MatchStatusHud } from "@/components/game/MatchStatusHud";
import { PatternsToggle } from "@/components/game/PatternsToggle";
import { RulebreakerOverlay } from "@/components/game/RulebreakerOverlay";
import {
  ExtraTurnTokenRow,
  MatchClockRow,
  MoveLogPanel,
  SeriesOverlay,
} from "@/components/game/MatchExtras";
import {
  Btn,
  Caption,
  Row,
  Screen,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { boardSideForGrid } from "@/lib/game/boardLayout";
import { matchMsForGrid, parseGridParam } from "@/lib/game/boardConfig";
import { pieceGlyph } from "@/lib/game/matchRules";
import { useLocalRulebreaker } from "@/lib/hooks/useLocalRulebreaker";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  useGameEndSounds,
  useMatchGameBgm,
  useRulebreakerPendingSound,
} from "@/lib/hooks/useMatchSounds";
import { usePracticeMatch } from "@/lib/hooks/usePracticeMatch";
import {
  clockMsForGameReset,
  specBoardModeForGame,
  specPatternsForGame,
  specScoreSuffix,
  type SeriesPlayer,
  type SeriesSpec,
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
  const { width: screenWidth } = useWindowDimensions();
  const username = useAuthStore((s) => s.user?.username);
  const chosenGrid = parseGridParam(params.grid);
  const picked = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;

  const spec = useMemo<SeriesSpec>(() => ({ kind: "bo3", grid: chosenGrid }), [chosenGrid]);

  const match = usePracticeMatch({ gridSize: chosenGrid, patterns: picked });
  const gridSize = match.gridSize;
  const boardSide = useMemo(
    () => boardSideForGrid(gridSize, screenWidth),
    [gridSize, screenWidth],
  );

  const clock = useMatchClock(
    match.current,
    match.result.status === "playing",
    matchMsForGrid(gridSize),
  );

  // Mindbreaker ban info for the pattern-reference sheet (pass-and-play:
  // both players share the screen, so bans are never hidden).
  const [rbBans, setRbBans] = useState<string[]>([]);

  const onResetGame = useCallback(
    (starter: SeriesPlayer, nextGameNumber: number) => {
      const pats = specPatternsForGame(spec, nextGameNumber, picked);
      const clocks = clockMsForGameReset(spec.grid, nextGameNumber, null);
      setRbBans([]);
      match.reset(starter, { gridSize: spec.grid, patterns: pats, c3Blocked: false });
      clock.reset(clocks.p1, clocks.p2);
    },
    [clock, match, picked, spec],
  );

  const series = useTripleLegSeries(match.result, onResetGame, spec);

  const onBreakerComplete = useCallback(
    (outcome: { reset: Parameters<typeof match.reset>[1] }) => {
      const nextGn = series.gameNumber + 1;
      const grid = outcome.reset?.gridSize ?? spec.grid;
      const clocks = clockMsForGameReset(grid, nextGn, null);
      setRbBans(outcome.reset?.bannedPatterns ?? []);
      match.reset(outcome.reset?.starter ?? "P1", outcome.reset);
      clock.reset(
        outcome.reset?.p1ClockMs ?? clocks.p1,
        outcome.reset?.p2ClockMs ?? clocks.p2,
      );
      series.completeBreaker();
    },
    [match, series, spec],
  );

  const nextGn = series.phase === "breaker" ? series.gameNumber + 1 : series.gameNumber;
  const breakerPatterns = useMemo(
    () => specPatternsForGame(spec, nextGn, picked),
    [nextGn, picked?.join("|"), spec],
  );

  const breaker = useLocalRulebreaker({
    active: series.phase === "breaker",
    gridSize: spec.grid,
    gameNumber: nextGn,
    boardMode: specBoardModeForGame(spec, nextGn),
    patterns: breakerPatterns,
    botMode: false,
    onComplete: onBreakerComplete,
  });

  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "any");
  useRulebreakerPendingSound(series.phase === "breaker");

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
  const scoreLine = `${p1Display} ${series.p1Points} – ${series.p2Points} ${p2Display} · ${specScoreSuffix(spec)}`;

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
    if (match.result.status === "won") {
      return `${pieceGlyph(match.result.winner!)} WINS`;
    }
    if (match.result.status === "draw") return "DRAW";
    return `${pieceGlyph(match.current)} TO PLAY`;
  }, [match.current, match.result.status, match.result.winner, series.phase]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    series.phase === "breaker"
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

  useEffect(() => {
    const ms = matchMsForGrid(gridSize);
    clock.reset(ms, ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]);

  return (
    <Screen padded background={palette.bg}>
      <Stack.Screen options={{ headerShown: false }} />

      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
          <Caption tone="muted">← BACK</Caption>
        </Pressable>
        <Row gap={2} align="center">
          <AudioSettingsButton />
          <PatternsToggle
            gridSize={gridSize}
            enabled={match.result.status === "playing"}
            activePatternIds={
              rbBans.length > 0
                ? specPatternsForGame(spec, series.gameNumber, picked)
                : match.activePatterns
            }
            bannedPatternIds={rbBans.length > 0 ? rbBans : undefined}
          />
          <Caption tone="muted">
            G{series.gameNumber} · {gridSize}×{gridSize}
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

      <MatchStatusHud
        gridSize={gridSize}
        showCenterBanner={
          match.centerRuleHint &&
          match.movesPlayed === 0 &&
          gridSize !== 6 &&
          !match.suppressCenterOpening
        }
        extraTurns={match.extraTurns}
        extraPlayer={match.extraTurnsHolder}
        status={status}
        statusTone={statusTone}
        scoreLine={scoreLine}
      />

      {gridSize === 7 && series.phase === "playing" ? (
        <ExtraTurnTokenRow
          holder={match.extraTokenHolder}
          holderName={
            match.extraTokenHolder ? pieceGlyph(match.extraTokenHolder) : ""
          }
          used={match.extraTokenUsed}
          current={match.current}
          canUse={match.result.status === "playing" && match.extraTurns === 0}
          onUse={match.useExtraTurnToken}
        />
      ) : null}

      <View style={[styles.boardSlot, { height: boardSide }]}>
        <BoardGrid
          gridSize={gridSize}
          sideLength={boardSide}
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
        gameNumber={nextGn}
        mySlot="P1"
        tossWinner={breaker.tossWinner}
        coinResult={breaker.coinResult}
        gridSize={spec.grid}
        rb6CellChooser={breaker.rb6CellChooser}
        rb6TimerOwner={breaker.rb6TimerOwner}
        winnerPickedRule={breaker.winnerPickedRule}
        firstPlayerChosen={breaker.firstPlayerChosen}
        bannedPatterns={breaker.bannedPatterns}
        c3Blocked={breaker.c3Blocked}
        selectedPatterns={breakerPatterns}
        localOffline
        p1Name={p1Display}
        p2Name={p2Display}
        onDismiss={goBack}
        onTossAction={breaker.handleTossAction}
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
  boardSlot: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});
