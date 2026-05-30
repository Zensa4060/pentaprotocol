"use client";
import React, { Suspense } from "react";
import dynamic from "next/dynamic";

// ── Lazy-load every banner component ────────────────────────────────────────
// Each banner is a separate JS chunk.  The file is only fetched the first time
// that specific banner is actually rendered — not at app boot.  This keeps the
// initial bundle lean and every subsequent banner load instant (cached).
//
// `loading: () => null` lets the gradient wrapper show through while the chunk
// downloads, giving a seamless static-→-animated transition with no blank flash.
const DigitalRainBanner    = dynamic(() => import("./DigitalRainBanner"),    { ssr: false, loading: () => null });
const LightsaberDuelBanner = dynamic(() => import("./LightsaberDuelBanner"), { ssr: false, loading: () => null });
const ArcadeBanner         = dynamic(() => import("./ArcadeBanner"),         { ssr: false, loading: () => null });
const HyperdriveBanner     = dynamic(() => import("./HyperdriveBanner"),     { ssr: false, loading: () => null });
const NorthernLightsBanner = dynamic(() => import("./NorthernLightsBanner"), { ssr: false, loading: () => null });
const VoidCollapseBanner   = dynamic(() => import("./VoidCollapseBanner"),   { ssr: false, loading: () => null });
const LavaFlowBanner       = dynamic(() => import("./LavaFlowBanner"),       { ssr: false, loading: () => null });
const ParticleWebBanner    = dynamic(() => import("./ParticleWebBanner"),    { ssr: false, loading: () => null });
const InkDropBanner        = dynamic(() => import("./InkDropBanner"),        { ssr: false, loading: () => null });
const ThunderStormBanner   = dynamic(() => import("./ThunderStormBanner"),   { ssr: false, loading: () => null });
const NeonPulseBanner      = dynamic(() => import("./NeonPulseBanner"),      { ssr: false, loading: () => null });
const DeepSeaBanner        = dynamic(() => import("./DeepSeaBanner"),        { ssr: false, loading: () => null });
const PrismaticLightBanner = dynamic(() => import("./PrismaticLightBanner"), { ssr: false, loading: () => null });
const SandDunesBanner      = dynamic(() => import("./SandDunesBanner"),      { ssr: false, loading: () => null });
const EmberPhoenixBanner   = dynamic(() => import("./EmberPhoenixBanner"),   { ssr: false, loading: () => null });
const CrystalCaveBanner    = dynamic(() => import("./CrystalCaveBanner"),    { ssr: false, loading: () => null });
const HackerTerminalBanner = dynamic(() => import("./HackerTerminalBanner"), { ssr: false, loading: () => null });
const TidalSurgeBanner     = dynamic(() => import("./TidalSurgeBanner"),     { ssr: false, loading: () => null });
const SolarWindBanner      = dynamic(() => import("./SolarWindBanner"),      { ssr: false, loading: () => null });
const LavaLampBanner       = dynamic(() => import("./LavaLampBanner"),       { ssr: false, loading: () => null });

// ── Banner registry ──────────────────────────────────────────────────────────
// The gradient is shown immediately (no JS required) and the animated canvas
// mounts over it once the chunk is ready.
export const BANNERS_DATA: Record<string, { id: string; gradient: string; component?: React.ComponentType<any> }> = {
  default:          { id: "default",          gradient: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  digital_rain:     { id: "digital_rain",     gradient: "linear-gradient(135deg,#000702,#14532d)", component: DigitalRainBanner },
  lightsaber_duel:  { id: "lightsaber_duel",  gradient: "linear-gradient(135deg,#06020e,#0d0520)", component: LightsaberDuelBanner },
  arcade:           { id: "arcade",           gradient: "linear-gradient(135deg,#000010,#000520)", component: ArcadeBanner },
  hyperdrive:       { id: "hyperdrive",       gradient: "linear-gradient(135deg,#02030e,#05041a)", component: HyperdriveBanner },
  northern_lights:  { id: "northern_lights",  gradient: "linear-gradient(135deg,#000c12,#010f18)", component: NorthernLightsBanner },
  void_collapse:    { id: "void_collapse",    gradient: "linear-gradient(135deg,#02010c,#0a0518)", component: VoidCollapseBanner },
  lava_flow:        { id: "lava_flow",        gradient: "linear-gradient(135deg,#060100,#200400)", component: LavaFlowBanner },
  particle_web:     { id: "particle_web",     gradient: "linear-gradient(135deg,#060810,#0b1030)", component: ParticleWebBanner },
  ink_drop:         { id: "ink_drop",         gradient: "linear-gradient(135deg,#f6f4f0,#fafaf7)", component: InkDropBanner },
  thunder_storm:    { id: "thunder_storm",    gradient: "linear-gradient(135deg,#060810,#080e20)", component: ThunderStormBanner },
  neon_pulse:       { id: "neon_pulse",       gradient: "linear-gradient(135deg,#04020c,#0c0520)", component: NeonPulseBanner },
  deep_sea:         { id: "deep_sea",         gradient: "linear-gradient(135deg,#00020a,#00061a)", component: DeepSeaBanner },
  prismatic_light:  { id: "prismatic_light",  gradient: "linear-gradient(135deg,#f0f2f8,#f8fafc)", component: PrismaticLightBanner },
  sand_dunes:       { id: "sand_dunes",       gradient: "linear-gradient(135deg,#c47820,#e8a830)", component: SandDunesBanner },
  ember_phoenix:    { id: "ember_phoenix",    gradient: "linear-gradient(135deg,#040100,#1c0400)", component: EmberPhoenixBanner },
  crystal_cave:     { id: "crystal_cave",     gradient: "linear-gradient(135deg,#080515,#0e0820)", component: CrystalCaveBanner },
  hacker_terminal:  { id: "hacker_terminal",  gradient: "linear-gradient(135deg,#010804,#021408)", component: HackerTerminalBanner },
  tidal_surge:      { id: "tidal_surge",      gradient: "linear-gradient(135deg,#010c1a,#002040)", component: TidalSurgeBanner },
  solar_wind:       { id: "solar_wind",       gradient: "linear-gradient(135deg,#060200,#130500)", component: SolarWindBanner },
  lava_lamp:        { id: "lava_lamp",        gradient: "linear-gradient(135deg,#0e0500,#1c0800)", component: LavaLampBanner },
};

const normalizeId = (id: string) => id?.toLowerCase().replace(/\s+/g, "_") || "default";

export function BannerRenderer({
  bannerId,
  style = {},
  hideLabels: _hideLabels = false,
  preview = false,
}: {
  bannerId: string;
  style?: React.CSSProperties;
  hideLabels?: boolean;
  /** Thumbnail mode — zooms + brightens so collection cards match the hero preview. */
  preview?: boolean;
}) {
  const nid    = normalizeId(bannerId);
  const banner = BANNERS_DATA[nid] || BANNERS_DATA.default;

  const BannerComp = banner.component;
  const inner = BannerComp ? (
    <div style={{ position: "relative", width: "100%", height: "100%", background: banner.gradient }}>
      <BannerComp style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  ) : (
    <div style={{ width: "100%", height: "100%", background: banner.gradient }} />
  );

  if (preview) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "152%",
            height: "152%",
            transform: "translate(-50%, -50%)",
            filter: "brightness(1.38) contrast(1.18) saturate(1.25)",
          }}
        >
          {inner}
        </div>
      </div>
    );
  }

  if (BannerComp) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: banner.gradient, ...style }}>
        <BannerComp style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
    );
  }

  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
