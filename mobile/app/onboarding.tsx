/**
 * Tutorial / onboarding — full walkthrough condensed into paged
 * sections, mirroring the web tutorial content
 * (``frontend/lib/tutorialContent.ts``):
 *   Syros greeting → core rules → centre rule → win patterns for
 *   5×5 / 6×6 / 7×7 → connection rule → the Breakers → rank ladder →
 *   modes → finish.
 *
 * Reuses ``PatternDiagram`` + ``patternMetadataForGrid`` for the win
 * showcases and ``RankLadder`` for ranks, so the patterns match the
 * real game. Theme-reactive via ``usePalette``.
 */

import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { PatternDiagram } from "@/components/game/PatternDiagram";
import { RankLadder } from "@/components/RankLadder";
import { defaultPatternsForGrid, type GridSize } from "@/lib/game/boardConfig";
import { patternMetadataForGrid } from "@/lib/game/patterns";
import { ApiError, setTutorialState } from "@/lib/profile";
import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

type PageKind =
  | "syros"
  | "rules"
  | "centre"
  | "patterns5"
  | "patterns6"
  | "patterns7"
  | "connection"
  | "breakers"
  | "ranks"
  | "modes"
  | "done";

interface Page {
  kind: PageKind;
  eyebrow: string;
  title: string;
  body: string;
}

const PAGES: Page[] = [
  { kind: "syros", eyebrow: "SYROS", title: "I am Syros.", body: "Ancient intelligence of the Protocol. I will teach you to win — once. Listen." },
  { kind: "rules", eyebrow: "THE BASICS", title: "Five-in-a-row, evolved.", body: "Turn-based. You and your opponent alternate placing stones on the grid. Win by completing a win pattern, or by chaining enough connected stones." },
  { kind: "centre", eyebrow: "CENTRE RULE", title: "Odd boards have a centre.", body: "On 5×5 and 7×7, opening on the exact centre cell grants the OPPONENT 2 extra turns. 6×6 has no single centre — the rule doesn't apply." },
  { kind: "patterns5", eyebrow: "5×5 · CLASSIC LEG", title: "Win shapes — 5×5.", body: "On 5×5 you pick which structural shapes are live. Straight lines & diagonals are always active." },
  { kind: "patterns6", eyebrow: "6×6 · MID LEG", title: "Win shapes — 6×6.", body: "Bigger board, fixed shape set. Six-in-a-row lines, plus the structural shapes below." },
  { kind: "patterns7", eyebrow: "7×7 · TOP LEG", title: "Win shapes — 7×7.", body: "The full roster of shapes — every rotation and reflection is live, so they appear where you don't expect." },
  { kind: "connection", eyebrow: "CORE RULE", title: "Connection win.", body: "Even without a shape, chaining enough connected stones wins: 10 on 5×5, 15 on 6×6, 20 on 7×7." },
  { kind: "breakers", eyebrow: "THE BREAKERS", title: "When a series tightens.", body: "Best-of series escalate. Game 3 = Rulebreaker (5×5), Game 6 = Timebreaker (6×6), Game 9 = Mindbreaker (7×7). Tied 4–4? Game 10 = Limitbreaker decides it." },
  { kind: "ranks", eyebrow: "THE LADDER", title: "Climb the ranks.", body: "Win ranked matches to raise your ELO and ascend from Rookie to Chronicle." },
  { kind: "modes", eyebrow: "WHERE TO PLAY", title: "Pick your battlefield.", body: "1V1 Online for ranked & casual humans. 1V1 Offline for the tutorial, solo practice, and the AI Bot ladder." },
  { kind: "done", eyebrow: "BEGIN", title: "The Protocol awaits.", body: "Start with the AI Bot on 5×5 to drill the shapes, then climb. I won't repeat myself." },
];

export default function OnboardingScreen() {
  const palette = usePalette();
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const page = PAGES[index];
  const isLast = index === PAGES.length - 1;

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
    if (isLast) finalize("completed");
    else setIndex((i) => i + 1);
  };

  return (
    <Screen padded>
      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Caption tone="muted">{index + 1} / {PAGES.length}</Caption>
        <Pressable onPress={() => finalize("skipped")} hitSlop={12} disabled={submitting}>
          <Caption tone="muted">SKIP</Caption>
        </Pressable>
      </Row>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: space[5] }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", marginBottom: space[6] }}>
          <Visual kind={page.kind} palette={palette} />
        </View>
        <Eyebrow tone="accent">{page.eyebrow}</Eyebrow>
        <View style={{ height: space[3] }} />
        <Title>{page.title}</Title>
        <View style={{ height: space[4] }} />
        <Body tone="muted">{page.body}</Body>
      </ScrollView>

      <Row gap={2} justify="center" style={{ marginBottom: space[5] }}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === index ? palette.accent : palette.border },
              i === index && styles.dotActive,
            ]}
          />
        ))}
      </Row>

      <Btn variant="primary" size="lg" loading={submitting} onPress={onNext}>
        {isLast ? "Enter the Protocol" : "Next"}
      </Btn>
      <View style={{ height: space[3] }} />
      {index > 0 ? (
        <Btn variant="ghost" onPress={() => setIndex((i) => Math.max(0, i - 1))}>Back</Btn>
      ) : (
        <View style={{ height: space[5] }} />
      )}
    </Screen>
  );
}

// ─── Visuals ──────────────────────────────────────────────────────────────────

