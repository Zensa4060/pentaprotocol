/**
 * Community tab (BUG-11) — global leaderboard (top 20 by ELO) plus an
 * entry point to Syros, the in-universe oracle. Wired to
 * ``GET /api/profile/leaderboard``.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack,
  Title,
} from "@/components/ui";
import { fetchLeaderboard } from "@/lib/leaderboard";
import type { LeaderboardRow } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function CommunityScreen() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "mount" | "pull") => {
    if (mode === "pull") setRefreshing(true);
    try {
      setRows(await fetchLeaderboard());
    } catch {
      /* keep last-known */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("mount");
    }, [load]),
  );

  return (
    <Screen
      scrollable
      padded
      contentContainerStyle={{ paddingBottom: space[10] }}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={() => load("pull")} tintColor={colors.accent} />
        ),
      }}
    >
      <View style={{ height: space[3] }} />
      <Title>Community</Title>

      {/* Syros entry */}
      <Pressable style={styles.syrosCard} onPress={() => router.push("/syros")}>
        <Image source={require("../../assets/images/syros-pfp.png")} style={styles.syrosLogo} resizeMode="contain" />
        <Stack gap={1} fill>
          <Heading>Ask Syros</Heading>
          <Body tone="muted">Consult the ancient intelligence about rules, lore and strategy.</Body>
        </Stack>
        <Caption tone="accent">›</Caption>
      </Pressable>

      <Eyebrow tone="muted" style={styles.section}>GLOBAL LEADERBOARD</Eyebrow>
      {loading ? (
        <View style={{ paddingVertical: space[6] }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <Caption tone="muted">No ranked players yet.</Caption>
      ) : (
        <Stack gap={2}>
          {rows.map((r, i) => (
            <View key={`${r.username}-${i}`} style={styles.row}>
              <Caption tone={i < 3 ? "accent" : "muted"} style={styles.rankNum}>
                {i + 1}
              </Caption>
              <View style={{ flex: 1 }}>
                <Body>{r.username}</Body>
                <Caption tone="muted">
                  {r.rank} · {r.wins} wins
                </Caption>
              </View>
              <Heading tone={r.is_placement ? "muted" : "default"}>
                {r.is_placement ? "—" : r.elo}
              </Heading>
            </View>
          ))}
        </Stack>
      )}

      <Pressable style={styles.linkRow} onPress={() => router.push("/career")}>
        <Body tone="muted">My career & match history ›</Body>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6], marginBottom: space[2] },
  syrosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    marginTop: space[4],
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[4],
  },
  syrosLogo: { width: 44, height: 44, borderRadius: radii.pill },
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
  rankNum: {
    width: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  linkRow: {
    marginTop: space[6],
    padding: space[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
});
