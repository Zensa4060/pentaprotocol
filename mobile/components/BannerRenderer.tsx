/**
 * Banner renderer (mobile).
 *
 * Mirrors the gradient layer of the web ``BannerRenderer``
 * (``frontend/components/BannerRenderer.tsx``). The web app shows a
 * static CSS gradient instantly and then mounts an animated <canvas>
 * over it; on mobile we render the **gradient layer** with
 * ``expo-linear-gradient``. The gradient stops are ported verbatim
 * from the web ``BANNERS_DATA`` map so every banner reads with the
 * same colour identity as the web build.
 *
 * Equipped banner id comes from the server ``user.banner`` field. When
 * a player has the ``default`` banner equipped we resolve to a gradient
 * that complements their active theme (matching web behaviour).
 */

import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import type { ThemeId } from "@/theme/themes";

type Stops = readonly [string, string, ...string[]];

/** id → gradient stops. Ported from web ``BANNERS_DATA``. */
const BANNER_GRADIENTS: Record<string, Stops> = {
  default: ["#1a1a2e", "#16213e"],
  // Animated canvas banners (web) — represented here by their gradient.
  digital_rain: ["#000702", "#14532d"],
  lightsaber_duel: ["#06020e", "#0d0520"],
  arcade: ["#000010", "#000520"],
  hyperdrive: ["#02030e", "#05041a"],
  northern_lights: ["#000c12", "#010f18"],
  void_collapse: ["#02010c", "#0a0518"],
  lava_flow: ["#060100", "#200400"],
  particle_web: ["#060810", "#0b1030"],
  ink_drop: ["#f6f4f0", "#fafaf7"],
  thunder_storm: ["#060810", "#080e20"],
  neon_pulse: ["#04020c", "#0c0520"],
  deep_sea: ["#00020a", "#00061a"],
  prismatic_light: ["#f0f2f8", "#f8fafc"],
  sand_dunes: ["#c47820", "#e8a830"],
  ember_phoenix: ["#040100", "#1c0400"],
  crystal_cave: ["#080515", "#0e0820"],
  hacker_terminal: ["#010804", "#021408"],
  tidal_surge: ["#010c1a", "#002040"],
  solar_wind: ["#060200", "#130500"],
  lava_lamp: ["#0e0500", "#1c0800"],
  // Legacy gradient-only banners (web ``VALID_BANNERS``).
  crimson: ["#2a0000", "#550000"],
  emerald: ["#002a14", "#005028"],
  ocean: ["#001a2a", "#003a55"],
  void: ["#050008", "#150018"],
  gold: ["#2a2000", "#554000"],
  aurora: ["#001a14", "#003a28"],
  nebula: ["#1a0030", "#300050"],
  void_rift: ["#1a0030", "#3a0060"],
  blood_moon: ["#1a0000", "#4a0000"],
  inferno: ["#200400", "#5a1000"],
  starfield: ["#02040f", "#0d1835"],
};

/** ``default`` banner → per-theme complementary gradient (web parity). */
const DEFAULT_THEME_GRADIENTS: Record<ThemeId, Stops> = {
  classic_dark: ["#0C0E18", "#141824", "#1C2232"],
  classic_light: ["#14080E", "#200C16", "#2C101C"],
  space: ["#08041A", "#100830", "#1A0C40"],
  pixel: ["#100C02", "#1A1006", "#241408"],
};

const normalizeId = (id?: string | null) =>
  (id ?? "default").toLowerCase().replace(/\s+/g, "_") || "default";

export interface BannerRendererProps {
  bannerId?: string | null;
  themeId?: ThemeId;
  style?: StyleProp<ViewStyle>;
  /** Optional dark overlay (0–1) painted over the gradient for text legibility. */
  overlayOpacity?: number;
}

export function BannerRenderer({
  bannerId,
  themeId = "classic_dark",
  style,
  overlayOpacity = 0,
}: BannerRendererProps) {
  const id = normalizeId(bannerId);
  const stops: Stops =
    id === "default"
      ? DEFAULT_THEME_GRADIENTS[themeId] ?? DEFAULT_THEME_GRADIENTS.classic_dark
      : BANNER_GRADIENTS[id] ?? DEFAULT_THEME_GRADIENTS[themeId] ?? BANNER_GRADIENTS.default;

  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      <LinearGradient
        colors={stops as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {overlayOpacity > 0 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(3,3,3,${Math.min(1, Math.max(0, overlayOpacity))})` },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: "hidden" },
});

/** Known banner ids (for catalog/collection cross-checks). */
export const BANNER_IDS = Object.keys(BANNER_GRADIENTS);
