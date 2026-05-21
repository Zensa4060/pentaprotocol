/**
 * First-run onboarding tutorial — 3-slide carousel.
 *
 * Shown after legal acceptance when ``user.onboarding_tutorial``
 * is ``"none"``. Tap "Get started" to mark ``completed`` and
 * land on the home tab; "Skip" marks ``skipped`` (so the gate
 * doesn't return) but the distinction lets a future "What's new"
 * banner re-invite skippers to the full tutorial without
 * re-prompting completers.
 *
 * Implementation note: I deliberately avoided ``react-native-pager-view``.
 * The slide count is fixed at 3, contents are local strings,
 * and a state-driven swap with a horizontal indicator reads
 * cleaner than wrestling a pager native module for what's
 * essentially three static screens.
 */

import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack as VStack,
  Subheading,
  Title,
} from "@/components/ui";
import { ApiError, setTutorialState } from "@/lib/profile";
import { colors, radii, space } from "@/theme/tokens";

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  diagram: "board" | "patterns" | "ladder";
}

const SLIDES: Slide[] = [
  {
    eyebrow: "WELCOME TO PENTAPROTOCOL",
    title: "Five-in-a-row, evolved.",
    body:
      "A turn-based grid game built around shape recognition. Place stones on a 7×7 board, race to complete one of eight winning patterns — or chain 20 stones together.",
    diagram: "board",
  },
  {
    eyebrow: "WIN PATTERNS",
    title: "Eight ways to win.",
    body:
      "Y, L, V, C, T, ZIGZAG, straight lines, and diagonals. Each shape has every rotation + reflection live, so they show up where you don't expect.",
    diagram: "patterns",
  },
  {
    eyebrow: "HOW TO START",
    title: "Train first, climb later.",
    body:
      "Tap TRAINING on the home tab to learn the patterns against the engine. Multiplayer ladder and AI engine modes are landing in the next update.",
    diagram: "ladder",
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const finalize = async (state: "skipped" | "completed") => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await setTutorialState(state);
      router.replace("/");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail
          ? err.detail
          : "Could not save your progress. Try again.";
      Alert.alert("Try again", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = () => {
    if (isLast) {
      finalize("completed");
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen padded>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Caption tone="muted">
          {index + 1} / {SLIDES.length}
        </Caption>
        <Pressable
          onPress={() => finalize("skipped")}
          hitSlop={12}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Caption tone="muted">SKIP</Caption>
        </Pressable>
      </Row>

      {/* ── Slide content ───────────────────────────────────────── */}
      <View style={styles.slide}>
        <View style={{ alignItems: "center", marginBottom: space[7] }}>
          <Diagram kind={slide.diagram} />
        </View>
        <Eyebrow tone="accent">{slide.eyebrow}</Eyebrow>
        <View style={{ height: space[3] }} />
        <Title>{slide.title}</Title>
        <View style={{ height: space[4] }} />
        <Body tone="muted">{slide.body}</Body>
      </View>

      {/* ── Indicator + actions ─────────────────────────────────── */}
      <Row gap={2} justify="center" style={{ marginBottom: space[5] }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index ? styles.dotActive : null,
            ]}
          />
        ))}
      </Row>

      <Btn variant="primary" size="lg" loading={submitting} onPress={onNext}>
        {isLast ? "Get started" : "Next"}
      </Btn>
      <View style={{ height: space[3] }} />
      {index > 0 ? (
        <Btn variant="ghost" onPress={() => setIndex((i) => Math.max(0, i - 1))}>
          Back
        </Btn>
      ) : (
        <View style={{ height: space[5] }} />
      )}
    </Screen>
  );
}

// ─── Slide diagrams ────────────────────────────────────────────────────────
// Tiny visual touch for each slide. Pure View blocks — no SVG, no assets, so
// they load instantly and remix per-tutorial. NOT the actual board renderer
// (Phase 6 will likely replace these with stylized native illustrations).

function Diagram({ kind }: { kind: Slide["diagram"] }) {
  if (kind === "board") return <BoardDiagram />;
  if (kind === "patterns") return <PatternsDiagram />;
  return <LadderDiagram />;
}

function BoardDiagram() {
  return (
    <View style={styles.diagramFrame}>
      <Subheading center>7 × 7</Subheading>
      <View style={{ height: space[3] }} />
      <View style={styles.miniBoard}>
        {Array.from({ length: 7 }).map((_, r) => (
          <View key={r} style={styles.miniRow}>
            {Array.from({ length: 7 }).map((__, c) => {
              const isP1 = (r === 2 && c === 2) || (r === 3 && c === 3) || (r === 4 && c === 4);
              const isP2 = (r === 1 && c === 5) || (r === 2 && c === 4) || (r === 3 && c === 2);
              return (
                <View
                  key={c}
                  style={[
                    styles.miniCell,
                    isP1 ? { backgroundColor: colors.accent } : null,
                    isP2 ? { backgroundColor: colors.info } : null,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function PatternsDiagram() {
  // Three example patterns laid out side-by-side: L, V, ZIGZAG.
  const patterns: number[][][] = [
    // L
    [[1, 0], [1, 0], [1, 0], [1, 1]],
    // V
    [[1, 0, 0, 0, 1], [0, 1, 0, 1, 0], [0, 0, 1, 0, 0]],
    // ZIGZAG
    [[1, 0, 1, 0], [0, 1, 0, 1]],
  ];
  return (
    <View style={styles.diagramFrame}>
      <Row gap={5} justify="center" align="center">
        {patterns.map((rows, i) => (
          <View key={i}>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.miniRow}>
                {row.map((cell, ci) => (
                  <View
                    key={ci}
                    style={[
                      styles.miniCell,
                      cell === 1 ? { backgroundColor: colors.accent } : { opacity: 0.4 },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        ))}
      </Row>
      <View style={{ height: space[3] }} />
      <Heading tone="muted" center>
        L · V · ZIGZAG
      </Heading>
    </View>
  );
}

function LadderDiagram() {
  return (
    <View style={[styles.diagramFrame, { paddingHorizontal: space[5] }]}>
      <VStack gap={3} fill>
        <LadderRow label="TRAINING" tone="default" />
        <LadderRow label="MULTIPLAYER" tone="muted" />
        <LadderRow label="AI ENGINE" tone="muted" />
      </VStack>
    </View>
  );
}

function LadderRow({ label, tone }: { label: string; tone: "default" | "muted" }) {
  return (
    <View style={[styles.ladderRow, tone === "default" ? styles.ladderRowActive : null]}>
      <Caption tone={tone === "default" ? "default" : "muted"} style={{ fontWeight: "700" }}>
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
  },
  diagramFrame: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 1.4,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    alignItems: "center",
    justifyContent: "center",
  },
  miniBoard: {
    backgroundColor: colors.bg,
    padding: 4,
    borderRadius: radii.sm,
  },
  miniRow: {
    flexDirection: "row",
  },
  miniCell: {
    width: 14,
    height: 14,
    marginRight: 2,
    marginBottom: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.bgRaised,
  },
  ladderRow: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  ladderRowActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgRaised,
  },
});
