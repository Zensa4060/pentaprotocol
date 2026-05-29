"use client";
import React from "react";
import DigitalRainBanner     from "./DigitalRainBanner";
import LightsaberDuelBanner  from "./LightsaberDuelBanner";
import ArcadeBanner          from "./ArcadeBanner";
import HyperdriveBanner      from "./HyperdriveBanner";
import NorthernLightsBanner  from "./NorthernLightsBanner";
import VoidCollapseBanner    from "./VoidCollapseBanner";
import LavaFlowBanner        from "./LavaFlowBanner";
import ParticleWebBanner     from "./ParticleWebBanner";
import InkDropBanner         from "./InkDropBanner";
import ThunderStormBanner    from "./ThunderStormBanner";
import NeonPulseBanner       from "./NeonPulseBanner";
import DeepSeaBanner         from "./DeepSeaBanner";
import PrismaticLightBanner  from "./PrismaticLightBanner";
import SandDunesBanner       from "./SandDunesBanner";
import EmberPhoenixBanner    from "./EmberPhoenixBanner";
import CrystalCaveBanner     from "./CrystalCaveBanner";
import HackerTerminalBanner  from "./HackerTerminalBanner";
import TidalSurgeBanner      from "./TidalSurgeBanner";
import SolarWindBanner       from "./SolarWindBanner";
import LavaLampBanner        from "./LavaLampBanner";

export const BANNERS_DATA: Record<string, any> = {
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

export function BannerRenderer({ bannerId, style = {}, hideLabels: _hideLabels = false }: { bannerId: string; style?: React.CSSProperties; hideLabels?: boolean }) {
  const nid = normalizeId(bannerId);
  const banner = BANNERS_DATA[nid] || BANNERS_DATA.default;
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
