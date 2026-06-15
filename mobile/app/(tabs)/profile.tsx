/**
 * Profile tab — view of the authoritative server-side profile.
 *
 * Self-sufficient fetcher: on mount we hit ``GET /api/profile/me``
 * and surface whatever happens — loading, success, or error with
 * a retry. This screen used to rely on whatever the global
 * ``useProfileSync`` hook had populated the store with; that hook
 * swallows errors so a one-time fetch failure left the user
 * stranded on a "No profile loaded" message forever.
 *
 * Now:
 *   - Cached profile from the store (if any) paints instantly so
 *     a returning user never sees a spinner for data we already
 *     have.
 *   - A background refresh always fires anyway, so the cached
 *     copy can never drift past one screen mount.
 *   - Pull-to-refresh gives the user an explicit re-pull.
 *   - On error we render the offline cache if we have one, or
 *     a clean error panel with a Retry / Sign out pair if we don't.
 *
 * Redesign (UI only): a cinematic banner + avatar hero with the identity
 * chips (rank · title · status) in one row, currency tiles, and the rating /
 * rank-ladder / record / progression / security sections kept intact but
 * reorganized into accent-ticked, scannable blocks. No data or logic changed.
 */

import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Avatar,
  Body,
  Btn,
  Caption,
  Card,
  Divider,
  Heading,
  Row,
  Screen,
  Stack,
  Title,
} from "@/components/ui";
import { SectionLabel } from "@/components/ui/hud";
import { RankBadge } from "@/components/RankBadge";
import { RankLadder } from "@/components/RankLadder";
import { BannerRenderer } from "@/components/BannerRenderer";
import { CurrencyChip } from "@/components/CurrencyChip";
import { TabSwipe } from "@/components/TabSwipe";
import { useLocalAvatar } from "@/lib/avatar";
import { logout } from "@/lib/auth";
import { ApiError, fetchProfile } from "@/lib/profile";
import { levelProgress, xpForLevel } from "@/lib/ranks";
import { useAuthStore } from "@/lib/store";
import { winRate } from "@/lib/types";
import { radii, space } from "@/theme/tokens";
import { useTheme, usePalette } from "@/theme/ThemeProvider";

