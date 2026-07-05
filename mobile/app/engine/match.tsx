/**
 * AI Engine match — human vs server bot.
 *
 * Regular AI ladder bouts are **BO3 on the chosen board size** (web
 * ``isLocalShortSeries``): max 3 games, first to 2, drawable, Rulebreaker
 * before the G3 decider. Unranked queue **filler** bots instead play the
 * full multiplayer triple-leg ladder (first to 3, 9 games + Limitbreaker).
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { BotRewardOverlay } from "@/components/game/BotRewardOverlay";
import { BoardGrid } from "@/components/game/BoardGrid";
import { LimitbreakerOverlay } from "@/components/game/LimitbreakerOverlay";
import { MatchStatusHud } from "@/components/game/MatchStatusHud";
import { AudioSettingsButton } from "@/components/game/AudioSettingsButton";
import { PatternsToggle } from "@/components/game/PatternsToggle";
import { RulebreakerOverlay } from "@/components/game/RulebreakerOverlay";
import {
  ExtraTurnTokenRow,
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
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import type { EngineDifficulty } from "@/lib/botApi/botMove";
import {
  ALL_BOT_IDS,
  BOT_LABEL,
  type BotId,
} from "@/lib/botRewards";
import { boardSideForGrid } from "@/lib/game/boardLayout";
import { matchMsForGrid, parseGridParam } from "@/lib/game/boardConfig";
import { SyrosAnalysisModal } from "@/components/syros/SyrosAnalysisModal";
import { analyzeGame, type AnalyzeResult } from "@/lib/syros";
import { claimBotDefeat } from "@/lib/profile";
import { useEngineMatch } from "@/lib/hooks/useEngineMatch";
import { useLocalLimitbreaker } from "@/lib/hooks/useLocalLimitbreaker";
import { useLocalRulebreaker } from "@/lib/hooks/useLocalRulebreaker";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import {
  clockMsForGameReset,
  specBoardModeForGame,
  specGridForGame,
  specPatternsForGame,
  specScoreSuffix,
  type SeriesPlayer,
  type SeriesSpec,
} from "@/lib/hooks/seriesConfig";
import { useTripleLegSeries } from "@/lib/hooks/useTripleLegSeries";
import {
  useGameEndSounds,
  useMatchGameBgm,
  useRulebreakerPendingSound,
} from "@/lib/hooks/useMatchSounds";
import { useAuthStore } from "@/lib/store";
import {
  difficultyForLevel,
  type UnrankedBotLevel,
} from "@/lib/unrankedBots";
import type { GridSize } from "@/lib/game/boardConfig";
import { colors, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

/** Named hard bots that use the ranked BGM track (one per board chain). */
const RANKED_BOT_IDS = new Set<BotId>(["jr", "him", "her"]);

