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
  periodKeyFor,
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

  // A mission counts as claimed if either this session just claimed it OR
  // the server's authoritative ledger (refreshed on focus via fetchProfile)
  // already has it. Without the server check, claimed missions reappeared
  // as claimable on every tab visit / app restart because `claimed` is
  // session-local state that resets on mount.
  const missionClaimed = (m: MissionView) =>
    claimed.has(m.id) ||
    Boolean(user?.mission_claims?.[`${m.period}:${periodKeyFor(m.period)}:${m.id}`]);

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
    const isClaimed = missionClaimed(m);
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

  const claimableOf = (list: MissionView[]) =>
    list.filter((m) => m.complete && !missionClaimed(m));

  // Claim every completed mission in a section with one tap (web parity).
  const onClaimAll = async (list: MissionView[]) => {
    const targets = claimableOf(list);
    if (targets.length === 0 || busy) return;
    setBusy("claim_all");
    let totalXp = 0;
    let count = 0;
    let pc = 0;
    try {
      for (const m of targets) {
        try {
          const res = await claimMission(m.id, m.period);
          setClaimed((prev) => new Set(prev).add(m.id));
          if (!res.already_claimed) {
            totalXp += res.xp_awarded;
            count += 1;
            if (m.betaProtoCredits) pc += m.betaProtoCredits;
          }
        } catch {
          // Keep claiming the rest — a single failure shouldn't block the batch.
        }
      }
      Alert.alert(
        count > 0 ? "Claimed" : "Nothing to claim",
        count > 0
          ? `${count} mission${count > 1 ? "s" : ""} · +${totalXp.toLocaleString()} XP` +
            (pc ? `\n+${pc} ProtoCredits (beta offer; credited once enabled.)` : "")
          : "No new rewards right now.",
      );
    } finally {
      setBusy(null);
    }
  };

  const sectionHeader = (label: string, period: MissionPeriod, list: MissionView[]) => {
    const claimable = claimableOf(list);
    return (
      <Row justify="between" align="center" style={styles.section}>
        <Row gap={2} align="baseline">
          <Eyebrow tone="muted">{label}</Eyebrow>
          {period !== "permanent" ? (
            <Caption tone="dim">resets in {formatCountdown(msUntilReset(period))}</Caption>
          ) : null}
        </Row>
        {claimable.length > 0 ? (
          <Btn
            variant="primary"
            size="sm"
            block={false}
            disabled={busy !== null}
            loading={busy === "claim_all"}
            onPress={() => void onClaimAll(list)}
          >
            {`Claim all (${claimable.length})`}
          </Btn>
        ) : null}
      </Row>
    );
  };

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

      {sectionHeader("DAILY", "daily", board.daily)}
      <Stack gap={3}>{board.daily.map(renderMission)}</Stack>

      {sectionHeader("WEEKLY", "weekly", board.weekly)}
      <Stack gap={3}>{board.weekly.map(renderMission)}</Stack>

      {sectionHeader("PERMANENT", "permanent", board.permanent)}
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
