/**
 * Career screen (BUG-11) — recent match history from
 * ``GET /api/profile/career``.
 */

import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { fetchCareer } from "@/lib/career";
import type { CareerMatch } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function CareerScreen() {
  const [matches, setMatches] = useState<CareerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCareer()
      .then((m) => !cancelled && setMatches(m))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const resultTone = (r: string): "success" | "danger" | "warn" | "muted" => {
    const v = r.toLowerCase();
    if (v === "win") return "success";
    if (v === "loss" || v === "lose") return "danger";
    if (v === "draw") return "warn";
    return "muted";
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>Career</Title>
      <Body tone="muted" style={{ marginTop: space[2] }}>
        Your last {matches.length || "10"} matches.
      </Body>

      {loading ? (
        <View style={{ paddingVertical: space[8] }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <Caption tone="warn" style={{ marginTop: space[4] }}>{error}</Caption>
      ) : matches.length === 0 ? (
        <Caption tone="muted" style={{ marginTop: space[4] }}>No matches played yet.</Caption>
      ) : (
        <VStack gap={2} style={{ marginTop: space[4] }}>
          {matches.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Body>vs {m.opponent_username}</Body>
                <Caption tone="muted">
                  {m.mode}{m.board_mode ? ` · ${m.board_mode}` : ""} · {m.opponent_elo} ELO
                </Caption>
              </View>
              <VStack gap={1} align="end">
                <Eyebrow tone={resultTone(m.result)}>{m.result.toUpperCase()}</Eyebrow>
                {m.elo_delta !== 0 ? (
                  <Caption tone={m.elo_delta > 0 ? "success" : "danger"}>
                    {m.elo_delta > 0 ? "+" : ""}{m.elo_delta}
                  </Caption>
                ) : null}
              </VStack>
            </View>
          ))}
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
});
