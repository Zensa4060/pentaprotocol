/**
 * AI Engine — pick a named bot, then play via ``POST /api/bot/move``.
 *
 * Mirrors web ``/challenge`` + ``AIScreen`` for 7×7. Requires login
 * and a reachable ``EXPO_PUBLIC_API_URL``.
 */

import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
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
  Title,
} from "@/components/ui";
import {
  BOTS_7X7,
  isBotUnlocked,
  lockedByLabel,
  type BotId,
} from "@/lib/botRewards";
import type { GridSize } from "@/lib/game/boardConfig";
import { useAuthStore } from "@/lib/store";
import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function EnginePickerScreen() {
  const user = useAuthStore((s) => s.user);
  const palette = usePalette();
  const defeats = user?.bot_defeats ?? {};
  const [selected, setSelected] = useState<BotId>("seraphina");
  // Default to the standard 5×5 board (BUG-03) — not 7×7.
  const [gridSize, setGridSize] = useState<GridSize>(5);

  const gridOptions = useMemo(
    () =>
      [
        { size: 5 as GridSize, label: "5×5", sub: "5:00 · classic" },
        { size: 6 as GridSize, label: "6×6", sub: "8:00 · mid leg" },
        { size: 7 as GridSize, label: "7×7", sub: "10:00 · top leg" },
      ] as const,
    [],
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const start = () => {
    const card = BOTS_7X7.find((b) => b.id === selected);
    if (!card) return;
    if (!isBotUnlocked(defeats, selected)) {
      const prev = lockedByLabel(selected);
      Alert.alert(
        "Locked",
        prev ? `Defeat ${prev} first to unlock ${card.label}.` : "This opponent is locked.",
      );
      return;
    }
    router.push({
      pathname: "/pregame",
      params: {
        mode: "engine",
        botId: card.id,
        difficulty: card.difficulty,
        label: card.label,
        grid: String(gridSize),
      },
    });
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <Eyebrow tone="muted">AI BOT</Eyebrow>
        <Title>Choose your demise</Title>
        <Body tone="muted">
          Server-backed opponents on 5×5, 6×6, or 7×7. Wins can grant XP and unlock the next bot.
        </Body>
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[2] }}>
        BOARD SIZE
      </Eyebrow>
      <Row gap={2}>
        {gridOptions.map((g) => {
          const on = gridSize === g.size;
          return (
            <Pressable
              key={g.size}
              onPress={() => setGridSize(g.size)}
              style={[
                styles.gridChip,
                { borderColor: palette.border, backgroundColor: palette.bgCard },
                on && { borderColor: palette.accent, backgroundColor: palette.bgRaised },
              ]}
            >
              <Caption tone={on ? "accent" : "muted"} style={{ fontWeight: "800" }}>
                {g.label}
              </Caption>
              <Caption tone="dim">{g.sub}</Caption>
            </Pressable>
          );
        })}
      </Row>

      <Eyebrow tone="muted" style={{ marginTop: space[6], marginBottom: space[2] }}>
        OPPONENTS
      </Eyebrow>

      <VStack gap={3}>
        {BOTS_7X7.map((bot) => {
          const unlocked = isBotUnlocked(defeats, bot.id);
          const defeated = !!defeats[bot.id];
          const isSelected = selected === bot.id;
          return (
            <Pressable
              key={bot.id}
              onPress={() => setSelected(bot.id)}
              disabled={!unlocked}
              android_ripple={{ color: palette.bgRaised }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !unlocked }}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: isSelected ? bot.color : palette.border,
                  backgroundColor: isSelected ? palette.bgRaised : palette.bgCard,
                  opacity: unlocked ? 1 : 0.45,
                },
                pressed && unlocked && { backgroundColor: palette.bgRaised },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: bot.color, opacity: isSelected ? 1 : 0.35 }]} />
              <VStack gap={1} fill>
                <Row gap={3} align="baseline">
                  <Heading tone={isSelected ? "default" : "muted"}>{bot.label}</Heading>
                  <Caption tone="muted">{bot.sub}</Caption>
                  {defeated ? <Caption tone="success">DEFEATED</Caption> : null}
                </Row>
                {!unlocked ? (
                  <Caption tone="warn">
                    Locked — defeat {lockedByLabel(bot.id) ?? "prior bot"} first.
                  </Caption>
                ) : (
                  <Caption tone="muted">Difficulty · {bot.difficulty.toUpperCase()}</Caption>
                )}
              </VStack>
            </Pressable>
          );
        })}
      </VStack>

      <View style={[styles.rulesCard, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
        <Caption tone="muted">
          You play P1 (red). The server engine plays P2 (blue). Requires network + sign-in.
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
  gridChip: {
    flex: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
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
    marginTop: space[5],
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space[4],
  },
});
