/**
 * AI Engine — pick a named bot, then play via ``POST /api/bot/move``.
 *
 * Mirrors web ``/challenge`` + ``AIScreen`` for 7×7. Requires login
 * and a reachable ``EXPO_PUBLIC_API_URL``.
 */

import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";

import { SyrosIntroOverlay } from "@/components/game/SyrosIntroOverlay";
import { fillerMatchFoundParams } from "@/lib/multiplayer/matchFound";
import {
  numericLevelForTier,
  pickRandomPatterns5x5,
} from "@/lib/unrankedBots";

import {
  Body,
  Btn,
  Caption,
  Heading,
  Row,
  Screen,
  Stack as VStack,
} from "@/components/ui";
import { HudHeader, SectionLabel } from "@/components/ui/hud";
import {
  BOTS_BY_MODE,
  BOT_LABEL,
  boardModeGate,
  isBoardModeUnlocked,
  isBotUnlocked,
  lockedByLabel,
  type BotBoardMode,
  type BotId,
} from "@/lib/botRewards";
import { boardModeFromGrid, type GridSize } from "@/lib/game/boardConfig";
import { useAuthStore } from "@/lib/store";
import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function EnginePickerScreen() {
  const user = useAuthStore((s) => s.user);
  const palette = usePalette();
  const defeats = user?.bot_defeats ?? {};
  // SYROS — hidden final boss across all three boards; unlocks once HER (the
  // 7×7 tier boss) is defeated.
  const syrosUnlocked = !!(defeats as Record<string, boolean>).her;
  // Default to the standard 5×5 board (BUG-03) — not 7×7.
  const [gridSize, setGridSize] = useState<GridSize>(5);
  const [syrosIntroVisible, setSyrosIntroVisible] = useState(false);
  const mode = boardModeFromGrid(gridSize) as BotBoardMode;
  const roster = BOTS_BY_MODE[mode];
  const [selected, setSelected] = useState<BotId>(roster[0].id);

  // When the board size changes, reset the selected opponent to that
  // roster's first bot so we never carry a 7×7 bot into a 5×5 match.
  const onPickSize = (size: GridSize) => {
    setGridSize(size);
    const nextMode = boardModeFromGrid(size) as BotBoardMode;
    setSelected(BOTS_BY_MODE[nextMode][0].id);
  };

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
    const card = roster.find((b) => b.id === selected);
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

  const onSyros = () => {
    if (!syrosUnlocked) {
      Alert.alert("Locked", "Defeat HER on 7×7 to unlock SYROS.");
      return;
    }
    // Show the "PREPARING SYROS..." intro overlay — same flow as the
    // web's SyrosIntroScreen. After the overlay completes, the callback
    // navigates to the match-found VS splash which then routes into
    // /engine/match with the full G1→G10 leg ladder.
    setSyrosIntroVisible(true);
  };

  /** Fired by SyrosIntroOverlay after the 3-second dwell. */
  const onSyrosIntroDone = useCallback(() => {
    setSyrosIntroVisible(false);
    const patterns = pickRandomPatterns5x5(5);
    const params = fillerMatchFoundParams({
      botName: "SYROS",
      botTier: "SYROS",
      botLevel: numericLevelForTier("SYROS"),
      botEmoji: "",
      botBanner: "plasma_core",
      isSyros: true,
      patterns,
    });
    router.push({
      pathname: "/multiplayer/match-found",
      params,
    } as never);
  }, []);

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader
        title="CHOOSE YOUR DEMISE"
        eyebrow="AI BOT · SERVER OPPONENTS"
        onBack={goBack}
      />

      <Body tone="muted" style={{ marginTop: space[4] }}>
        Server-backed opponents on 5×5, 6×6, or 7×7. Wins can grant XP and unlock the next bot.
      </Body>

      <SectionLabel label="BOARD SIZE" style={{ marginTop: space[7], marginBottom: space[3] }} />
      <Row gap={2}>
        {gridOptions.map((g) => {
          const on = gridSize === g.size;
          const gMode = boardModeFromGrid(g.size) as BotBoardMode;
          const unlocked = isBoardModeUnlocked(defeats, gMode);
          const gate = boardModeGate(gMode);
          return (
            <Pressable
              key={g.size}
              onPress={() => {
                if (!unlocked) {
                  Alert.alert(
                    "Locked",
                    gate ? `Defeat ${BOT_LABEL[gate]} (board below) to unlock ${g.label}.` : "Locked.",
                  );
                  return;
                }
                onPickSize(g.size);
              }}
              style={[
                styles.gridChip,
                { borderColor: palette.border, backgroundColor: palette.bgCard },
                on && { borderColor: palette.accent, backgroundColor: palette.bgRaised },
                !unlocked && { opacity: 0.5 },
              ]}
            >
              <Caption tone={on ? "accent" : "muted"} style={{ fontWeight: "800" }}>
                {g.label}{!unlocked ? " 🔒" : ""}
              </Caption>
              <Caption tone="dim">{g.sub}</Caption>
            </Pressable>
          );
        })}
      </Row>

      <SectionLabel label="OPPONENTS" style={{ marginTop: space[6], marginBottom: space[3] }} />

      <VStack gap={3}>
        {roster.map((bot) => {
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

      {/* ── SYROS — hidden final boss across all three boards ── */}
      <SectionLabel label="FINAL BOSS" style={{ marginTop: space[6], marginBottom: space[3] }} />
      <Pressable
        onPress={onSyros}
        android_ripple={{ color: "rgba(147,51,234,0.25)" }}
        accessibilityRole="button"
        accessibilityLabel="SYROS — final boss"
        style={[
          styles.syrosCard,
          {
            borderColor: syrosUnlocked ? "#9333EA" : palette.border,
            backgroundColor: syrosUnlocked ? "rgba(124,58,237,0.16)" : palette.bgCard,
            opacity: syrosUnlocked ? 1 : 0.6,
          },
        ]}
      >
        <Image
          source={require("../../assets/images/syros-pfp.png")}
          style={[styles.syrosPfp, !syrosUnlocked && { opacity: 0.5 }]}
        />
        <VStack gap={1} fill>
          <Row gap={2} align="center">
            <Heading style={{ color: syrosUnlocked ? "#C084FC" : palette.textMuted }}>SYROS</Heading>
            {!syrosUnlocked ? <Caption tone="warn">LOCKED</Caption> : null}
          </Row>
          <Caption tone="muted">5×5 + 6×6 + 7×7 · ONE MATCH</Caption>
          <Caption tone={syrosUnlocked ? "accent" : "muted"}>
            {syrosUnlocked
              ? "She plays the strongest move on every board."
              : "Defeat HER on 7×7 to unlock."}
          </Caption>
        </VStack>
      </Pressable>

      <View style={[styles.rulesCard, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
        <Caption tone="muted">
          You play P1 (red). The server engine plays P2 (blue). Requires network + sign-in.
        </Caption>
      </View>

      <View style={{ height: space[7] }} />
      <Btn variant="primary" size="lg" onPress={start}>
        Start match
      </Btn>

      {/* ── SYROS boss intro overlay ── */}
      <SyrosIntroOverlay
        visible={syrosIntroVisible}
        onDone={onSyrosIntroDone}
      />
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
  syrosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    borderRadius: radii.lg,
    borderWidth: 2,
  },
  syrosPfp: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
  },
});
