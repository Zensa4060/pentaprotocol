"use client";
import { useApp } from "@/components/AppShell";
import SingleplayerScreen from "@/components/SingleplayerScreen";
import type { BoardMode } from "@/lib/types";
import { buildGameUrl } from "@/lib/routes";
import { useRouter } from "next/navigation";

export default function TrainingPage() {
  const ctx = useApp();
  const router = useRouter();

  const handleBoardMode = (mode: BoardMode, patterns?: string[]) => {
    ctx.setBoardMode(mode);
    ctx.setSelectedPatterns(patterns || []);
    router.push(buildGameUrl(mode));
  };

  return (
    <SingleplayerScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      onHoverAction={ctx.sfx.hover}
      onBoardModeAction={handleBoardMode}
    />
  );
}
