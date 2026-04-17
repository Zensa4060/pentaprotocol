"use client";
import { useApp } from "@/components/AppShell";
import StoreScreen from "@/components/Storescreen";

/**
 * /store/buypc — opens the store with the "Buy ProtoCredits" modal active.
 */
export default function StoreBuyProtoCreditsPage() {
  const ctx = useApp();
  return (
    <StoreScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      audio={{ pauseBgm: ctx.audio.pauseBgm, resumeBgm: ctx.audio.resumeBgm }}
      initialSection="buypc"
    />
  );
}
