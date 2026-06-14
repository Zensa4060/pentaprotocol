/**
 * Home tab.
 *
 * Brand wordmark, identity card, the two play modes (1V1 Online / 1V1
 * Offline) directly under the identity, and the extras (Store /
 * Collection). Wins/losses/currency live on Profile / Store now.
 * Fully theme-reactive — every surface reads the active palette via
 * ``useTheme()`` so equipping a theme reskins the whole screen.
 */

import { router, type Href } from "expo-router";

import {
  Avatar,
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
  Wordmark,
} from "@/components/ui";
import { RankBadge } from "@/components/RankBadge";
import { BannerRenderer } from "@/components/BannerRenderer";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import { useLocalAvatar } from "@/lib/avatar";
import { useAuthStore } from "@/lib/store";
import { radii, space } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

import { CommunityLinks } from "@/components/community/CommunityLinks";
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

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* ── Equipped banner — full-bleed backdrop (parity with web) ── */}
      <BannerRenderer
        bannerId={user?.banner}
        themeId={themeId}
        overlayOpacity={0.62}
        live
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
                  size={28}
                  showLabel
                />
                <Caption tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                  · ELO {user?.elo ?? "—"}
                  {user?.is_placement ? " · placement" : null}
                </Caption>
              </Row>
            </Stack>
          </Row>
        </Card>

        {/* ── Play modes (directly under identity, per spec) ──────── */}
        <Stack gap={3} style={{ marginTop: space[5] }}>
          {MODES.map((mode) => (
            <ModeTile
              key={mode.key}
              mode={mode}
              palette={palette}
              onPress={() => handleModePress(mode.key)}
            />
          ))}
        </Stack>

        {/* ── Extras (equal-size Store / Collection) ──────────────── */}
        <SectionLabel label="EXTRAS" />
        <Row gap={3}>
          <ExtraTile
            title="STORE"
            subtitle="Themes & banners"
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

        {/* ── Status (review banner, etc.) ────────────────────────── */}
        {user?.under_review ? (
          <>
            <SectionLabel label="STATUS" />
            <Card variant="surface" padding="md" tone="warn">
              <Eyebrow tone="warn">ACCOUNT UNDER REVIEW</Eyebrow>
              <Caption tone="muted" style={{ marginTop: space[2] }}>
                Recent activity flagged your account for review. Matchmaking may be
                restricted while we look into it.
              </Caption>
            </Card>
          </>
        ) : null}

        <SectionLabel label="COMMUNITY" />
        <CommunityLinks title="" />

        <View style={{ height: space[5] }} />
        <Btn variant="ghost" onPress={goToProfile}>
          View profile
        </Btn>
      </Screen>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Left-aligned section label (no flex dividers — those were clipping the
// eyebrow text to a stray "E"/"M" at the screen edge).
function SectionLabel({ label }: { label: string }) {
  return (
    <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[3] }}>
      {label}
    </Eyebrow>
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
      <Caption tone="muted" numberOfLines={1}>{subtitle}</Caption>
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
    height: 76,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: space[3],
  },
  extraTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
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
