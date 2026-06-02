/**
 * 1V1 : OFFLINE hub.
 *
 * Three offline options:
 *   - Tutorial replay
 *   - Solo practice (local alternating stones, undo)
 *   - AI Bot — named server opponents via ``POST /api/bot/move``
 *     (lives here, under offline, rather than as its own home tile).
 */

import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  Eyebrow,
  Heading,
  Screen,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";

export default function TrainingHubScreen() {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <Eyebrow tone="muted">1V1 : OFFLINE</Eyebrow>
        <Title>Play offline</Title>
        <Body tone="muted">
          No queue required. Replay the tutorial, practise solo on a local board, or fight the
          AI Bot for XP.
        </Body>
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[2] }}>
        MODES
      </Eyebrow>

      <VStack gap={3}>
        <HubCard
          title="TUTORIAL"
          subtitle="Replay the guided walkthrough."
          onPress={() => router.push("/onboarding")}
        />
        <HubCard
          title="SOLO · 5×5"
          subtitle="Classic leg · lines & shapes · 5:00 per player."
          accent={colors.info}
          onPress={() => router.push({ pathname: "/pregame", params: { mode: "training", grid: "5" } })}
        />
        <HubCard
          title="SOLO · 6×6"
          subtitle="Mid leg · six-in-a-row & fixed shapes · 8:00 per player."
          accent={colors.info}
          onPress={() => router.push({ pathname: "/pregame", params: { mode: "training", grid: "6" } })}
        />
        <HubCard
          title="SOLO · 7×7"
          subtitle="Top leg · center rule · 10:00 per player · move log · win line."
          accent={colors.info}
          onPress={() => router.push({ pathname: "/pregame", params: { mode: "training", grid: "7" } })}
        />
        <HubCard
          title="AI BOT"
          subtitle="Named server opponents — earn XP and unlock the next bot."
          accent="#A065FF"
          onPress={() => router.push("/engine")}
        />
      </VStack>
    </Screen>
  );
}

function HubCard({
  title,
  subtitle,
  accent = colors.accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  accent?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgRaised }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: accent },
        pressed && { backgroundColor: colors.bgRaised },
      ]}
    >
      <VStack gap={1} fill>
        <Heading>{title}</Heading>
        <Body tone="muted">{subtitle}</Body>
      </VStack>
      <Caption tone="dim">›</Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    backgroundColor: colors.bgCard,
  },
  noteCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
});
