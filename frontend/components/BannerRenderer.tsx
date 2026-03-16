"use client";
import React from "react";
import VoidRiftBanner from "./VoidRiftBanner";
import BloodMoonBanner from "./BloodMoonBanner";

export const BANNERS_DATA: Record<string, any> = {
  default: { id: "default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  void_rift: { id: "void_rift", gradient: "linear-gradient(135deg,#0e0020,#020005)", component: VoidRiftBanner },
  blood_moon: { id: "blood_moon", gradient: "linear-gradient(135deg,#000008,#180008)", component: BloodMoonBanner },
};

export function BannerRenderer({ bannerId, style = {}, hideLabels = false }: { bannerId: string; style?: React.CSSProperties; hideLabels?: boolean }) {
  const banner = BANNERS_DATA[bannerId] || BANNERS_DATA.default;
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
