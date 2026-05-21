/**
 * Training picker — choose a difficulty, then start.
 *
 * v1 scope is deliberately tight: 7×7 board only, two difficulties
 * (Easy = random legal move, Hard = 4-ply negamax with iterative
 * deepening). Pattern picker, bot roster, multi-board sizes, and
 * series mode (first-to-3) all defer to later phases — keeping
 * this screen one tap from gameplay matters more than feature
 * breadth for the launch build.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

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
import { colors, radii, space } from "@/theme/tokens";

import type { BotDifficulty } from "@/lib/game/botEngine7";

interface DiffOption {
  key: BotDifficulty;
  label: string;
  blurb: string;
  detail: string;
  accent: string;
}

const OPTIONS: DiffOption[] = [
  {
    key: "easy",
    label: "EASY",
    blurb: "Random legal moves",
    detail: "Plays anywhere it can. Use this to learn the patterns without pressure.",
    accent: colors.success,
  },
  {
    key: "hard",
    label: "HARD",
    blurb: "4-ply search · 4s budget",
    detail: "Iterative-deepening negamax with center bias. Will block your wins and chain its own.",
    accent: colors.accent,
  },
];

export default function TrainingPickerScreen() {
  // Read an optional ``returnTo`` so we can deep-link straight into
  // training from anywhere and bounce back cleanly. v1 doesn't use
  // this but it's basically free to support.
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [selected, setSelected] = useState<BotDifficulty>("hard");

  const start = () => {
    router.push({ pathname: "/training/match", params: { difficulty: selected } });
  };

  const goBack = () => {
    if (params.returnTo) {
      router.replace(params.returnTo as never);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <Eyebrow tone="muted">TRAINING · 7 × 7</Eyebrow>
        <Title>Solo board work</Title>
        <Body tone="muted">
          Play offline against the engine. No rating, no rewards — pure practice.
        </Body>
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[2] }}>
        DIFFICULTY
      </Eyebrow>

      <VStack gap={3}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelected(opt.key)}
              android_ripple={{ color: colors.bgRaised }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${opt.label} difficulty`}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: isSelected ? opt.accent : colors.border,
                  backgroundColor: isSelected ? colors.bgRaised : colors.bgCard,
                },
                pressed && { backgroundColor: colors.bgRaised },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: opt.accent, opacity: isSelected ? 1 : 0.35 }]} />
              <VStack gap={1} fill>
                <Row gap={3} align="baseline">
                  <Heading tone={isSelected ? "default" : "muted"}>{opt.label}</Heading>
                  <Caption tone="muted">{opt.blurb}</Caption>
                </Row>
                <Body tone="muted">{opt.detail}</Body>
              </VStack>
            </Pressable>
          );
        })}
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[2] }}>
        RULES
      </Eyebrow>
      <View style={styles.rulesCard}>
        <Caption tone="muted">
          All 8 win patterns active (LINE, DIAGONAL, Y, L, V, C, T, ZIGZAG). Core rule:
          {" "}<Caption tone="accent">20+ connected stones wins</Caption>.
        </Caption>
        <View style={{ height: space[2] }} />
        <Caption tone="muted">
          You play as P1 (red). The bot plays P2 (blue). Tap any cell to begin.
        </Caption>
      </View>

      <View style={{ height: space[7] }} />
      <Btn variant="primary" size="lg" onPress={start}>
        Start match
      </Btn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    borderRadius: radii.lg,
    borderWidth: 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  rulesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
});
