/**
 * Home tab v2.
 *
 * The first authenticated screen the user lands on. Layout:
 *
 *   ┌──────────────────────────────────────┐
 *   │  PENTA·PROTOCOL          [Profile]   │   ← brand row
 *   │                                      │
 *   │  ╔══════════════════════════════════╗ │
 *   │  ║  [Avatar]  Username              ║ │   ← identity card
 *   │  ║            BRONZE I  · ELO 1024  ║ │
 *   │  ╚══════════════════════════════════╝ │
 *   │                                      │
 *   │   42      18      69%                │   ← stats row
 *   │   WINS    LOSSES  WIN RATE           │
 *   │                                      │
 *   │  ─────────  MODES  ─────────         │
 *   │                                      │
 *   │  [ MULTIPLAYER     >  ]              │
 *   │  [ TRAINING        >  ]              │
 *   │  [ AI ENGINE       >  ]              │
 *   │                                      │
 *   │  ─────────  STATUS  ────────         │
 *   │                                      │
 *   │  [Under review banner — if any]      │
 *   └──────────────────────────────────────┘
 *
 * The three mode tiles currently fire ``onPress`` with a placeholder
 * (we'll wire them to real screens in Phase 3 / 4). The "Profile"
 * pill in the brand row is a shortcut to the profile tab — we keep
 * it there even though it's reachable from the bottom tab bar
 * because the bar can scroll off on certain ROM tweaks.
 */

import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";

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
import { RankBadge } from "@/components/RankBadge";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import { loadThemePreference } from "@/lib/themePreference";
import { useAuthStore } from "@/lib/store";
import { winRate } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

import { Pressable, StyleSheet, Text, View } from "react-native";

type ModeKey = "multiplayer" | "training" | "ai";

interface ModeDef {
  key: ModeKey;
  title: string;
  description: string;
  accent: string;
}

const MODES: ModeDef[] = [
  {
    key: "multiplayer",
    title: "MULTIPLAYER",
    description: "Ranked & casual matches against humans.",
    accent: colors.accent,
  },
  {
    key: "training",
    title: "TRAINING",
    description: "Tutorial replay and local practice — no bot, no rating.",
    accent: colors.info,
  },
  {
    key: "ai",
    title: "AI ENGINE",
    description: "Named server opponents — SERAPHINA, REGINA, HER.",
    accent: "#A065FF",
  },
];

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [themeId, setThemeId] = useState("classic_dark");
  useEffect(() => {
    loadThemePreference().then(setThemeId).catch(() => undefined);
  }, []);
  useSyncAudioTheme(themeId);
  useLobbyBgm();

  const handleModePress = (mode: ModeKey) => {
    if (mode === "training") {
      router.push("/training");
      return;
    }
    if (mode === "multiplayer") {
      router.push("/multiplayer");
      return;
    }
    if (mode === "ai") {
      router.push("/engine");
    }
  };

  const goToProfile = () => router.push("/(tabs)/profile");

  const wr = user
    ? winRate({ wins: user.wins, losses: user.losses, draws: user.draws })
    : 0;

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      {/* ── Brand row ───────────────────────────────────────────── */}
      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Row gap={2} align="baseline">
          <Text style={styles.brandPenta}>PENTA</Text>
          <Text style={styles.brandProtocol}>PROTOCOL</Text>
        </Row>
        <Pressable onPress={goToProfile} hitSlop={8} accessibilityRole="button">
          <Avatar uri={user?.avatar ?? null} name={user?.username} size="sm" />
        </Pressable>
      </Row>

      {/* ── Identity card ───────────────────────────────────────── */}
      <Card variant="accent" padding="md" style={{ marginTop: space[6] }}>
        <Row gap={4} align="center">
          <Avatar uri={user?.avatar ?? null} name={user?.username} size="lg" highlighted />
          <Stack gap={1} fill>
            <Title numberOfLines={1}>{user?.username ?? "—"}</Title>
            <Row gap={2} align="center">
              <RankBadge
                elo={user?.elo ?? 0}
                isPlacement={user?.is_placement}
                size={32}
                showLabel
              />
              <Caption tone="muted">
                ELO {user?.elo ?? "—"}
                {user?.is_placement ? "  · placement" : null}
              </Caption>
            </Row>
          </Stack>
        </Row>
      </Card>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <Row gap={3} style={{ marginTop: space[5] }}>
        <StatTile label="WINS" value={user?.wins ?? 0} tone="success" />
        <StatTile label="LOSSES" value={user?.losses ?? 0} tone="danger" />
        <StatTile label="WIN RATE" value={`${wr}%`} tone="accent" />
      </Row>

      <SectionHeader label="EXTRAS" />
      <Row gap={3}>
        <ExtraTile
          title="STORE"
          subtitle="Themes & currency"
          onPress={() => router.push("/store" as Href)}
        />
        <ExtraTile
          title="COLLECTION"
          subtitle="Owned cosmetics"
          onPress={() => router.push("/collection" as Href)}
        />
      </Row>

      {/* ── Modes ───────────────────────────────────────────────── */}
      <SectionHeader label="MODES" />
      <Stack gap={3}>
        {MODES.map((mode) => (
          <ModeTile
            key={mode.key}
            mode={mode}
            onPress={() => handleModePress(mode.key)}
          />
        ))}
      </Stack>

      {/* ── Status (review banner, etc.) ────────────────────────── */}
      {user?.under_review ? (
        <>
          <SectionHeader label="STATUS" />
          <Card variant="surface" padding="md" tone="warn">
            <Eyebrow tone="warn">ACCOUNT UNDER REVIEW</Eyebrow>
            <Caption tone="muted" style={{ marginTop: space[2] }}>
              Recent activity flagged your account for review. Matchmaking may be
              restricted while we look into it.
            </Caption>
          </Card>
        </>
      ) : null}

      <View style={{ height: space[5] }} />
      <Btn variant="ghost" onPress={goToProfile}>
        View profile
      </Btn>
    </Screen>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <Row align="center" gap={3} style={{ marginTop: space[7], marginBottom: space[3] }}>
      <Divider />
      <Eyebrow tone="muted">{label}</Eyebrow>
      <Divider />
    </Row>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "danger" | "accent";
}) {
  const valueColor =
    tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.accent;
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExtraTile({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.extraTile, pressed && styles.modeTilePressed]}
      accessibilityRole="button"
    >
      <Text style={styles.extraTitle}>{title}</Text>
      <Caption tone="muted">{subtitle}</Caption>
    </Pressable>
  );
}

function ModeTile({ mode, onPress }: { mode: ModeDef; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.bgRaised }}
      accessibilityRole="button"
      accessibilityLabel={mode.title}
      style={({ pressed }) => [
        styles.modeTile,
        { borderLeftColor: mode.accent },
        pressed && styles.modeTilePressed,
      ]}
    >
      <Stack gap={1} fill>
        <Heading>{mode.title}</Heading>
        <Body tone="muted">{mode.description}</Body>
      </Stack>
      <Text style={styles.modeChevron}>›</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  brandPenta: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  brandProtocol: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },

  extraTile: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  extraTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  statTile: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginTop: 2,
  },

  modeTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  modeTilePressed: {
    backgroundColor: colors.bgRaised,
  },
  modeChevron: {
    color: colors.textDim,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 28,
  },
});
