"use client";
import { useApp } from "@/components/AppShell";
import StoreScreen from "@/components/Storescreen";

/**
 * /store/buyps — opens the store with the "Buy PentaShards" modal active.
 */
export default function StoreBuyPentaShardsPage() {
  const ctx = useApp();
  return (
    <StoreScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      audio={{ pauseBgm: ctx.audio.pauseBgm, resumeBgm: ctx.audio.resumeBgm }}
      initialSection="buyps"
    />
  );
}
