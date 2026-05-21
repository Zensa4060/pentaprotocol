/**
 * Training hub — practice mode only (no bot).
 *
 * Mirrors the web ``/training`` menu:
 *   - Tutorial replay
 *   - Singleplayer practice (local alternating stones, undo)
 *
 * Named AI opponents live under AI Engine (`/engine`) and use
 * ``POST /api/bot/move`` on the backend.
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
        <Eyebrow tone="muted">TRAINING</Eyebrow>
        <Title>Practice & learn</Title>
        <Body tone="muted">
          No rating, no rewards. Replay the tutorial or run a local practice board — you
          control both colours.
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
          title="PRACTICE"
          subtitle="7×7 board · alternate P1 / P2 · undo moves."
          accent={colors.info}
          onPress={() => router.push("/training/match")}
        />
      </VStack>

      <View style={[styles.noteCard, { marginTop: space[7] }]}>
        <Caption tone="muted">
          Want to fight the server AI and earn XP? Use{" "}
          <Caption tone="accent">AI Engine</Caption> from the home screen.
        </Caption>
      </View>
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
