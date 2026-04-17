"use client";
import { useApp } from "@/components/AppShell";
import CollectionScreen from "@/components/CollectionScreen";

export default function CollectionGridsPage() {
  const { themeId, setThemeId, sfx } = useApp();
  return (
    <CollectionScreen
      themeId={themeId}
      setThemeIdAction={setThemeId}
      onHoverAction={sfx.hover}
      onClickAction={sfx.click}
      initialTab="board_bundles"
    />
  );
}
