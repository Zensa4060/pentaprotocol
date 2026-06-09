/**
 * Career match detail — round replay + Syros analyzer.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { BoardGrid } from "@/components/game/BoardGrid";
import { SyrosAnalysisModal } from "@/components/syros/SyrosAnalysisModal";
import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Title,
} from "@/components/ui";
import { fetchCareerMatch } from "@/lib/career";
import {
  boardAtMoveIndex,
  boardSizeFromRound,
  careerResultLabel,
  formatCareerDate,
  formatDurationShort,
  lastMoveAtIndex,
  normalizeCareerMoves,
  patternsForRound,
} from "@/lib/careerHelpers";
import { boardSideForGrid } from "@/lib/game/boardLayout";
import { analyzeGame, type AnalyzeResult } from "@/lib/syros";
import type { CareerMatch, CareerMatchRound } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function CareerMatchDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; game?: string }>();
  const matchId = String(params.id ?? "");
  const gameParam = params.game ? Number.parseInt(String(params.game), 10) : NaN;

  const [match, setMatch] = useState<CareerMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [moveIdx, setMoveIdx] = useState(-1);

  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);

  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (!matchId) {
      setError("Missing match id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCareerMatch(matchId)
      .then((m) => {
        if (cancelled) return;
        setMatch(m);
        const rounds = m.match_rounds ?? [];
        if (Number.isFinite(gameParam) && gameParam >= 1) {
          const idx = rounds.findIndex((r) => Number(r.game_number) === gameParam);
          if (idx >= 0) setRoundIdx(idx);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load match.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameParam, matchId]);

  const rounds = useMemo(
    () =>
      (match?.match_rounds ?? []).map((r) => ({
        ...r,
        board: Array.isArray(r.board) ? r.board : [],
        moves: Array.isArray(r.moves) ? r.moves : [],
      })),
    [match?.match_rounds],
  );

  const currentRound: CareerMatchRound | null = rounds[roundIdx] ?? null;
  const moves = useMemo(
    () => normalizeCareerMoves(currentRound?.moves),
    [currentRound?.moves],
  );
  const gridSize = currentRound ? boardSizeFromRound(currentRound) : 5;
  const boardSide = boardSideForGrid(gridSize, screenWidth);
  const board = currentRound ? boardAtMoveIndex(currentRound, moveIdx) : [];
  const lastMoveRaw = currentRound ? lastMoveAtIndex(currentRound, moveIdx) : null;
  const lastMove: [number, number] | null = lastMoveRaw
    ? [lastMoveRaw.row, lastMoveRaw.col]
    : null;

  useEffect(() => {
    setMoveIdx(moves.length > 0 ? moves.length - 1 : -1);
  }, [roundIdx, moves.length]);

  const canAnalyze = moves.length >= 2;

  const onAnalyze = async () => {
    if (!currentRound || !canAnalyze) return;
    setAnalyzing(true);
    setShowAnalysis(true);
    setAnalysis(null);
    try {
      const res = await analyzeGame({
        boardSize: gridSize,
        selectedPatterns: patternsForRound(currentRound),
        moves,
      });
      setAnalysis(res);
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/career");
  };

  if (loading) {
    return (
      <Screen padded>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (error || !match) {
    return (
      <Screen padded>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={goBack} hitSlop={12}>
          <Caption tone="muted">← BACK</Caption>
        </Pressable>
        <Caption tone="warn" style={{ marginTop: space[4] }}>{error ?? "Match not found."}</Caption>
      </Screen>
    );
  }

  const headline = careerResultLabel(match.result, match.surrendered_by, match.my_slot);

  return (
    <Screen padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Eyebrow tone="muted" style={{ marginTop: space[3] }}>MATCH ARCHIVE</Eyebrow>
      <Title style={{ marginTop: space[1] }}>VS {match.opponent_username.toUpperCase()}</Title>
      <Row justify="between" align="center" style={{ marginTop: space[2] }}>
        <Eyebrow
          tone={
            match.result === "win" ? "success" : match.result === "draw" ? "warn" : "danger"
          }
        >
          {headline}
        </Eyebrow>
        <Caption tone="muted">{formatCareerDate(match.played_at)}</Caption>
      </Row>
      {match.p1_time_used_ms != null || match.p2_time_used_ms != null ? (
        <Caption tone="muted" style={{ marginTop: space[1] }}>
          P1 {formatDurationShort(match.p1_time_used_ms ?? 0)} · P2{" "}
          {formatDurationShort(match.p2_time_used_ms ?? 0)}
        </Caption>
      ) : null}

      {rounds.length > 0 ? (
        <>
          <Caption tone="muted" style={{ marginTop: space[5], marginBottom: space[2] }}>
            ROUND SEQUENCE
          </Caption>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space[3] }}>
            <Row gap={2}>
              {rounds.map((r, i) => (
                <Pressable
                  key={`${r.game_number ?? i}-${i}`}
                  style={[styles.roundChip, roundIdx === i && styles.roundChipOn]}
                  onPress={() => setRoundIdx(i)}
                >
                  <Caption tone={roundIdx === i ? "accent" : "muted"}>
                    G{r.game_number ?? i + 1}
                  </Caption>
                  <Caption tone="muted" style={{ fontSize: 10 }}>
                    {r.board_mode ?? `${boardSizeFromRound(r)}×${boardSizeFromRound(r)}`}
                  </Caption>
                </Pressable>
              ))}
            </Row>
          </ScrollView>

          <View style={[styles.boardSlot, { height: boardSide }]}>
            <BoardGrid
              gridSize={gridSize}
              sideLength={boardSide}
              board={board}
              lastMove={lastMove}
              winningLine={null}
              disabled
              onCellPress={() => undefined}
            />
          </View>

          <Row justify="between" align="center" style={{ marginTop: space[3] }}>
            <Btn
              variant="secondary"
              onPress={() => setMoveIdx((i) => Math.max(-1, i - 1))}
              disabled={moveIdx < 0}
            >
              ◀ Prev
            </Btn>
            <Caption tone="muted">
              Move {moveIdx + 1} / {moves.length}
            </Caption>
            <Btn
              variant="secondary"
              onPress={() => setMoveIdx((i) => Math.min(moves.length - 1, i + 1))}
              disabled={moveIdx >= moves.length - 1}
            >
              Next ▶
            </Btn>
          </Row>

          <Btn
            variant="primary"
            onPress={onAnalyze}
            disabled={!canAnalyze}
            style={{ marginTop: space[4] }}
          >
            Syros analyzer
          </Btn>
          {!canAnalyze ? (
            <Caption tone="muted" center style={{ marginTop: space[2] }}>
              This round has no stored move list (older matches may be summary-only).
            </Caption>
          ) : null}
        </>
      ) : (
        <Body tone="muted" style={{ marginTop: space[5] }}>
          No round data stored for this match.
        </Body>
      )}

      <SyrosAnalysisModal
        visible={showAnalysis}
        loading={analyzing}
        analysis={analysis}
        p1Label="P1"
        p2Label={match.opponent_username.toUpperCase()}
        onClose={() => setShowAnalysis(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: space[10],
  },
  roundChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    minWidth: 64,
    alignItems: "center",
  },
  roundChipOn: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgRaised,
  },
  boardSlot: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});
