/**
 * Home tab.
 *
 * Brand wordmark, identity card, and a 2×2 grid of four equal play /
 * extras tiles (Play Online · Training · Store · Collection) rendered as
 * "obsidian glass" surfaces — dark frosted panels with a light sheen, a
 * thin neutral edge, a soft accent glow and a glowing mode icon. The same
 * glass material backs the identity card so the whole screen reads as one
 * cohesive sheet of glass over the equipped banner. Fully theme-reactive —
 * every surface reads the active palette via ``useTheme()`` so equipping a
 * theme reskins the glow + icons automatically.
 */

import { type ComponentProps } from "react";
import { router, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

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

import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Small color helpers ─────────────────────────────────────────────────────
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
/** Soft accent drop-glow — sits on a non-clipped wrapper so it isn't cut off. */
function glow(accent: string, radius = 14, opacity = 0.4): ViewStyle {
  return {
    shadowColor: accent,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  };
}

type MCIName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type TileKey = "multiplayer" | "training" | "store" | "collection";

interface TileDef {
  key: TileKey;
  title: string;
  icon: MCIName;
}

const TILES: TileDef[] = [
  { key: "multiplayer", title: "PLAY ONLINE", icon: "sword-cross" },
  { key: "training", title: "TRAINING", icon: "robot" },
  { key: "store", title: "STORE", icon: "storefront" },
  { key: "collection", title: "COLLECTION", icon: "cards" },
];

/** 2×2 grid — two rows of two tiles each. */
const TILE_ROWS: TileDef[][] = [TILES.slice(0, 2), TILES.slice(2)];

/** Brand mark shown top-right in place of the user's avatar. */
const BRAND_LOGO = require("@/assets/images/icon.png");

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
        {/* ── Edge vignette: darken top + bottom so content pops ── */}
        <LinearGradient
          colors={["rgba(3,3,3,0.55)", "rgba(3,3,3,0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.3 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(3,3,3,0)", "rgba(3,3,3,0.7)"]}
          start={{ x: 0.5, y: 0.68 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* ── Soft accent bloom behind the wordmark ── */}
        <LinearGradient
          colors={[withAlpha(palette.accent, 0.22), withAlpha(palette.accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGlow}
          pointerEvents="none"
        />

        <Screen padded background="transparent">
          {/* ── Brand row ───────────────────────────────────────────── */}
          <Row justify="between" align="center" style={{ marginTop: space[3] }}>
            <Wordmark size="md" />
            <Pressable
              onPress={goToProfile}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Image source={BRAND_LOGO} style={styles.brandLogo} resizeMode="contain" />
            </Pressable>
          </Row>

          {/* ── Identity card (obsidian glass, matches the tiles) ────── */}
          <Animated.View
            entering={FadeInDown.duration(380).springify()}
            style={[styles.idShadow, glow(palette.accent)]}
          >
            <View style={styles.idClip}>
              <GlassLayers accent={palette.accent} />
              <View style={styles.idContent}>
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
              </View>
            </View>
          </Animated.View>

          {/* ── 2×2 grid of four equal obsidian-glass tiles. The grid
              claims the remaining height so the tiles fit the screen
              with no scrolling; the gaps + insets keep them floating
              with breathing room. ───────────────────────────────────── */}
          <View style={styles.tileGrid}>
            {TILE_ROWS.map((row, r) => (
              <View key={r} style={styles.tileRow}>
                {row.map((tile, c) => (
                  <GlassTile
                    key={tile.key}
                    title={tile.title}
                    icon={tile.icon}
                    index={r * 2 + c}
                    palette={palette}
                    onPress={() => handleTilePress(tile.key)}
                  />
                ))}
              </View>
            ))}
          </View>

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
 * The shared "glass" material layers — a diagonal light sheen, a soft accent
 * wash bleeding from the left edge, and a 1px top bevel highlight. Drop these
 * inside any rounded, clipped surface (tiles + identity card) to make it read
 * as a single sheet of glass. Purely decorative, so it never intercepts touch.
 */
function GlassLayers({ accent }: { accent: string }) {
  return (
    <>
      <LinearGradient
        colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[withAlpha(accent, 0.18), withAlpha(accent, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.65, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.topHairline} pointerEvents="none" />
    </>
  );
}

/**
 * A single obsidian-glass tile. The accent drop-glow lives on the outer
 * (un-clipped) ``AnimatedPressable`` while the layers + content live in the
 * inner clipped view. Pressing springs it down a touch, fades in an accent
 * tint, and fires a light haptic; tiles stagger in on mount.
 */
function GlassTile({
  title,
  icon,
  index,
  palette,
  onPress,
}: {
  title: string;
  icon: MCIName;
  index: number;
  palette: ThemePalette;
  onPress: () => void;
}) {
  const accent = palette.accent;
  const pressed = useSharedValue(0);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: pressed.value * 0.55 }));

  const press = (to: number) => {
    pressed.value = withSpring(to, { damping: 18, stiffness: 240 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 70).springify()} style={styles.tileSlot}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          press(1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }}
        onPressOut={() => press(0)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.tilePressable, glow(accent), scaleStyle]}
      >
        <View style={styles.glassClip}>
          <GlassLayers accent={accent} />
          {/* Press tint — brightens the accent on touch */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(accent, 0.3) }, tintStyle]}
          />
          <View style={styles.tileContent}>
            <MaterialCommunityIcons
              name={icon}
              size={32}
              color={accent}
              style={[styles.tileIcon, { textShadowColor: withAlpha(accent, 0.85) }]}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.tileTitle, { color: palette.text, fontFamily: palette.fontDisplay }]}
            >
              {title}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const GLASS_FILL = "rgba(14, 14, 18, 0.55)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.10)";
const GLASS_HAIRLINE = "rgba(255, 255, 255, 0.18)";

const styles = StyleSheet.create({
  eloGlow: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  // Matches Avatar size="sm" (32px) so the header layout doesn't shift.
  brandLogo: {
    width: 32,
    height: 32,
  },
  headerGlow: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 280,
    height: 190,
    borderRadius: 140,
  },
  topHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GLASS_HAIRLINE,
  },
  // Identity card
  idShadow: {
    marginTop: space[5],
    borderRadius: radii.lg,
  },
  idClip: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_FILL,
    overflow: "hidden",
  },
  idContent: {
    padding: space[4],
  },
  // Tiles
  tileGrid: {
    flex: 1,
    gap: space[4],
    marginTop: space[5],
    paddingTop: space[2],
    paddingBottom: space[4],
  },
  tileRow: {
    flex: 1,
    flexDirection: "row",
    gap: space[4],
  },
  tileSlot: {
    flex: 1,
    minHeight: 120,
  },
  tilePressable: {
    flex: 1,
    borderRadius: radii.lg,
  },
  glassClip: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_FILL,
    overflow: "hidden",
    justifyContent: "center",
  },
  tileContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
    paddingHorizontal: space[4],
  },
  tileIcon: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tileTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
