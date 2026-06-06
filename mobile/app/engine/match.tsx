/**
 * AI Engine match — human vs server bot (``/api/bot/move``).
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";

import { BoardGrid } from "@/components/game/BoardGrid";
import { PatternsToggle } from "@/components/game/PatternsToggle";
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
import { defaultPatternsForGrid, matchMsForGrid, parseGridParam } from "@/lib/game/boardConfig";
import { analyzeGame, type AnalyzeResult } from "@/lib/syros";
import { fetchProfile } from "@/lib/profile";
import { useEngineMatch } from "@/lib/hooks/useEngineMatch";
import { useMatchClock } from "@/lib/hooks/useMatchClock";
import { useMatchSeries } from "@/lib/hooks/useMatchSeries";
import {
  useGameEndSounds,
  useMatchGameBgm,
} from "@/lib/hooks/useMatchSounds";
import { colors, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function EngineMatchScreen() {
  const params = useLocalSearchParams<{
    difficulty?: string;
    label?: string;
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
  const botName = (params.label ?? "BOT").toUpperCase();
  const gridSize = parseGridParam(params.grid);
  const palette = usePalette();
  const patterns = params.patterns ? params.patterns.split(",").filter(Boolean) : undefined;

  const match = useEngineMatch({ difficulty, gridSize, patterns });
  const clock = useMatchClock(
    match.current,
    match.result.status === "playing",
    matchMsForGrid(gridSize),
  );
  const series = useMatchSeries(match.result, match.reset);
  const audio = useGameAudio();
  useMatchGameBgm();
  useGameEndSounds(match.result.status, match.result.winner, "P1");

  const handleNextGame = () => {
    audio.sfx.transition();
    series.nextGame();
    clock.reset();
  };
  const handlePlayAgain = () => {
    audio.sfx.transition();
    series.resetSeries();
    clock.reset();
  };

  // Refresh profile once the leg is decided (picks up bot-defeat rewards/XP).
  const profileSynced = useRef(false);
  useEffect(() => {
    if (profileSynced.current) return;
    if (series.phase !== "over") return;
    profileSynced.current = true;
    fetchProfile().catch(() => undefined);
  }, [series.phase]);

  const scoreLine = `YOU ${series.p1Points} – ${series.p2Points} ${botName} · BO3 (first to 2 wins)`;
  const intermissionTitle =
    series.lastOutcome === "P1"
      ? `YOU WIN GAME ${series.gameNumber}`
      : series.lastOutcome === "P2"
      ? `${botName} WINS GAME ${series.gameNumber}`
      : `GAME ${series.gameNumber} DRAWN`;
  const legOverTitle =
    series.seriesWinner === "P1" ? "VICTORY — YOU WIN THE LEG" : `DEFEAT — ${botName} WINS THE LEG`;

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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/engine");
  };

  // ── Syros post-game analysis ──────────────────────────────────
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
        selectedPatterns: patterns ?? defaultPatternsForGrid(gridSize),
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
          p1Name="X"
          p2Name="Y"
        />
      </View>

      <Row justify="between" align="center" style={{ marginTop: space[4] }}>
        <PlayerTile label={`YOU · ${palette.glyphP1}`} color={palette.p1} active={match.current === "P1" && match.result.status === "playing"} />
        <PlayerTile label={`${botName} · ${palette.glyphP2}`} color={palette.p2} active={match.current === "P2" && match.result.status === "playing"} />
      </Row>

      {/* Fixed-height HUD slot so the board never shifts when the
          center-rule banner / extra-turns badge / spinner appear. */}
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
          <Caption tone="muted">{scoreLine}</Caption>
        </VStack>
      </View>

      <View style={{ flex: 1, minHeight: 0, justifyContent: "center" }}>
        <BoardGrid
          gridSize={gridSize}
          board={match.board}
          lastMove={match.lastMove}
          winningLine={match.result.line}
          disabled={!match.inputEnabled}
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
        title={legOverTitle}
        subtitle={`Final  YOU ${series.p1Points} – ${series.p2Points} ${botName}`}
        actionLabel="PLAY AGAIN"
        onAction={handlePlayAgain}
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
            New leg
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
              <AnalysisRow label={`YOU (X)`} s={analysis.summary.P1} />
              <View style={{ height: space[3] }} />
              <AnalysisRow label={`${botName} (Y)`} s={analysis.summary.P2} />
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
  hudSlot: {
    height: 92,
    justifyContent: "center",
  },
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
