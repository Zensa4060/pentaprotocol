/**
 * Missions tab (BUG-11) — permanent milestone missions derived from the
 * profile, claimable via ``POST /api/profile/claim-mission``.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
import { fetchProfile } from "@/lib/profile";
import { claimMission, missionsForUser, type MissionView } from "@/lib/missions";
import { useAuthStore } from "@/lib/store";
import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function MissionsScreen() {
  const user = useAuthStore((s) => s.user);
  const palette = usePalette();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
    } catch {
      /* keep cache */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const missions: MissionView[] = user ? missionsForUser(user) : [];

  const onClaim = async (m: MissionView) => {
    if (busy) return;
    setBusy(m.id);
    try {
      const res = await claimMission(m.id);
      setClaimed((prev) => new Set(prev).add(m.id));
      Alert.alert(
        res.already_claimed ? "Already claimed" : "Claimed",
        res.already_claimed ? "You already claimed this reward." : `+${res.xp_awarded.toLocaleString()} XP`,
      );
    } catch (err) {
      Alert.alert("Could not claim", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
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
        Permanent milestones. Complete the goal, then claim your XP.
      </Body>

      <Eyebrow tone="muted" style={styles.section}>PERMANENT</Eyebrow>
      <Stack gap={3}>
        {missions.map((m) => {
          const pct = Math.min(1, m.value / m.target);
          const isClaimed = claimed.has(m.id);
          return (
            <Card key={m.id} padding="md" style={{ gap: space[2] }}>
              <Row justify="between" align="center">
                <Heading>{m.label}</Heading>
                {m.complete ? (
                  <Caption tone={isClaimed ? "muted" : "accent"}>{isClaimed ? "CLAIMED" : "READY"}</Caption>
                ) : null}
              </Row>
              <Body tone="muted">{m.description}</Body>
              <View style={[styles.track, { backgroundColor: palette.bgRaised }]}>
                <View style={[styles.fill, { backgroundColor: palette.accent, width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Row justify="between" align="center">
                <Caption tone="muted">
                  {Math.min(m.value, m.target).toLocaleString()} / {m.target.toLocaleString()}
                </Caption>
                <View style={{ width: 120 }}>
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
        })}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6], marginBottom: space[2] },
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
