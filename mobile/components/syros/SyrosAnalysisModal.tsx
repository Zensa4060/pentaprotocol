/**
 * Syros post-game analysis — full-screen analyzer (web parity), shared
 * across engine + career flows.
 *
 * Walks the game move by move on a real board: the played stone is ringed
 * in its quality colour, the engine's preferred square pulses, and the
 * verdict line spells out what Syros would have played instead. Accuracy
 * summary cards sit on top; a colour-coded move strip jumps anywhere.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BoardGrid } from "@/components/game/BoardGrid";
import { Body, Btn, Caption, Eyebrow, Heading, Row } from "@/components/ui";
import { emptyBoard, type GridSize } from "@/lib/game/boardConfig";
import { boardSideForGrid } from "@/lib/game/boardLayout";
import { cellLabel } from "@/lib/game/matchRules";
import type { Board } from "@/lib/game/winCheck";
import type { AnalyzeMove, AnalyzeResult, MoveQuality } from "@/lib/syros";
import { colors, radii, space } from "@/theme/tokens";

const SYROS_LOGO = require("@/assets/images/syros-pfp.png");

const QUALITY_COLOR: Record<MoveQuality, string> = {
  best: "#22C55E",
  good: "#2DD4BF",
  inaccuracy: "#FACC15",
  mistake: "#FB923C",
  blunder: "#EF4444",
};

const QUALITY_LABEL: Record<MoveQuality, string> = {
  best: "BEST MOVE",
  good: "GOOD",
  inaccuracy: "INACCURACY",
  mistake: "MISTAKE",
  blunder: "BLUNDER",
};

interface SyrosAnalysisModalProps {
  visible: boolean;
  loading: boolean;
  analysis: AnalyzeResult | null;
  /** The game's moves — used to replay the board per annotation. */
  moves?: AnalyzeMove[];
  gridSize?: GridSize;
  p1Label?: string;
  p2Label?: string;
  onClose: () => void;
}