export default function EngineMatchScreen() {
  const params = useLocalSearchParams<{
    difficulty?: string;
    label?: string;
    botId?: string;
    grid?: string;
    patterns?: string;
    unrankedFiller?: string;
    botTier?: string;
    botLevel?: string;
    botSyros?: string;
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
  const isUnrankedFiller = params.unrankedFiller === "1";
  const fillerTier = (params.botTier ?? "SKILLED") as UnrankedBotLevel;
  const botName = (params.label ?? BOT_LABEL.baltazar).toUpperCase();
  const palette = usePalette();
  const { width: screenWidth } = useWindowDimensions();
  const username = useAuthStore((s) => s.user?.username);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const picked5 = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;
  const chosenGrid = parseGridParam(params.grid);

  // Filler bots replay the full MP ladder; the regular AI ladder is BO3
  // on whichever board the player queued (5×5 / 6×6 / 7×7).
  const spec = useMemo<SeriesSpec>(
    () => (isUnrankedFiller ? { kind: "full", grid: 5 } : { kind: "bo3", grid: chosenGrid }),
    [chosenGrid, isUnrankedFiller],
  );

  const resolveFillerDifficulty = useMemo(() => {
    if (!isUnrankedFiller) return undefined;
    return (grid: GridSize) => {
      const size = grid === 5 ? "5x5" : grid === 6 ? "6x6" : "7x7";
      return difficultyForLevel(fillerTier, size);
    };
  }, [fillerTier, isUnrankedFiller]);

  const fillerDifficulty = isUnrankedFiller
    ? difficultyForLevel(fillerTier, "5x5")
    : difficulty;

  const match = useEngineMatch({
    difficulty: fillerDifficulty,
    resolveDifficulty: resolveFillerDifficulty,
    gridSize: specGridForGame(spec, 1),
    patterns: picked5,
  });
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

  // Mindbreaker ban info for the pattern-reference sheet. The bot's bans
  // stay hidden from the human; the human's own bans are shown flagged.
  const [rbBanInfo, setRbBanInfo] = useState<{
    banned: string[];
    banActor: SeriesPlayer | null;
  }>({ banned: [], banActor: null });

  const onResetGame = useCallback(
    (starter: SeriesPlayer, nextGameNumber: number) => {
      const grid = specGridForGame(spec, nextGameNumber);
      const pats = specPatternsForGame(spec, nextGameNumber, picked5);
      const clocks = clockMsForGameReset(grid, nextGameNumber, null);
      setRbBanInfo({ banned: [], banActor: null });
      match.reset(starter, { gridSize: grid, patterns: pats, c3Blocked: false });
      clock.reset(clocks.p1, clocks.p2);
    },
    [clock, match, picked5, spec],
  );

  const series = useTripleLegSeries(match.result, onResetGame, spec);

  const onBreakerComplete = useCallback(
    (outcome: { reset: Parameters<typeof match.reset>[1] }) => {
      const nextGn = series.gameNumber + 1;
      const grid = outcome.reset?.gridSize ?? specGridForGame(spec, nextGn);
      const clocks = clockMsForGameReset(grid, nextGn, null);
      setRbBanInfo({
        banned: outcome.reset?.bannedPatterns ?? [],
        banActor: outcome.reset?.banActor ?? null,
      });
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
    () => specPatternsForGame(spec, nextGn, picked5),
    [nextGn, picked5?.join("|"), spec],
  );

  const breaker = useLocalRulebreaker({
    active: series.phase === "breaker",
    gridSize: specGridForGame(spec, nextGn),
    gameNumber: nextGn,
    boardMode: specBoardModeForGame(spec, nextGn),
    patterns: breakerPatterns,
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
  // The named hard bots (JR. / HIM / HER) play the theme's ranked track,
  // like ranked PvP — every other bot uses the normal game track. Mirrors
  // the web's getBgmCtx rankedBotNames set in AppShell.
  useMatchGameBgm(botId && RANKED_BOT_IDS.has(botId) ? "ranked" : "game");
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
  const scoreLine = `${p1Display} ${series.p1Points} – ${series.p2Points} ${botName} · ${specScoreSuffix(spec)}`;
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

  useEffect(() => {
    const ms = matchMsForGrid(gridSize);
    clock.reset(ms, ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]);

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
          <AudioSettingsButton />
          <PatternsToggle
            gridSize={gridSize}
            enabled={match.result.status === "playing"}
            activePatternIds={
              rbBanInfo.banned.length > 0
                ? specPatternsForGame(spec, series.gameNumber, picked5)
                : match.activePatterns
            }
            bannedPatternIds={
              // The bot's bans stay hidden from the human for the whole game.
              rbBanInfo.banned.length > 0 && rbBanInfo.banActor !== "P2"
                ? rbBanInfo.banned
                : undefined
            }
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
          p2Name={botName}
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
        spinner={match.botThinking ? <Spinner tone="muted" /> : undefined}
      />

      {gridSize === 7 && series.phase === "playing" ? (
        <ExtraTurnTokenRow
          holder={match.extraTokenHolder}
          holderName={match.extraTokenHolder === "P1" ? p1Display : botName}
          used={match.extraTokenUsed}
          current={match.current}
          canUse={
            match.extraTokenHolder === "P1" &&
            match.result.status === "playing" &&
            match.extraTurns === 0
          }
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
        gameNumber={nextGn}
        mySlot="P1"
        tossWinner={breaker.tossWinner}
        coinResult={breaker.coinResult}
        gridSize={specGridForGame(spec, nextGn)}
        rb6CellChooser={breaker.rb6CellChooser}
        rb6TimerOwner={breaker.rb6TimerOwner}
        winnerPickedRule={breaker.winnerPickedRule}
        firstPlayerChosen={breaker.firstPlayerChosen}
        bannedPatterns={breaker.bannedPatterns}
        c3Blocked={breaker.c3Blocked}
        hideBannedFromMe={
          // The bot's bans stay hidden from the human for the whole game.
          (breaker.winnerPickedRule === "ban" && breaker.tossWinner === "P2") ||
          (breaker.winnerPickedRule === "extra_turn" && breaker.tossWinner === "P1")
        }
        selectedPatterns={breakerPatterns}
        p1Name={p1Display}
        p2Name={botName}
        onDismiss={goBack}
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
        moves={match.moves}
        gridSize={gridSize}
        p1Label={p1Display}
        p2Label={botName}
        onClose={() => setShowAnalysis(false)}
      />
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
