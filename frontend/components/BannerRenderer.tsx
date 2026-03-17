"use client";
import React from "react";
import VoidRiftBanner from "./VoidRiftBanner";
import BloodMoonBanner from "./BloodMoonBanner";
import PhantomStrikeBanner from "./PhantomStrikeBanner";
import SolarFlareBanner from "./SolarFlareBanner";

export const BANNERS_DATA: Record<string, any> = {
  default: { id: "default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  void_rift: { id: "void_rift", gradient: "linear-gradient(135deg,#0e0020,#020005)", component: VoidRiftBanner },
  blood_moon: { id: "blood_moon", gradient: "linear-gradient(135deg,#000008,#180008)", component: BloodMoonBanner },
  phantom_strike: { id: "phantom_strike", gradient: "linear-gradient(135deg,#060010,#110028)", component: PhantomStrikeBanner },
  solar_flare: { id: "solar_flare", gradient: "linear-gradient(135deg,#060200,#f97316)", component: SolarFlareBanner },
};

const normalizeId = (id: string) => id?.toLowerCase().replace(/\s+/g, "_") || "default";

export function BannerRenderer({ bannerId, style = {}, hideLabels = false }: { bannerId: string; style?: React.CSSProperties; hideLabels?: boolean }) {
  const nid = normalizeId(bannerId);
  const banner = BANNERS_DATA[nid] || BANNERS_DATA.default;
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