export function SyrosAnalysisModal({
  visible,
  loading,
  analysis,
  moves = [],
  gridSize = 5,
  p1Label = "YOU",
  p2Label = "OPPONENT",
  onClose,
}: SyrosAnalysisModalProps) {
  const { width: screenWidth } = useWindowDimensions();
  const boardSide = Math.min(boardSideForGrid(gridSize, screenWidth), screenWidth - 40);
  const annotations = analysis?.move_annotations ?? [];
  const [idx, setIdx] = useState(0);
  const stripRef = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIdx(Math.max(0, annotations.length - 1));
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, annotations.length]);

  // Board state after move idx (stone owners straight from the move list,
  // so Timebreaker trap conversions replay correctly).
  const boardAt = useMemo<Board>(() => {
    const b = emptyBoard(gridSize);
    for (let i = 0; i <= idx && i < moves.length; i += 1) {
      const m = moves[i];
      if (b[m.row]?.[m.col] === null) b[m.row][m.col] = m.player;
    }
    return b;
  }, [gridSize, idx, moves]);

  const ann = annotations[idx] ?? null;
  const qualityColor = ann ? QUALITY_COLOR[ann.quality] ?? colors.accent : colors.accent;
  const playedCell: [number, number] | null = ann ? ann.played : null;
  // Pulse the engine's preferred square when it differs from the move played.
  const engineCell: [number, number] | null =
    ann?.engine_best &&
    (ann.engine_best[0] !== ann.played[0] || ann.engine_best[1] !== ann.played[1])
      ? ann.engine_best
      : null;

  const nameOf = (p: "P1" | "P2") => (p === "P1" ? p1Label : p2Label);

  const verdict = ann
    ? engineCell
      ? `Syros preferred ${cellLabel(engineCell[0], engineCell[1])} — ${nameOf(ann.player)} played ${cellLabel(
          ann.played[0],
          ann.played[1],
        )} (${ann.score_delta >= 0 ? "+" : ""}${ann.score_delta.toFixed(2)})`
      : `${nameOf(ann.player)} found the engine's move — ${cellLabel(ann.played[0], ann.played[1])}`
    : "";

  const jump = (next: number) => {
    const clamped = Math.max(0, Math.min(annotations.length - 1, next));
    setIdx(clamped);
    stripRef.current?.scrollTo({ x: Math.max(0, clamped * 64 - 120), animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Header ── */}
          <Row justify="between" align="center">
            <Row gap={3} align="center">
              <Image source={SYROS_LOGO} style={styles.logo} resizeMode="contain" />
              <Eyebrow tone="accent">SYROS · ANALYSIS</Eyebrow>
            </Row>
            <Pressable onPress={onClose} hitSlop={12}>
              <Caption tone="muted">CLOSE ✕</Caption>
            </Pressable>
          </Row>

          {loading ? (
            <View style={styles.center}>
              <SyrosThinking />
            </View>
          ) : !analysis || annotations.length === 0 ? (
            <View style={styles.center}>
              <Body tone="muted">Analysis unavailable for this game.</Body>
            </View>
          ) : (
            <Animated.View style={{ opacity: fade }}>
              {/* ── Accuracy summary ── */}
              <Row gap={2} style={{ marginTop: space[4] }}>
                <SummaryCard label={p1Label} s={analysis.summary.P1} color={colors.accent} />
                <SummaryCard label={p2Label} s={analysis.summary.P2} color={colors.info} />
              </Row>

              {/* ── Verdict for the current move ── */}
              <View style={[styles.verdict, { borderColor: qualityColor }]}>
                <Row justify="between" align="center">
                  <Caption style={{ color: qualityColor, fontWeight: "900", letterSpacing: 1.2 }}>
                    {ann ? QUALITY_LABEL[ann.quality] : ""}
                  </Caption>
                  <Caption tone="muted">
                    MOVE {idx + 1} / {annotations.length} · {ann ? nameOf(ann.player) : ""}
                  </Caption>
                </Row>
                <Caption tone="muted" style={{ marginTop: 4, lineHeight: 18 }}>
                  {verdict}
                </Caption>
              </View>

              {/* ── Board replay ── */}
              <View style={[styles.boardSlot, { height: boardSide }]}>
                <BoardGrid
                  gridSize={gridSize}
                  sideLength={boardSide}
                  board={boardAt}
                  lastMove={playedCell}
                  winningLine={engineCell ? [engineCell] : null}
                  disabled
                />
              </View>
              <Row gap={4} justify="center" style={{ marginTop: space[1] }}>
                <LegendDot color={qualityColor} label="PLAYED" />
                {engineCell ? <LegendDot color={colors.accentHot ?? colors.accent} label="SYROS PICK" /> : null}
              </Row>

              {/* ── Move strip (tap to jump) ── */}
              <ScrollView
                ref={stripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: space[3], flexGrow: 0 }}
              >
                <Row gap={1}>
                  {annotations.map((a, i) => {
                    const col = QUALITY_COLOR[a.quality] ?? colors.border;
                    const isCurrent = i === idx;
                    return (
                      <Pressable
                        key={a.move_index}
                        onPress={() => jump(i)}
                        style={[
                          styles.moveChip,
                          { borderColor: isCurrent ? col : colors.border },
                          isCurrent && { backgroundColor: `${col}22` },
                        ]}
                      >
                        <Text style={[styles.moveChipText, { color: a.player === "P1" ? colors.accent : colors.info }]}>
                          {i + 1}. {a.player === "P1" ? "X" : "Y"}→{cellLabel(a.played[0], a.played[1])}
                        </Text>
                        <View style={[styles.moveChipDot, { backgroundColor: col }]} />
                      </Pressable>
                    );
                  })}
                </Row>
              </ScrollView>

              {/* ── Prev / next ── */}
              <Row gap={3} style={{ marginTop: space[3] }}>
                <View style={{ flex: 1 }}>
                  <Btn variant="secondary" disabled={idx <= 0} onPress={() => jump(idx - 1)}>
                    ◀ Prev
                  </Btn>
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="secondary"
                    disabled={idx >= annotations.length - 1}
                    onPress={() => jump(idx + 1)}
                  >
                    Next ▶
                  </Btn>
                </View>
              </Row>
            </Animated.View>
          )}

          <View style={{ height: space[4] }} />
          <Btn variant="primary" onPress={onClose}>
            Close
          </Btn>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  s,
  color,
}: {
  label: string;
  s: AnalyzeResult["summary"]["P1"];
  color: string;
}) {
  return (
    <View style={[styles.summaryCard, { borderColor: `${color}66` }]}>
      <Caption numberOfLines={1} style={{ fontWeight: "800" }}>
        {label}
      </Caption>
      <Heading style={{ color }}>{s.accuracy}%</Heading>
      <Caption tone="muted" style={{ fontSize: 10, lineHeight: 14 }}>
        ★{s.best_moves} best · {s.good} good{"\n"}
        {s.inaccuracies} inacc · {s.mistakes} mist · {s.blunders} blund
      </Caption>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={1} align="center">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Caption tone="muted" style={{ fontSize: 9 }}>
        {label}
      </Caption>
    </Row>
  );
}

/** Pulsing Syros avatar while the engine reads the board. */
function SyrosThinking() {
  const pulse = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.85, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ alignItems: "center", gap: space[3] }}>
      <Animated.Image
        source={SYROS_LOGO}
        style={{ width: 72, height: 72, borderRadius: 36, transform: [{ scale: pulse }] }}
        resizeMode="contain"
      />
      <Body tone="muted">Syros is reading the board…</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: space[5],
    paddingBottom: space[8],
  },
  logo: { width: 40, height: 40, borderRadius: radii.pill },
  center: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: space[3],
    gap: 2,
  },
  verdict: {
    marginTop: space[3],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: space[3],
  },
  boardSlot: {
    marginTop: space[3],
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  moveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.bgCard,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  moveChipText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  moveChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
