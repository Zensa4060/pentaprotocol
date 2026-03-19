"use client";
import React from "react";
import VoidRiftBanner from "./VoidRiftBanner";
import BloodMoonBanner from "./BloodMoonBanner";
import PhantomStrikeBanner from "./PhantomStrikeBanner";
import SolarFlareBanner from "./SolarFlareBanner";
import CryoStormBanner from "./CryoStormBanner";
import NeonCircuitBanner from "./NeonCircuitBanner";
import StaticGlitchBanner from "./StaticGlitchBanner";
import GoldenNexusBanner from "./GoldenNexusBanner";
import PlasmaCoreBanner from "./PlasmaCoreBanner";
import ToxicSpillBanner from "./ToxicSpillBanner";
import StormProtocolBanner from "./StormProtocolBanner";
import ArcticVeilBanner from "./ArcticVeilBanner";
import StarfieldBanner from "./StarfieldBanner";
import DigitalRainBanner from "./DigitalRainBanner";
import InfernoBanner from "./InfernoBanner";

export const BANNERS_DATA: Record<string, any> = {
  default: { id: "default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  void_rift: { id: "void_rift", gradient: "linear-gradient(135deg,#0e0020,#020005)", component: VoidRiftBanner },
  blood_moon: { id: "blood_moon", gradient: "linear-gradient(135deg,#000008,#180008)", component: BloodMoonBanner },
  phantom_strike: { id: "phantom_strike", gradient: "linear-gradient(135deg,#060010,#110028)", component: PhantomStrikeBanner },
  solar_flare: { id: "solar_flare", gradient: "linear-gradient(135deg,#060200,#f97316)", component: SolarFlareBanner },
  cryo_storm: { id: "cryo_storm", gradient: "linear-gradient(135deg,#030c20,#081840)", component: CryoStormBanner },
  neon_circuit: { id: "neon_circuit", gradient: "linear-gradient(135deg,#020a04,#00ff66)", component: NeonCircuitBanner },
  static_glitch: { id: "static_glitch", gradient: "linear-gradient(135deg,#050505,#a00038)", component: StaticGlitchBanner },
  golden_nexus: { id: "golden_nexus", gradient: "linear-gradient(135deg,#060200,#fbbf24)", component: GoldenNexusBanner },
  plasma_core: { id: "plasma_core", gradient: "linear-gradient(135deg,#12082a,#6d28d9)", component: PlasmaCoreBanner },
  toxic_spill: { id: "toxic_spill", gradient: "linear-gradient(135deg,#010d03,#0a3d22)", component: ToxicSpillBanner },
  storm_protocol: { id: "storm_protocol", gradient: "linear-gradient(135deg,#060810,#0b1a3b)", component: StormProtocolBanner },
  arctic_veil: { id: "arctic_veil", gradient: "linear-gradient(135deg,#d8f0fc,#c5e8fb)", component: ArcticVeilBanner },
  starfield: { id: "starfield", gradient: "linear-gradient(135deg,#050210,#312e81)", component: StarfieldBanner },
  digital_rain: { id: "digital_rain", gradient: "linear-gradient(135deg,#000702,#14532d)", component: DigitalRainBanner },
  inferno: { id: "inferno", gradient: "linear-gradient(135deg,#070100,#ea580c)", component: InfernoBanner },
};

const normalizeId = (id: string) => id?.toLowerCase().replace(/\s+/g, "_") || "default";

export function BannerRenderer({ bannerId, style = {}, hideLabels = false }: { bannerId: string; style?: React.CSSProperties; hideLabels?: boolean }) {
  const nid = normalizeId(bannerId);
  const banner = BANNERS_DATA[nid] || BANNERS_DATA.default;
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} hideLabels={hideLabels} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
