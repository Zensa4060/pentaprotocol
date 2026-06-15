/**
 * Home tab.
 *
 * Brand wordmark, identity card, and a single panel of four equal play /
 * extras tiles (Play Online · Training · Store · Collection) rendered as
 * red "colored glass" surfaces. Community links now live at the bottom of
 * the Friends tab. Fully theme-reactive — every surface reads the active
 * palette via ``useTheme()`` so equipping a theme reskins the whole screen.
 */

import { router, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import {
  Avatar,
  Btn,
  Caption,
  Card,
  Eyebrow,
  Row,
  Screen,
  Stack,
  Title,
  Wordmark,
} from "@/components/ui";
import { RankBadge } from "@/components/RankBadge";
import { BannerRenderer } from "@/components/BannerRenderer";
import { TabSwipe } from "@/components/TabSwipe";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import { useLocalAvatar } from "@/lib/avatar";
import { useAuthStore } from "@/lib/store";
import { radii, space } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

import { Pressable, StyleSheet, Text, View } from "react-native";

// ─── Small color helpers (so the red "glass" tiles stay theme-reactive) ──────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
/** Translucent version of a hex color. */
function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** A lighter shade of a hex color (mix toward white by ``amt`` 0–1). */
function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

type TileKey = "multiplayer" | "training" | "store" | "collection";

interface TileDef {
  key: TileKey;
  title: string;
  subtitle?: string;
}

const TILES: TileDef[] = [
  { key: "multiplayer", title: "Play Online" },
  { key: "training", title: "Training" },
  { key: "store", title: "Store", subtitle: "Themes & banners" },
  { key: "collection", title: "Collection", subtitle: "Owned cosmetics" },
];

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId, theme: palette } = useTheme();
  const localAvatar = useLocalAvatar();
  const avatarUri = localAvatar ?? user?.avatar ?? null;
  useSyncAudioTheme(themeId);
  useLobbyBgm();

  const handleTilePress = (key: TileKey) => {
    if (key === "training") return void router.push("/training");
    if (key === "multiplayer") return void router.push("/multiplayer");
    if (key === "store") return void router.push("/store" as Href);
    if (key === "collection") return void router.push("/collection" as Href);
  };

  const goToProfile = () => router.push("/(tabs)/profile");

  return (
    <TabSwipe index={0}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        {/* ── Equipped banner — full-bleed backdrop (parity with web) ── */}
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
                    size={28}
                    showLabel
                  />
                  {/* Glowing, colored ELO readout */}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.eloGlow,
                      {
                        color: palette.accentHot,
                        textShadowColor: withAlpha(palette.accentHot, 0.9),
                        fontFamily: palette.fontDisplay,
                      },
                    ]}
                  >
                    ELO {user?.elo ?? "—"}
                  </Text>
                  {user?.is_placement ? (
                    <Caption tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                      · placement
                    </Caption>
                  ) : null}
                </Row>
              </Stack>
            </Row>
          </Card>

          {/* ── One panel of four equal red-glass tiles ─────────────── */}
          <Stack gap={3} style={{ marginTop: space[6] }}>
            {TILES.map((tile) => (
              <GlassTile
                key={tile.key}
                title={tile.title}
                subtitle={tile.subtitle}
                palette={palette}
                onPress={() => handleTilePress(tile.key)}
              />
            ))}
          </Stack>

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

          <View style={{ height: space[6] }} />
          <Btn variant="ghost" onPress={goToProfile}>
            View profile
          </Btn>
        </Screen>
      </View>
    </TabSwipe>
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

/**
 * A single "colored glass" tile — red translucent gradient with a lighter-red
 * label, used uniformly for all four home actions so they read as one panel.
 */
function GlassTile({
  title,
  subtitle,
  palette,
  onPress,
}: {
  title: string;
  subtitle?: string;
  palette: ThemePalette;
  onPress: () => void;
}) {
  const tint = palette.accent;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: withAlpha(tint, 0.25) }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.glassTile,
        { borderColor: withAlpha(tint, 0.5) },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <LinearGradient
        colors={[withAlpha(tint, 0.3), withAlpha(tint, 0.1)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassInner}>
        <Stack gap={subtitle ? 1 : 0} fill>
          <Text
            numberOfLines={1}
            style={[styles.glassTitle, { color: lighten(tint, 0.6), fontFamily: palette.fontDisplay }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.glassSub, { color: withAlpha(lighten(tint, 0.7), 0.85) }]}>
              {subtitle}
            </Text>
          ) : null}
        </Stack>
        <Text style={[styles.glassChevron, { color: lighten(tint, 0.5) }]}>›</Text>
      </View>
    </Pressable>
  );
}

// ─── Styles (layout only — colors come from the palette at render) ───────────

const styles = StyleSheet.create({
  eloGlow: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  glassTile: {
    height: 84,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  glassInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[5],
    gap: space[3],
  },
  glassTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  glassSub: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  glassChevron: {
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 30,
  },
});
