"use client";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppShell";
import StoreScreen from "@/components/Storescreen";

/**
 * /store/preview/{slug} — a standalone item preview (themes or grid bundles).
 * Examples:
 *   /store/preview/sptheme
 *   /store/preview/pxtheme
 *   /store/preview/glaciergrid
 *   /store/preview/infernogrid
 * Coins and banners do not have dedicated previews.
 */
export default function StorePreviewPage() {
  const params = useParams();
  const ctx = useApp();
  const slug = typeof params.slug === "string" ? params.slug : "";

  return (
    <StoreScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      audio={{ pauseBgm: ctx.audio.pauseBgm, resumeBgm: ctx.audio.resumeBgm }}
      initialPreview={slug}
    />
  );
}
