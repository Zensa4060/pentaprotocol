/**
 * Missions tab — daily / weekly / permanent with reset countdowns and
 * the weekly **50-ProtoCredit beta offer**. Daily/weekly progress is
 * computed from recent match history; claims hit ``claim-mission``.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack,
  Title,
} from "@/components/ui";
import { fetchCareer } from "@/lib/career";
import { fetchProfile } from "@/lib/profile";
import {
  buildMissions,
  claimMission,
  formatCountdown,
  msUntilReset,
  type MissionBoard,
  type MissionPeriod,
  type MissionView,
} from "@/lib/missions";
import { useAuthStore } from "@/lib/store";
import type { CareerMatch } from "@/lib/types";
import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

const EMPTY: MissionBoard = { daily: [], weekly: [], permanent: [] };

export default function MissionsScreen() {
  const user = useAuthStore((s) => s.user);
  const palette = usePalette();
  const [career, setCareer] = useState<CareerMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0); // re-render the countdowns each minute

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [, c] = await Promise.all([
        fetchProfile().catch(() => undefined),
        fetchCareer().catch(() => [] as CareerMatch[]),
      ]);
      setCareer(c ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const board = user ? buildMissions(user, career) : EMPTY;

  const onClaim = async (m: MissionView) => {
    if (busy) return;
    setBusy(m.id);
    try {
      const res = await claimMission(m.id, m.period);
      setClaimed((prev) => new Set(prev).add(m.id));
      const extra = m.betaProtoCredits
        ? `\n(+${m.betaProtoCredits} ProtoCredits — beta offer; credited once enabled.)`
        : "";
      Alert.alert(
        res.already_claimed ? "Already claimed" : "Claimed",
        (res.already_claimed
          ? "You already claimed this reward."
          : `+${res.xp_awarded.toLocaleString()} XP`) + extra,
      );
    } catch (err) {
      Alert.alert("Could not claim", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const renderMission = (m: MissionView) => {
    const pct = Math.min(1, m.target > 0 ? m.value / m.target : 0);
    const isClaimed = claimed.has(m.id);
    return (
      <Card key={m.id} padding="md" style={{ gap: space[2] }} glow={!!m.betaProtoCredits}>
        <Row justify="between" align="center">
          <Heading numberOfLines={1} style={{ flex: 1 }}>{m.title}</Heading>
          {m.betaProtoCredits ? (
            <View style={[styles.betaBadge, { borderColor: palette.accent }]}>
              <Caption tone="accent" style={{ fontWeight: "800" }}>+{m.betaProtoCredits} PC</Caption>
            </View>
          ) : m.complete ? (
            <Caption tone={isClaimed ? "muted" : "accent"}>{isClaimed ? "CLAIMED" : "READY"}</Caption>
          ) : null}
        </Row>
        <Body tone="muted">{m.description}</Body>
        <View style={[styles.track, { backgroundColor: palette.bgRaised }]}>
          <View style={[styles.fill, { backgroundColor: palette.accent, width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <Row justify="between" align="center">
          <Caption tone="muted">
            {Math.min(m.value, m.target).toLocaleString()} / {m.target.toLocaleString()} · {m.rewardLabel}
          </Caption>
          <View style={{ width: 116 }}>
            <Btn
              variant={m.complete && !isClaimed ? "primary" : "ghost"}
              disabled={!m.complete || isClaimed || busy === m.id}
              loading={busy === m.id}
              onPress={() => onClaim(m)}
            >
              {isClaimed ? "Claimed" : m.complete ? "Claim" : "Locked"}
            </Btn>
          </View>
        </Row>
      </Card>
    );
  };

  const sectionHeader = (label: string, period: MissionPeriod) => (
    <Row justify="between" align="baseline" style={styles.section}>
      <Eyebrow tone="muted">{label}</Eyebrow>
      {period !== "permanent" ? (
        <Caption tone="dim">resets in {formatCountdown(msUntilReset(period))}</Caption>
      ) : null}
    </Row>
  );

  return (
    <Screen
      scrollable
      padded
      contentContainerStyle={{ paddingBottom: space[10] }}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.accent} />
        ),
      }}
    >
      <View style={{ height: space[3] }} />
      <Title>Missions</Title>
      <Body tone="muted" style={{ marginTop: space[2] }}>
        Complete goals to earn XP. Daily & weekly reset on a timer.
      </Body>

      {/* Beta offer banner */}
      <View style={[styles.betaBanner, { borderColor: palette.accent, backgroundColor: palette.bgCard }]}>
        <Eyebrow tone="accent">BETA LAUNCH OFFER</Eyebrow>
        <Caption tone="muted" style={{ marginTop: space[1] }}>
          For a limited time, 2 weekly missions grant <Caption tone="accent">50 ProtoCredits</Caption> each
          — enough to start affording skins. Available while the beta runs.
        </Caption>
      </View>

      {sectionHeader("DAILY", "daily")}
      <Stack gap={3}>{board.daily.map(renderMission)}</Stack>

      {sectionHeader("WEEKLY", "weekly")}
      <Stack gap={3}>{board.weekly.map(renderMission)}</Stack>

      {sectionHeader("PERMANENT", "permanent")}
      <Stack gap={3}>{board.permanent.map(renderMission)}</Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6], marginBottom: space[2] },
  betaBanner: {
    marginTop: space[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[4],
  },
  betaBadge: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    overflow: "hidden",
    marginVertical: space[1],
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
  },
});
