"use client";
import { useApp } from "@/components/AppShell";
import StoreScreen from "@/components/Storescreen";

export default function StorePage() {
  const ctx = useApp();
  return (
    <StoreScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      audio={{ pauseBgm: ctx.audio.pauseBgm, resumeBgm: ctx.audio.resumeBgm }}
    />
  );
}
