/**
 * AI Engine match — human vs server bot with triple-leg series + breakers.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";

import { BotRewardOverlay } from "@/components/game/BotRewardOverlay";
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
  Body,
  Btn,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Spinner,
  Stack as VStack,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import type { EngineDifficulty } from "@/lib/botApi/botMove";
import {
  ALL_BOT_IDS,
  BOT_LABEL,
  type BotId,
} from "@/lib/botRewards";
import {
  defaultPatternsForGrid,
  matchMsForGrid,
} from "@/lib/game/boardConfig";
import { analyzeGame, type AnalyzeResult } from "@/lib/syros";
import { claimBotDefeat } from "@/lib/profile";
import { useEngineMatch } from "@/lib/hooks/useEngineMatch";
import { useLocalLimitbreaker } from "@/lib/hooks/useLocalLimitbreaker";
import { useLocalRulebreaker } from "@/lib/hooks/useLocalRulebreaker";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  boardModeForGameNumber,
  clockMsForGameReset,
  gridForGameNumber,
  patternsForLeg,
  seriesScoreLine,
  type SeriesPlayer,
} from "@/lib/hooks/seriesConfig";
import { useTripleLegSeries } from "@/lib/hooks/useTripleLegSeries";
import {
  useGameEndSounds,
  useMatchGameBgm,
  useRulebreakerPendingSound,
} from "@/lib/hooks/useMatchSounds";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function EngineMatchScreen() {
  const params = useLocalSearchParams<{
    difficulty?: string;
    label?: string;
    botId?: string;
    grid?: string;
    patterns?: string;
  }>();
  const VALID_DIFFICULTIES: EngineDifficulty[] = [
    "easy", "medium", "normal", "hard", "machine_god", "danger",
  ];
  const difficulty: EngineDifficulty = VALID_DIFFICULTIES.includes(
    params.difficulty as EngineDifficulty,
  )
    ? (params.difficulty as EngineDifficulty)
    : "hard";
  const botIdParam = (params.botId ?? "").toLowerCase();
  const botId: BotId | null = ALL_BOT_IDS.includes(botIdParam as BotId)
    ? (botIdParam as BotId)
    : null;
  const botName = (params.label ?? BOT_LABEL.baltazar).toUpperCase();
  const palette = usePalette();
  const username = useAuthStore((s) => s.user?.username);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const picked5 = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;

  const match = useEngineMatch({ difficulty, gridSize: 5, patterns: picked5 });
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
    botMode: true,
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
    botMode: true,
    onComplete: onLimitComplete,
  });

  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "P1");
  useRulebreakerPendingSound(series.phase === "breaker" || series.phase === "limitbreaker");

  const [rewardVisible, setRewardVisible] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [rewardUnlocked, setRewardUnlocked] = useState<string | null>(null);
  const claimRef = useRef(false);

  useEffect(() => {
    if (series.phase !== "over") {
      claimRef.current = false;
      return;
    }
    if (claimRef.current) return;
    if (series.seriesWinner !== "P1") return;
    if (!botId || !isAuthenticated) return;
    claimRef.current = true;
    claimBotDefeat(botId)
      .then((data) => {
        setXpAwarded(data.xp_awarded ?? 0);
        setRewardUnlocked(data.reward_unlocked ?? null);
        if ((data.xp_awarded ?? 0) > 0 || data.reward_unlocked) {
          setRewardVisible(true);
        }
      })
      .catch(() => {
        claimRef.current = false;
      });
  }, [botId, isAuthenticated, series.phase, series.seriesWinner]);

  const handleNextGame = () => {
    audio.sfx.transition();
    series.advanceToNextGame();
  };
  const handlePlayAgain = () => {
    audio.sfx.transition();
    series.resetSeries();
  };

  const p1Display = (username ?? "YOU").toUpperCase();
  const scoreLine = `${p1Display} ${series.p1Points} – ${series.p2Points} ${botName} · ${seriesScoreLine(series.p1Points, series.p2Points)}`;
  const intermissionTitle =
    series.lastOutcome === "P1"
      ? `YOU WIN GAME ${series.gameNumber}`
      : series.lastOutcome === "P2"
      ? `${botName} WINS GAME ${series.gameNumber}`
      : `GAME ${series.gameNumber} DRAWN`;
  const legOverTitle =
    series.seriesWinner === "P1"
      ? `VICTORY — YOU WIN THE MATCH`
      : series.seriesWinner === "P2"
      ? `DEFEAT — ${botName} WINS THE MATCH`
      : "MATCH DRAWN";

  const onCellPress = useCallback(
    (row: number, col: number) => {
      if (series.phase !== "playing") return;
      if (match.inputEnabled) audio.sfx.place();
      match.placeHuman(row, col);
    },
    [audio, match, series.phase],
  );

  const status = useMemo(() => {
    if (series.phase === "breaker") return "PROTOCOL BREAKER";
    if (series.phase === "limitbreaker") return "LIMITBREAKER";
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
    series.phase,
  ]);

  const statusTone: "default" | "accent" | "info" | "muted" | "warn" =
    match.botError
      ? "warn"
      : series.phase === "breaker" || series.phase === "limitbreaker"
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

  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const onAnalyze = async () => {
    if (match.moves.length < 2) return;
    setAnalyzing(true);
    setShowAnalysis(true);
    try {
      const res = await analyzeGame({
        boardSize: gridSize,
        selectedPatterns: match.activePatterns,
        moves: match.moves.map((m) => ({ player: m.player, row: m.row, col: m.col })),
      });
      setAnalysis(res);
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
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
          p2Name={botName}
        />
      </View>

      <View style={styles.hudSlot}>
        <CenterRuleBanner
          visible={match.centerRuleHint && match.movesPlayed === 0 && gridSize !== 6}
          gridSize={gridSize}
        />
        <ExtraTurnsBadge count={match.extraTurns} player={match.extraTurnsHolder} />
        <VStack gap={1} align="center" style={{ marginTop: space[2] }}>
          <Row gap={2} align="center" justify="center">
            {match.botThinking ? <Spinner tone="muted" /> : null}
            <Eyebrow tone={statusTone} center>
              {status}
            </Eyebrow>
          </Row>
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
        title={legOverTitle}
        subtitle={`Final  ${p1Display} ${series.p1Points} – ${series.p2Points} ${botName}`}
        actionLabel="PLAY AGAIN"
        onAction={handlePlayAgain}
      />

      <RulebreakerOverlay
        visible={breaker.visible}
        phase={breaker.phase}
        boardMode={breaker.boardMode}
        gameNumber={series.gameNumber + 1}
        mySlot="P1"
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
      <BotRewardOverlay
        visible={rewardVisible}
        botId={botId}
        xpAwarded={xpAwarded}
        rewardUnlocked={rewardUnlocked}
        onDismiss={() => setRewardVisible(false)}
      />

      <MoveLogPanel entries={match.moveLog} />

      {match.result.status !== "playing" && match.moves.length >= 2 ? (
        <View style={{ marginTop: space[3] }}>
          <Btn variant="secondary" onPress={onAnalyze}>
            Analyze with Syros
          </Btn>
        </View>
      ) : null}

      <Row gap={3} style={{ marginTop: space[3], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" onPress={() => router.replace("/engine")}>
            Pick again
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" onPress={handlePlayAgain}>
            New match
          </Btn>
        </View>
      </Row>

      <SyrosAnalysisModal
        visible={showAnalysis}
        loading={analyzing}
        analysis={analysis}
        botName={botName}
        onClose={() => setShowAnalysis(false)}
      />
    </Screen>
  );
}

function SyrosAnalysisModal({
  visible,
  loading,
  analysis,
  botName,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  analysis: AnalyzeResult | null;
  botName: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={analysisStyles.scrim} onPress={onClose}>
        <Pressable style={analysisStyles.card} onPress={() => undefined}>
          <Row gap={3} align="center">
            <Image source={SYROS_LOGO} style={analysisStyles.logo} resizeMode="contain" />
            <Eyebrow tone="accent">SYROS · ANALYSIS</Eyebrow>
          </Row>
          {loading ? (
            <Body tone="muted" style={{ marginTop: space[4] }}>Syros is reading the board…</Body>
          ) : !analysis ? (
            <Body tone="muted" style={{ marginTop: space[4] }}>
              Analysis unavailable for this game.
            </Body>
          ) : (
            <View style={{ marginTop: space[4] }}>
              <AnalysisRow label="YOU" s={analysis.summary.P1} />
              <View style={{ height: space[3] }} />
              <AnalysisRow label={botName} s={analysis.summary.P2} />
            </View>
          )}
          <View style={{ height: space[4] }} />
          <Btn variant="primary" onPress={onClose}>Close</Btn>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AnalysisRow({ label, s }: { label: string; s: AnalyzeResult["summary"]["P1"] }) {
  return (
    <View style={analysisStyles.row}>
      <Row justify="between" align="center">
        <Body style={{ fontWeight: "800" }}>{label}</Body>
        <Heading tone="accent">{s.accuracy}%</Heading>
      </Row>
      <Caption tone="muted" style={{ marginTop: space[1] }}>
        ★ {s.best_moves} best · {s.good} good · {s.inaccuracies} inacc · {s.mistakes} mist · {s.blunders} blund
      </Caption>
    </View>
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

const SYROS_LOGO = require("../../assets/images/syros-pfp.png");

const analysisStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  logo: { width: 40, height: 40, borderRadius: radii.pill },
  row: {
    backgroundColor: colors.bgRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
});
