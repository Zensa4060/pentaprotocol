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

import {
  AuroraBands,
  DriftBlobs,
  ExpandingRings,
  FallingGlyphs,
  ParticleDrift,
  PixelBlink,
  PulseGlow,
  StormFlash,
  StreakSweep,
} from "@/components/cosmetics/AnimatedFx";
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
  plasma_core: ["#12041f", "#2d0a4e"],
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

/**
 * Live animation layer per banner — mirrors the web's animated canvas
 * banners. Every id gets a real moving effect, not just its gradient.
 */
function BannerFx({ id }: { id: string }) {
  switch (id) {
    case "digital_rain":
      return <FallingGlyphs color="#4ADE80" columns={9} seed={2} />;
    case "hacker_terminal":
      return <FallingGlyphs color="#22C55E" columns={7} fontSize={9} seed={17} />;
    case "lightsaber_duel":
      return (
        <>
          <StreakSweep colors={["#60A5FA"]} count={2} heightRange={[3, 4]} angle="18deg" durationRange={[2200, 2600]} seed={4} />
          <StreakSweep colors={["#F87171"]} count={2} heightRange={[3, 4]} angle="-16deg" durationRange={[2500, 3100]} seed={9} />
        </>
      );
    case "arcade":
      return <PixelBlink colors={["#F472B6", "#60A5FA", "#FACC15", "#4ADE80"]} count={16} seed={6} />;
    case "hyperdrive":
      return <StreakSweep colors={["#BFDBFE", "#93C5FD", "#E0E7FF"]} count={8} heightRange={[1.5, 2.5]} durationRange={[900, 1900]} seed={3} />;
    case "northern_lights":
      return <AuroraBands colors={["rgba(74,222,128,0.5)", "rgba(96,165,250,0.45)"]} seed={5} />;
    case "aurora":
      return <AuroraBands colors={["rgba(52,211,153,0.5)", "rgba(45,212,191,0.4)"]} seed={8} />;
    case "void_collapse":
      return <PulseGlow color="rgba(124,58,237,0.55)" secondary="rgba(15,5,35,0.95)" durationMs={2000} />;
    case "void":
    case "void_rift":
      return <PulseGlow color="rgba(139,92,246,0.5)" secondary="rgba(76,29,149,0.6)" durationMs={2400} />;
    case "lava_flow":
    case "inferno":
      return (
        <>
          <DriftBlobs colors={["rgba(234,88,12,0.55)", "rgba(190,18,60,0.5)"]} count={3} seed={12} />
          <ParticleDrift color="#FB923C" count={8} direction="up" sizeRange={[2, 4]} seed={14} />
        </>
      );
    case "particle_web":
      return <ParticleDrift color="#93C5FD" count={14} direction="up" sizeRange={[2, 3.5]} durationRange={[5200, 9000]} seed={21} />;
    case "ink_drop":
      return <ExpandingRings color="rgba(30,30,30,0.7)" count={3} />;
    case "thunder_storm":
      return (
        <>
          <ParticleDrift color="rgba(147,197,253,0.7)" count={10} direction="down" sizeRange={[1.5, 2.5]} durationRange={[1100, 2100]} glow={false} seed={19} />
          <StormFlash />
        </>
      );
    case "neon_pulse":
      return <PulseGlow color="rgba(217,70,239,0.5)" secondary="rgba(34,211,238,0.45)" durationMs={1300} />;
    case "deep_sea":
      return <ParticleDrift color="rgba(125,211,252,0.8)" count={11} direction="up" sizeRange={[2.5, 6]} durationRange={[4200, 8600]} seed={25} />;
    case "prismatic_light":
      return <AuroraBands colors={["rgba(244,114,182,0.4)", "rgba(96,165,250,0.4)"]} seed={10} />;
    case "sand_dunes":
      return <DriftBlobs colors={["rgba(252,211,77,0.4)", "rgba(217,119,6,0.45)"]} count={3} seed={16} />;
    case "ember_phoenix":
      return <ParticleDrift color="#F97316" count={14} direction="up" sizeRange={[2, 5]} durationRange={[2400, 5400]} seed={27} />;
    case "crystal_cave":
      return (
        <>
          <PulseGlow color="rgba(167,139,250,0.4)" durationMs={2600} />
          <PixelBlink colors={["#C4B5FD", "#A5F3FC", "#F5D0FE"]} count={10} seed={30} />
        </>
      );
    case "tidal_surge":
      return (
        <>
          <DriftBlobs colors={["rgba(14,116,144,0.6)", "rgba(3,105,161,0.55)"]} count={3} seed={33} />
          <ExpandingRings color="rgba(125,211,252,0.5)" count={2} durationMs={4200} />
        </>
      );
    case "solar_wind":
      return <StreakSweep colors={["#FDBA74", "#FCD34D"]} count={6} heightRange={[1.5, 2.5]} angle="-6deg" durationRange={[1300, 2600]} seed={36} />;
    case "lava_lamp":
      return <DriftBlobs colors={["rgba(249,115,22,0.6)", "rgba(217,70,239,0.5)", "rgba(234,88,12,0.55)"]} count={4} seed={39} />;
    case "starfield":
    case "nebula":
      return <ParticleDrift color="#E0E7FF" count={14} direction="up" sizeRange={[1.5, 3]} durationRange={[7000, 12000]} seed={41} />;
    case "blood_moon":
    case "crimson":
      return <PulseGlow color="rgba(220,38,38,0.45)" secondary="rgba(127,29,29,0.55)" durationMs={2600} />;
    case "emerald":
      return <AuroraBands colors={["rgba(16,185,129,0.45)", "rgba(5,150,105,0.4)"]} seed={44} />;
    case "ocean":
      return <ParticleDrift color="rgba(125,211,252,0.7)" count={9} direction="up" sizeRange={[2, 4]} durationRange={[4600, 8400]} seed={47} />;
    case "gold":
      return <ParticleDrift color="rgba(252,211,77,0.85)" count={10} direction="up" sizeRange={[1.5, 3.5]} durationRange={[3600, 7000]} seed={50} />;
    case "plasma_core":
      return <PulseGlow color="rgba(217,70,239,0.55)" secondary="rgba(124,58,237,0.6)" durationMs={1500} />;
    default:
      return null;
  }
}

export interface BannerRendererProps {
  bannerId?: string | null;
  themeId?: ThemeId;
  style?: StyleProp<ViewStyle>;
  /** Optional dark overlay (0–1) painted over the gradient for text legibility. */
  overlayOpacity?: number;
  /** Set false to render the static gradient only (perf escape hatch). */
  animated?: boolean;
}

export function BannerRenderer({
  bannerId,
  themeId = "classic_dark",
  style,
  overlayOpacity = 0,
  animated = true,
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
      {animated ? <BannerFx id={id} /> : null}
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
