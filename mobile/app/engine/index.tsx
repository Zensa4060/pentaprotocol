/**
 * AI Engine — pick a named bot, then play via ``POST /api/bot/move``.
 *
 * Mirrors web ``/challenge`` + ``AIScreen`` for 7×7. Requires login
 * and a reachable ``EXPO_PUBLIC_API_URL``.
 */

import { router, Stack } from "expo-router";
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
  Title,
} from "@/components/ui";
import {
  BOTS_7X7,
  isBotUnlocked,
  lockedByLabel,
  type BotId,
} from "@/lib/botRewards";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

export default function EnginePickerScreen() {
  const user = useAuthStore((s) => s.user);
  const defeats = user?.bot_defeats ?? {};
  const [selected, setSelected] = useState<BotId>("seraphina");

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
      pathname: "/engine/match",
      params: { botId: card.id, difficulty: card.difficulty, label: card.label },
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
        <Eyebrow tone="muted">AI ENGINE · 7 × 7</Eyebrow>
        <Title>Choose your demise</Title>
        <Body tone="muted">
          Server-backed opponents. Wins can grant XP and unlock the next bot in the chain.
        </Body>
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[2] }}>
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
              android_ripple={{ color: colors.bgRaised }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !unlocked }}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: isSelected ? bot.color : colors.border,
                  backgroundColor: isSelected ? colors.bgRaised : colors.bgCard,
                  opacity: unlocked ? 1 : 0.45,
                },
                pressed && unlocked && { backgroundColor: colors.bgRaised },
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

      <View style={styles.rulesCard}>
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
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
});
