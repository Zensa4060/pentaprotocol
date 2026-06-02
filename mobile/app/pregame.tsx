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
import { patternMetadataForGrid } from "@/lib/game/patterns";
import { usePalette } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

type Mode = "training" | "engine" | "multiplayer";

const MATCH_ROUTE: Record<Mode, string> = {
  training: "/training/match",
  engine: "/engine/match",
  multiplayer: "/multiplayer/match",
};

export default function PreGameScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<Record<string, string>>();
  const mode = (params.mode as Mode) ?? "training";
  const grid = parseGridParam(params.grid);

  const meta = patternMetadataForGrid(grid);
  const patternKeys = defaultPatternsForGrid(grid).filter((k) => meta[k]);
  const clock = formatClock(matchMsForGrid(grid));

  const onReady = () => {
    // Forward all params except our own routing keys.
    const { mode: _m, ...rest } = params;
    router.replace({ pathname: MATCH_ROUTE[mode], params: rest } as never);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const modeLabel =
    mode === "multiplayer" ? "1V1 : ONLINE" : mode === "engine" ? "AI BOT" : "SOLO";

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

      {/* ── Rules summary ─────────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>RULES</Eyebrow>
      <View style={styles.card}>
        <RuleLine label="Board" value={`${grid} × ${grid}`} />
        <RuleLine label="Clock" value={`${clock} per player`} />
        <RuleLine
          label="Center rule"
          value={grid === 6 ? "Not used on 6×6" : "Center opening → opponent gets 2 extra turns"}
        />
        <RuleLine label="Goal" value="Complete a win pattern below before your opponent" />
      </View>

      {/* ── Pattern showcase ──────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>WIN PATTERNS</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={3}>
          {patternKeys.map((key) => (
            <View key={key} style={styles.patternCard}>
              <PatternDiagram info={meta[key]} accent={palette.accent} cellSize={grid >= 7 ? 9 : 12} />
              <Caption tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
                {meta[key].label}
              </Caption>
            </View>
          ))}
        </Row>
      </ScrollView>

      <View style={{ height: space[8] }} />
      <Btn variant="primary" size="lg" onPress={onReady}>
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
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  patternCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
    alignItems: "center",
  },
});