function Visual({ kind, palette }: { kind: PageKind; palette: ThemePalette }) {
  if (kind === "syros") {
    return (
      <Image source={require("../assets/images/syros-pfp.png")} style={styles.syros} resizeMode="contain" />
    );
  }
  if (kind === "ranks") return <View style={{ width: "100%" }}><RankLadder elo={0} isPlacement /></View>;
  if (kind === "centre") return <CentreCompare palette={palette} />;
  if (kind === "patterns5") return <PatternGallery grid={5} palette={palette} />;
  if (kind === "patterns6") return <PatternGallery grid={6} palette={palette} />;
  if (kind === "patterns7") return <PatternGallery grid={7} palette={palette} />;
  if (kind === "connection") return <ConnectionVisual palette={palette} />;
  if (kind === "breakers") return <BreakersVisual palette={palette} />;
  if (kind === "modes") return <ModesVisual palette={palette} />;
  // rules / done → simple mini board
  return <MiniBoard palette={palette} />;
}

function PatternGallery({ grid, palette }: { grid: GridSize; palette: ThemePalette }) {
  const meta = patternMetadataForGrid(grid);
  const keys = defaultPatternsForGrid(grid).filter((k) => meta[k]);
  return (
    <View style={styles.galleryWrap}>
      {keys.map((k) => (
        <View key={k} style={[styles.galleryCell, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
          <PatternDiagram info={meta[k]} accent={palette.accent} cellSize={grid >= 7 ? 8 : 10} />
          <Caption tone="muted" style={{ marginTop: space[1], textAlign: "center" }}>{meta[k].label}</Caption>
        </View>
      ))}
    </View>
  );
}

function CentreCompare({ palette }: { palette: ThemePalette }) {
  const boards: { label: string; ok: boolean; n: number }[] = [
    { label: "5×5", ok: true, n: 5 },
    { label: "6×6", ok: false, n: 6 },
    { label: "7×7", ok: true, n: 7 },
  ];
  return (
    <Row gap={4} justify="center">
      {boards.map((b) => (
        <View key={b.label} style={{ alignItems: "center", gap: space[2] }}>
          <View style={[styles.compareBoard, { borderColor: palette.border }]}>
            {Array.from({ length: b.n }).map((_, r) => (
              <View key={r} style={{ flexDirection: "row" }}>
                {Array.from({ length: b.n }).map((__, c) => {
                  const isCentre = b.ok && r === Math.floor(b.n / 2) && c === Math.floor(b.n / 2);
                  return <View key={c} style={[styles.compareCell, { backgroundColor: isCentre ? palette.accent : palette.bgRaised, borderColor: palette.border }]} />;
                })}
              </View>
            ))}
          </View>
          <Caption tone={b.ok ? "success" : "danger"}>{b.label} {b.ok ? "✓" : "✗"}</Caption>
        </View>
      ))}
    </Row>
  );
}

function ConnectionVisual({ palette }: { palette: ThemePalette }) {
  const rows: [string, string][] = [["5×5", "10 stones"], ["6×6", "15 stones"], ["7×7", "20 stones"]];
  return (
    <VStack gap={2} style={{ width: "100%", maxWidth: 280 }}>
      {rows.map(([a, b]) => (
        <Row key={a} justify="between" align="center" style={[styles.kvRow, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
          <Heading>{a}</Heading>
          <Caption tone="accent" style={{ fontWeight: "800" }}>{b}</Caption>
        </Row>
      ))}
    </VStack>
  );
}

function BreakersVisual({ palette }: { palette: ThemePalette }) {
  const rows: [string, string][] = [
    ["Rulebreaker", "Game 3 · 5×5"],
    ["Timebreaker", "Game 6 · 6×6"],
    ["Mindbreaker", "Game 9 · 7×7"],
    ["Limitbreaker", "Game 10 · decider"],
  ];
  return (
    <VStack gap={2} style={{ width: "100%", maxWidth: 300 }}>
      {rows.map(([a, b]) => (
        <Row key={a} justify="between" align="center" style={[styles.kvRow, { backgroundColor: palette.bgCard, borderColor: palette.borderAccent }]}>
          <Heading tone="accent">{a}</Heading>
          <Caption tone="muted">{b}</Caption>
        </Row>
      ))}
    </VStack>
  );
}

function ModesVisual({ palette }: { palette: ThemePalette }) {
  const rows = ["1V1 : ONLINE", "1V1 : OFFLINE", "AI BOT", "MISSIONS"];
  return (
    <VStack gap={2} style={{ width: "100%", maxWidth: 280 }}>
      {rows.map((r) => (
        <View key={r} style={[styles.kvRow, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
          <Caption style={{ fontWeight: "800", color: palette.text }}>{r}</Caption>
        </View>
      ))}
    </VStack>
  );
}

function MiniBoard({ palette }: { palette: ThemePalette }) {
  return (
    <View style={[styles.compareBoard, { borderColor: palette.border, padding: 6 }]}>
      {Array.from({ length: 5 }).map((_, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {Array.from({ length: 5 }).map((__, c) => {
            const p1 = r === c;
            const p2 = r + c === 4;
            return <View key={c} style={[styles.compareCell, { width: 22, height: 22, backgroundColor: p1 ? palette.p1 : p2 ? palette.p2 : palette.bgRaised, borderColor: palette.border }]} />;
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  dotActive: { width: 24 },
  syros: { width: 120, height: 120, borderRadius: radii.pill },
  galleryWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space[2] },
  galleryCell: {
    width: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space[2],
    alignItems: "center",
  },
  compareBoard: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 4,
    gap: 2,
  },
  compareCell: {
    width: 12,
    height: 12,
    marginRight: 2,
    marginBottom: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  kvRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
});
