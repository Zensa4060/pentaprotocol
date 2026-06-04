/**
 * Home tab.
 *
 * The first authenticated screen the user lands on: brand wordmark,
 * identity card, stats, currency, extras (store/collection), and the
 * play modes. Fully theme-reactive — every surface reads the active
 * palette via ``usePalette()`` so equipping a theme reskins the whole
 * screen (chrome + fonts + accents), matching the web behaviour.
 */

import { router, type Href } from "expo-router";

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
  Wordmark,
} from "@/components/ui";
import { RankBadge } from "@/components/RankBadge";
import { BannerRenderer } from "@/components/BannerRenderer";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import { useLocalAvatar } from "@/lib/avatar";
import { useAuthStore } from "@/lib/store";
import { winRate } from "@/lib/types";
import { radii, space } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

import { Pressable, StyleSheet, Text, View } from "react-native";

type ModeKey = "multiplayer" | "training";

interface ModeDef {
  key: ModeKey;
  title: string;
  description: string;
  /** Which palette field drives the mode's accent stripe. */
  accentKey: "accent" | "info";
}

const MODES: ModeDef[] = [
  {
    key: "multiplayer",
    title: "1V1 : ONLINE",
    description: "Ranked & casual matches against humans.",
    accentKey: "accent",
  },
  {
    key: "training",
    title: "1V1 : OFFLINE",
    description: "Tutorial, solo practice, and AI Bot — no rating.",
    accentKey: "info",
  },
];

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId, theme: palette } = useTheme();
  const localAvatar = useLocalAvatar();
  const avatarUri = localAvatar ?? user?.avatar ?? null;
  useSyncAudioTheme(themeId);
  useLobbyBgm();

  const handleModePress = (mode: ModeKey) => {
    if (mode === "training") {
      router.push("/training");
      return;
    }
    if (mode === "multiplayer") {
      router.push("/multiplayer");
    }
  };

  const goToProfile = () => router.push("/(tabs)/profile");

  const wr = user
    ? winRate({ wins: user.wins, losses: user.losses, draws: user.draws })
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* ── Equipped banner — full-bleed backdrop (home + parity with web) ── */}
      <BannerRenderer
        bannerId={user?.banner}
        themeId={themeId}
        overlayOpacity={0.62}
        style={StyleSheet.absoluteFill}
      />
      <Screen
        scrollable
        padded
        background="transparent"
        contentContainerStyle={{ paddingBottom: space[10] }}
      >
        {/* ── Brand row ───────────────────────────────────────────── */}
        <Row justify="between" align="center" style={{ marginTop: space[3] }}>
          <Wordmark size="md" />
          <Pressable onPress={goToProfile} hitSlop={8} accessibilityRole="button">
            <Avatar uri={avatarUri} name={user?.username} size="sm" />
          </Pressable>
        </Row>

        {/* ── Identity card ───────────────────────────────────────── */}
        <Card variant="accent" padding="md" style={{ marginTop: space[6] }}>
          <Row gap={4} align="center">
            <Avatar uri={avatarUri} name={user?.username} size="lg" highlighted />
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
          <StatTile label="WINS" value={user?.wins ?? 0} tone="success" palette={palette} />
          <StatTile label="LOSSES" value={user?.losses ?? 0} tone="danger" palette={palette} />
          <StatTile label="WIN RATE" value={`${wr}%`} tone="accent" palette={palette} />
        </Row>

        {/* ── Currency row ────────────────────────────────────────── */}
        <Row gap={3} style={{ marginTop: space[3] }}>
          <StatTile label="⬡ PROTOCREDITS" value={user?.protocredits ?? 0} tone="accent" palette={palette} />
          <StatTile label="◆ PENTASHARDS" value={user?.shards ?? 0} tone="info" palette={palette} />
        </Row>

        <SectionHeader label="EXTRAS" />
        <Row gap={3}>
          <ExtraTile
            title="STORE"
            subtitle="Themes & currency"
            palette={palette}
            onPress={() => router.push("/store" as Href)}
          />
          <ExtraTile
            title="COLLECTION"
            subtitle="Owned cosmetics"
            palette={palette}
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
              palette={palette}
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
    </View>
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
  palette,
}: {
  label: string;
  value: string | number;
  tone: "success" | "danger" | "accent" | "info";
  palette: ThemePalette;
}) {
  const valueColor =
    tone === "success"
      ? palette.success
      : tone === "danger"
      ? palette.danger
      : tone === "info"
      ? palette.info
      : palette.accent;
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: palette.bgCard, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.statValue, { color: valueColor, fontFamily: palette.fontDisplay }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.textMuted }]}>{label}</Text>
    </View>
  );
}

function ExtraTile({
  title,
  subtitle,
  palette,
  onPress,
}: {
  title: string;
  subtitle: string;
  palette: ThemePalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.extraTile,
        { backgroundColor: palette.bgCard, borderColor: palette.border },
        pressed && { backgroundColor: palette.bgRaised, transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.extraTitle, { color: palette.text, fontFamily: palette.fontDisplay }]}>
        {title}
      </Text>
      <Caption tone="muted">{subtitle}</Caption>
    </Pressable>
  );
}

function ModeTile({
  mode,
  palette,
  onPress,
}: {
  mode: ModeDef;
  palette: ThemePalette;
  onPress: () => void;
}) {
  const accent = mode.accentKey === "info" ? palette.info : palette.accent;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: palette.bgRaised }}
      accessibilityRole="button"
      accessibilityLabel={mode.title}
      style={({ pressed }) => [
        styles.modeTile,
        { backgroundColor: palette.bgCard, borderColor: palette.border, borderLeftColor: accent },
        pressed && { backgroundColor: palette.bgRaised, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Stack gap={1} fill>
        <Heading>{mode.title}</Heading>
        <Body tone="muted">{mode.description}</Body>
      </Stack>
      <Text style={[styles.modeChevron, { color: palette.textDim }]}>›</Text>
    </Pressable>
  );
}

// ─── Styles (layout only — colors come from the palette at render) ───────────

const styles = StyleSheet.create({
  extraTile: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space[3],
  },
  extraTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  statTile: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginTop: 2,
  },

  modeTile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  modeChevron: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 28,
  },
});