type FetchState = "idle" | "loading" | "error";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId } = useTheme();
  const palette = usePalette();
  const localAvatar = useLocalAvatar();
  const [state, setState] = useState<FetchState>(user ? "idle" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Force-refresh from the server. Updates the zustand cache as a side effect. */
  const refresh = useCallback(async (mode: "mount" | "pull") => {
    if (mode === "pull") setRefreshing(true);
    if (mode === "mount" && !user) setState("loading");
    setError(null);
    try {
      await fetchProfile();
      setState("idle");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail ? err.detail : "Could not load your profile.";
      setError(msg);
      // If we already have cached data, keep showing it and just
      // flash a non-blocking warning; if we have nothing at all,
      // surface the dedicated error panel.
      setState(useAuthStore.getState().user ? "idle" : "error");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Fire once on mount. We always refresh (even when cache exists)
  // so the user's wins/ELO/etc. can't be stale on a returning visit.
  useEffect(() => {
    void refresh("mount");
    // Run once per mount; pull-to-refresh handles subsequent pulls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out of this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // ── Loading: no cache, no data, just fetching ─────────────────
  if (state === "loading" && !user) {
    return (
      <Screen padded>
        <Stack gap={4} fill align="center" justify="center">
          <ActivityIndicator color={palette.accent} />
          <Caption tone="muted">Loading profile…</Caption>
        </Stack>
      </Screen>
    );
  }

  // ── Error: fetch failed AND we had nothing cached ────────────
  if (state === "error" && !user) {
    return (
      <Screen padded>
        <Stack gap={4} fill align="center" justify="center">
          <Title center>Couldn&apos;t load profile</Title>
          <Caption tone="muted" center>
            {error ?? "Check your connection and try again."}
          </Caption>
          <Btn variant="primary" onPress={() => refresh("mount")}>
            Try again
          </Btn>
          <Btn variant="ghost" onPress={handleLogout}>
            Sign out
          </Btn>
        </Stack>
      </Screen>
    );
  }

  // After loading + error branches, ``user`` is guaranteed non-null
  // because the only way to land here is either cache-hit or
  // post-fetch success.
  if (!user) {
    return (
      <Screen padded>
        <Stack gap={4} fill align="center" justify="center">
          <Title>—</Title>
          <Caption tone="muted">No profile loaded.</Caption>
          <Btn variant="primary" onPress={handleLogout}>
            Sign out
          </Btn>
        </Stack>
      </Screen>
    );
  }

  const wr = winRate({ wins: user.wins, losses: user.losses, draws: user.draws });
  const totalGames = user.wins + user.losses + user.draws;

  return (
    <TabSwipe index={3}>
    <Screen
      scrollable
      padded
      contentContainerStyle={{ paddingBottom: space[10] }}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh("pull")}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        ),
      }}
    >
      <View style={{ height: space[3] }} />

      {/* Soft warning banner — we have a cached copy but the last
          refresh failed. Lets the user know they may be looking at
          stale data without blowing up the whole screen. */}
      {error ? (
        <View style={[styles.warnBanner, { borderColor: palette.warn }]}>
          <Caption tone="warn">
            Could not refresh — showing cached data. {error}
          </Caption>
        </View>
      ) : null}

      {/* ── Identity hero — banner backdrop + avatar + chips ─────── */}
      <View style={[styles.bannerHeader, { borderColor: palette.border }]}>
        <BannerRenderer
          bannerId={user.banner}
          themeId={themeId}
          overlayOpacity={0.5}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Stack gap={4} align="center" style={{ marginTop: -52, marginBottom: space[5] }}>
        <Avatar uri={localAvatar ?? user.avatar} name={user.username} size="xl" highlighted />
        <Stack gap={1} align="center">
          <Title center>{user.username}</Title>
          <Caption tone="muted" center>
            {user.email}
          </Caption>
        </Stack>
        <Row gap={2} align="center" style={styles.chipRow}>
          <RankBadge elo={user.elo ?? 0} isPlacement={user.is_placement} size={36} showLabel />
          <Pressable
            onPress={() => router.push("/collection?tab=badges" as never)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Change badge"
          >
            <Pill label={(user.title ?? "newcomer").toUpperCase()} tone="accent" />
          </Pressable>
          {user.under_review ? <Pill label="UNDER REVIEW" tone="warn" /> : null}
        </Row>
      </Stack>

      {/* ── Dual-currency widget (logos) ────────────────────────── */}
      <Row gap={3}>
        <CurrencyChip kind="pc" value={user.protocredits} variant="tile" />
        <CurrencyChip kind="ps" value={user.shards} variant="tile" />
      </Row>

      {/* ── Rating ──────────────────────────────────────────────── */}
      <Section label="RATING">
        <Card variant="surface" padding="md">
          <Stack gap={3}>
            <KV
              left="ELO"
              right={user.elo !== null ? String(user.elo) : "—"}
            />
            <Divider tone="default" />
            <KV
              left="Ranked rating"
              right={
                user.ranked_rating !== null
                  ? String(user.ranked_rating)
                  : user.is_placement
                  ? `Placement ${user.placement_matches}/5`
                  : "—"
              }
            />
            <Divider tone="default" />
            <KV
              left="Ranked status"
              right={user.ranked_allowed ? "Allowed" : "Restricted"}
              rightTone={user.ranked_allowed ? "success" : "warn"}
            />
          </Stack>
        </Card>
      </Section>

      {/* ── Rank ladder (all ranks + ELO ranges) ────────────────── */}
      <Section label="RANKS">
        <RankLadder elo={user.elo} isPlacement={user.is_placement} />
      </Section>

      {/* ── Match record ────────────────────────────────────────── */}
      <Section label="MATCH RECORD">
        <Row gap={3}>
          <StatTile label="WINS" value={user.wins} tone="success" />
          <StatTile label="LOSSES" value={user.losses} tone="danger" />
          <StatTile label="DRAWS" value={user.draws} tone="muted" />
        </Row>
        <Card variant="surface" padding="md" style={{ marginTop: space[3] }}>
          <Stack gap={3}>
            <KV left="Total games" right={String(totalGames)} />
            <Divider />
            <KV left="Win rate" right={`${wr}%`} />
            <Divider />
            <KV left="Protocol Breaker wins" right={String(user.rb_wins)} />
          </Stack>
        </Card>
        <View style={{ height: space[3] }} />
        <Btn variant="secondary" onPress={() => router.push("/career")}>
          Career & match history
        </Btn>
      </Section>

      {/* ── Progression ─────────────────────────────────────────── */}
      <Section label="PROGRESSION">
        <Card variant="surface" padding="md">
          <Stack gap={3}>
            <Row justify="between" align="baseline">
              <Body tone="muted">Level {user.level}</Body>
              <Caption tone="muted">
                {user.xp.toLocaleString()} / {xpForLevel(user.level).toLocaleString()} XP
              </Caption>
            </Row>
            <LevelBar progress={levelProgress(user.level, user.xp)} />
            <Divider />
            <KV left="XP to next level" right={Math.max(0, xpForLevel(user.level) - user.xp).toLocaleString()} />
            <Divider />
            <KV left="Shards" right={user.shards.toLocaleString()} />
            <Divider />
            <KV left="Protocredits" right={user.protocredits.toLocaleString()} />
          </Stack>
        </Card>
      </Section>

      {/* ── Security ────────────────────────────────────────────── */}
      <Section label="SECURITY">
        <Card variant="surface" padding="md">
          <Stack gap={3}>
            <KV
              left="Two-factor auth"
              right={user.totp_enabled ? "Enabled" : "Off"}
              rightTone={user.totp_enabled ? "success" : "muted"}
            />
            <Divider />
            <KV
              left="Google linked"
              right={user.google_linked ? "Yes" : "No"}
              rightTone={user.google_linked ? "success" : "muted"}
            />
          </Stack>
        </Card>
      </Section>

      {/* ── Account actions ─────────────────────────────────────── */}
      <View style={{ height: space[6] }} />
      <Btn variant="primary" onPress={() => router.push("/profile/edit")}>
        Edit profile
      </Btn>
      <View style={{ height: space[3] }} />
      <Btn variant="secondary" onPress={() => router.push("/settings" as never)}>
        Settings
      </Btn>
      <View style={{ height: space[3] }} />
      <Btn variant="secondary" onPress={handleLogout}>
        Sign out
      </Btn>
      <View style={{ height: space[3] }} />
      <Btn variant="ghost" onPress={() => router.push("/settings?focus=delete" as never)}>
        Delete account
      </Btn>
    </Screen>
    </TabSwipe>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <SectionLabel label={label} style={{ marginBottom: space[3] }} />
      {children}
    </View>
  );
}

function KV({
  left,
  right,
  rightTone = "default",
}: {
  left: string;
  right: string;
  rightTone?: "default" | "muted" | "accent" | "success" | "danger" | "warn";
}) {
  return (
    <Row justify="between" align="center" gap={3}>
      <Body tone="muted">{left}</Body>
      <Body tone={rightTone}>{right}</Body>
    </Row>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
}) {
  const palette = usePalette();
  const valueColor =
    tone === "success" ? palette.success : tone === "danger" ? palette.danger : palette.textMuted;
  return (
    <View style={[styles.statTile, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
      <Heading style={{ color: valueColor }}>{value}</Heading>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

function LevelBar({ progress }: { progress: number }) {
  const palette = usePalette();
  return (
    <View style={[styles.levelTrack, { backgroundColor: palette.bgRaised }]}>
      <View style={[styles.levelFill, { backgroundColor: palette.accent, width: `${Math.round(progress * 100)}%` }]} />
    </View>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "muted" | "warn";
}) {
  const palette = usePalette();
  const bg =
    tone === "accent"
      ? "rgba(204,0,0,0.12)"
      : tone === "warn"
      ? "rgba(255,176,32,0.12)"
      : palette.bgRaised;
  const border =
    tone === "accent" ? palette.borderAccent : tone === "warn" ? palette.warn : palette.border;
  const color = tone === "accent" ? palette.accent : tone === "warn" ? palette.warn : palette.text;

  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: 4,
        backgroundColor: bg,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text
        style={{
          color,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statTile: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: space[3],
    alignItems: "center",
    justifyContent: "center",
  },
  warnBanner: {
    backgroundColor: "rgba(255,176,32,0.10)",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space[3],
    marginTop: space[3],
  },
  bannerHeader: {
    height: 140,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    marginTop: space[3],
  },
  chipRow: {
    flexWrap: "wrap",
    justifyContent: "center",
  },
  levelTrack: {
    height: 10,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
});
