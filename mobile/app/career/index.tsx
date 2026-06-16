/**
 * Career — match history with ranked / unranked tabs.
 */

import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Stack as VStack,
} from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import { formatCareerDate } from "@/lib/careerHelpers";
import { fetchCareer } from "@/lib/career";
import type { CareerMatch } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

type CareerTab = "ranked" | "unranked";

export default function CareerListScreen() {
  const [matches, setMatches] = useState<CareerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CareerTab>("ranked");

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

  const filtered = useMemo(() => {
    if (tab === "ranked") return matches.filter((m) => m.mode === "ranked");
    return matches.filter(
      (m) => m.mode === "unranked" || m.mode === "custom" || !m.mode,
    );
  }, [matches, tab]);

  const wins = filtered.filter((m) => m.result === "win").length;
  const losses = filtered.filter((m) => m.result === "loss").length;

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

  const isSyros = (name: string) => name.toUpperCase() === "SYROS";

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <HudHeader
        title="CAREER"
        eyebrow="MATCH ARCHIVE · REPLAY · SYROS ANALYSIS"
        onBack={goBack}
      />
      <Body tone="muted" style={{ marginTop: space[4] }}>
        Battle archive — tap a match for replay and Syros analysis.
      </Body>

      <Row gap={2} style={{ marginTop: space[4] }}>
        {(["ranked", "unranked"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}
          >
            <Caption tone={tab === t ? "accent" : "muted"} style={{ fontWeight: "800" }}>
              {t.toUpperCase()}
            </Caption>
          </Pressable>
        ))}
      </Row>

      {!loading && filtered.length > 0 ? (
        <Caption tone="muted" style={{ marginTop: space[3] }}>
          {wins}W · {losses}L · {filtered.length} matches
        </Caption>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: space[8] }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <Caption tone="warn" style={{ marginTop: space[4] }}>{error}</Caption>
      ) : filtered.length === 0 ? (
        <Caption tone="muted" style={{ marginTop: space[4] }}>No matches in this tab yet.</Caption>
      ) : (
        <VStack gap={2} style={{ marginTop: space[4] }}>
          {filtered.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.row, isSyros(m.opponent_username) && styles.syrosRow]}
              onPress={() =>
                router.push({
                  pathname: "/career/[id]",
                  params: { id: m.id },
                } as never)
              }
            >
              <View style={{ flex: 1 }}>
                <Body>vs {m.opponent_username}</Body>
                <Caption tone="muted">
                  {m.mode}
                  {m.board_mode ? ` · ${m.board_mode}` : ""}
                  {" · "}
                  {formatCareerDate(m.played_at)}
                </Caption>
              </View>
              <VStack gap={1} align="end">
                <Eyebrow tone={resultTone(m.result)}>{m.result.toUpperCase()}</Eyebrow>
                {tab === "ranked" && m.elo_delta !== 0 ? (
                  <Caption tone={m.elo_delta > 0 ? "success" : "danger"}>
                    {m.elo_delta > 0 ? "+" : ""}{m.elo_delta} ELO
                  </Caption>
                ) : null}
                <Caption tone="muted">›</Caption>
              </VStack>
            </Pressable>
          ))}
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    paddingVertical: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
  },
  tabOn: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgRaised,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  syrosRow: {
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(127,29,29,0.12)",
  },
});
