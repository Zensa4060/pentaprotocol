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
}

const TILES: TileDef[] = [
  { key: "multiplayer", title: "PLAY ONLINE" },
  { key: "training", title: "TRAINING" },
  { key: "store", title: "STORE" },
  { key: "collection", title: "COLLECTION" },
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
        <Screen padded background="transparent">
          {/* ── Brand row ───────────────────────────────────────────── */}
          <Row justify="between" align="center" style={{ marginTop: space[3] }}>
            <Wordmark size="md" />
            <Pressable onPress={goToProfile} hitSlop={8} accessibilityRole="button">
              <Avatar uri={avatarUri} name={user?.username} size="sm" />
            </Pressable>
          </Row>

          {/* ── Identity card ───────────────────────────────────────── */}
          <Card variant="accent" padding="md" style={{ marginTop: space[5] }}>
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

          {/* ── One panel of four equal red-glass tiles. ``fill`` makes
              the panel claim every remaining pixel so the four tiles
              grow to fit the screen with no scrolling. ──────────────── */}
          <Stack gap={3} fill style={{ marginTop: space[5], paddingBottom: space[3] }}>
            {TILES.map((tile) => (
              <GlassTile
                key={tile.key}
                title={tile.title}
                palette={palette}
                onPress={() => handleTilePress(tile.key)}
              />
            ))}
          </Stack>

          {/* ── Status (review banner, etc.) ────────────────────────── */}
          {user?.under_review ? (
            <Card variant="surface" padding="md" tone="warn" style={{ marginBottom: space[3] }}>
              <Eyebrow tone="warn">ACCOUNT UNDER REVIEW</Eyebrow>
              <Caption tone="muted" style={{ marginTop: space[2] }}>
                Recent activity flagged your account for review. Matchmaking may be
                restricted while we look into it.
              </Caption>
            </Card>
          ) : null}
        </Screen>
      </View>
    </TabSwipe>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * A single "colored glass" tile — red translucent gradient with a lighter-red
 * label, used uniformly for all four home actions so they read as one panel.
 * ``flex: 1`` lets the four tiles split the panel's height evenly, so they
 * grow to fill the screen (no scrolling) while staying equal.
 */
function GlassTile({
  title,
  palette,
  onPress,
}: {
  title: string;
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
        <Text
          numberOfLines={1}
          style={[styles.glassTitle, { color: lighten(tint, 0.6), fontFamily: palette.fontDisplay }]}
        >
          {title}
        </Text>
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
    // Grow to share the panel's height (fills the screen, no scroll). The
    // floor is the old 84 px tile + ~10%, so they never shrink below the
    // bigger baseline on short devices.
    flex: 1,
    minHeight: 92,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  glassInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[5],
  },
  glassTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
    textTransform: "uppercase",
  },
  glassChevron: {
    position: "absolute",
    right: space[5],
    top: "50%",
    transform: [{ translateY: -15 }],
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 30,
  },
});
