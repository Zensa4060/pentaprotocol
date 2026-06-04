/**
 * Pre-game lobby (BUG-05).
 *
 * Shown before a match begins (training / AI Bot / multiplayer): a rule
 * summary for the chosen board size, a **pattern showcase** of the win
 * shapes in play, and a **Ready** button. Tapping Ready forwards every
 * incoming param to the real match route — so this screen is a pure
 * gate and the downstream match logic is unchanged.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PatternDiagram } from "@/components/game/PatternDiagram";
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
import {
  defaultPatternsForGrid,
  matchMsForGrid,
  parseGridParam,
} from "@/lib/game/boardConfig";
import { formatClock } from "@/lib/game/matchRules";
import { coreRulesForGrid, patternMetadataForGrid } from "@/lib/game/patterns";
import { usePalette } from "@/theme/ThemeProvider";
import { radii, space } from "@/theme/tokens";

type Mode = "training" | "engine" | "multiplayer";

const MATCH_ROUTE: Record<Mode, string> = {
  training: "/training/match",
  engine: "/engine/match",
  multiplayer: "/multiplayer/match",
};

function randomFiveOfSix(keys: string[]): string[] {
  return [...keys].sort(() => Math.random() - 0.5).slice(0, 5);
}

export default function PreGameScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<Record<string, string>>();
  const mode = (params.mode as Mode) ?? "training";
  const grid = parseGridParam(params.grid);

  const meta = patternMetadataForGrid(grid);
  const coreMeta = coreRulesForGrid(grid);
  const optionalKeys = useMemo(() => Object.keys(meta), [grid]);
  const clock = formatClock(matchMsForGrid(grid));

  const canPick5 = (mode === "training" || mode === "engine") && grid === 5;
  const [selected5, setSelected5] = useState<string[]>(() => randomFiveOfSix(optionalKeys));

  const toggle5 = (id: string) => {
    setSelected5((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 4) return prev;
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const activePatterns =
    grid === 5 && canPick5 ? selected5 : defaultPatternsForGrid(grid);

  const onReady = () => {
    const { mode: _m, ...rest } = params;
    router.replace({
      pathname: MATCH_ROUTE[mode],
      params: { ...rest, patterns: activePatterns.join(",") },
    } as never);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const modeLabel =
    mode === "multiplayer" ? "1V1 : ONLINE" : mode === "engine" ? "AI BOT" : "SOLO";

  const readyDisabled = canPick5 && selected5.length !== 5;

  return (
    <Screen scrollable padded background={palette.bg} contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={2} style={{ marginTop: space[5] }}>
        <Eyebrow tone="muted">{modeLabel}</Eyebrow>
        <Title>{grid}×{grid} — get ready</Title>
        {params.label ? <Body tone="muted">Opponent: {params.label}</Body> : null}
      </VStack>

      <Eyebrow tone="muted" style={styles.section}>RULES</Eyebrow>
      <View style={[styles.card, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
        <RuleLine label="Board" value={`${grid} × ${grid}`} />
        <RuleLine label="Clock" value={`${clock} per player`} />
        <RuleLine
          label="Center rule"
          value={grid === 6 ? "Not used on 6×6" : "Center opening → opponent gets 2 extra turns"}
        />
        <RuleLine label="Goal" value="Complete a win pattern below before your opponent" />
      </View>

      <Row justify="between" align="baseline" style={styles.section}>
        <Eyebrow tone="muted">{canPick5 ? "PICK YOUR PATTERNS" : "WIN PATTERNS"}</Eyebrow>
        {canPick5 ? (
          <Row gap={2} align="center">
            <Caption tone={selected5.length === 5 ? "accent" : "danger"}>
              {selected5.length}/5
            </Caption>
            <Pressable onPress={() => setSelected5(randomFiveOfSix(optionalKeys))} hitSlop={8}>
              <Caption tone="muted">RANDOM</Caption>
            </Pressable>
          </Row>
        ) : null}
      </Row>
      {canPick5 ? (
        <Body tone="muted" style={{ marginBottom: space[2] }}>
          Choose exactly 5 of 6 patterns for this match.
        </Body>
      ) : (
        <Body tone="muted" style={{ marginBottom: space[2] }}>
          All {optionalKeys.length} patterns are active. Core rule:{" "}
          {grid === 7 ? "20+" : "15+"} connected stones.
        </Body>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={3}>
          {optionalKeys.map((key) => {
            const chosen = !canPick5 || selected5.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => canPick5 && toggle5(key)}
                disabled={!canPick5}
                style={[
                  styles.patternCard,
                  { backgroundColor: palette.bgCard, borderColor: palette.border },
                  chosen && canPick5 && { borderColor: palette.accent },
                  !chosen && { opacity: 0.45 },
                ]}
              >
                <PatternDiagram
                  info={meta[key]}
                  accent={chosen ? palette.accent : palette.textDim}
                  cellSize={grid >= 7 ? 9 : 12}
                />
                <Caption tone={chosen ? "default" : "muted"} style={{ marginTop: space[2], textAlign: "center" }}>
                  {meta[key].label}
                </Caption>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>

      {Object.keys(coreMeta).length > 0 ? (
        <>
          <Eyebrow tone="muted" style={{ marginTop: space[4], marginBottom: space[2] }}>
            CORE RULE
          </Eyebrow>
          <Body tone="muted">{coreMeta[Object.keys(coreMeta)[0]].desc}</Body>
        </>
      ) : null}

      <View style={{ height: space[8] }} />
      <Btn variant="primary" size="lg" onPress={onReady} disabled={readyDisabled}>
        Ready — start match
      </Btn>
    </Screen>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="between" align="baseline" style={{ marginBottom: space[3] }}>
      <Caption tone="muted" style={{ width: 96 }}>{label.toUpperCase()}</Caption>
      <View style={{ flex: 1 }}>
        <Body tone="default" style={{ textAlign: "right" }}>{value}</Body>
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6], marginBottom: space[2] },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[4],
  },
  patternCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space[3],
    alignItems: "center",
  },
});
