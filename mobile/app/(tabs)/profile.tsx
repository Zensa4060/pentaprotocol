/**
 * Profile tab — view-only, with logout.
 *
 * Phase 2 scope: surface the cached profile so the user can see
 * who they're signed in as, their stats, and sign out. Editing
 * (avatar, bio, password change, 2FA, account deletion) lands in
 * later phases — each on its own modal screen reached from here.
 *
 * Information density mirrors the web profile page but stays
 * vertical: phones hate side-by-side multi-column layouts.
 */

import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  Avatar,
  Body,
  Btn,
  Caption,
  Card,
  Divider,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack,
  Title,
} from "@/components/ui";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { winRate } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);

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
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <View style={{ height: space[3] }} />

      {/* ── Identity ────────────────────────────────────────────── */}
      <Stack gap={4} align="center" style={{ marginVertical: space[5] }}>
        <Avatar uri={user.avatar} name={user.username} size="xl" highlighted />
        <Stack gap={1} align="center">
          <Title center>{user.username}</Title>
          <Caption tone="muted" center>
            {user.email}
          </Caption>
        </Stack>
        <Row gap={2} align="center">
          <Pill label={user.rank} tone="accent" />
          {user.title ? <Pill label={user.title.toUpperCase()} tone="muted" /> : null}
          {user.under_review ? <Pill label="UNDER REVIEW" tone="warn" /> : null}
        </Row>
      </Stack>

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
      </Section>

      {/* ── Progression ─────────────────────────────────────────── */}
      <Section label="PROGRESSION">
        <Card variant="surface" padding="md">
          <Stack gap={3}>
            <KV left="Level" right={String(user.level)} />
            <Divider />
            <KV left="XP" right={user.xp.toLocaleString()} />
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
      <Btn variant="secondary" onPress={handleLogout}>
        Sign out
      </Btn>
    </Screen>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <Eyebrow tone="muted" style={{ marginBottom: space[2] }}>
        {label}
      </Eyebrow>
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
  const valueColor =
    tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.textMuted;
  return (
    <View style={styles.statTile}>
      <Heading style={{ color: valueColor }}>{value}</Heading>
      <Caption tone="muted">{label}</Caption>
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
  const bg =
    tone === "accent"
      ? "rgba(204,0,0,0.12)"
      : tone === "warn"
      ? "rgba(255,176,32,0.12)"
      : colors.bgRaised;
  const border =
    tone === "accent" ? colors.borderAccent : tone === "warn" ? colors.warn : colors.border;
  const color = tone === "accent" ? colors.accent : tone === "warn" ? colors.warn : colors.text;

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
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space[3],
    alignItems: "center",
    justifyContent: "center",
  },
});
