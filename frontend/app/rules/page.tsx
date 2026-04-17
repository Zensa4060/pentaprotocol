"use client";
import { useApp } from "@/components/AppShell";
import RulesScreen from "@/components/RulesScreen";

export default function RulesPage() {
  const { themeId, sfx } = useApp();
  return <RulesScreen themeId={themeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />;
}
