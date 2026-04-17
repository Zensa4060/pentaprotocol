"use client";
import { useApp } from "@/components/AppShell";
import AIScreen from "@/components/AIScreen";
import type { BoardMode } from "@/lib/types";
import type { Difficulty } from "@/lib/botEngine";

export default function ChallengePage() {
  const ctx = useApp();

  return (
    <AIScreen
      setScreenAction={ctx.navigate}
      themeId={ctx.themeId}
      onSelectDifficultyAction={(d: Difficulty, mode: BoardMode) => {
        ctx.sfx.click();
        ctx.setAiDifficulty(d);
        ctx.navigateToChallenge(mode, d);
      }}
      onHoverAction={ctx.sfx.hover}
      onBoardModeAction={(mode: BoardMode, patterns?: string[]) => {
        ctx.setBoardMode(mode);
        ctx.setSelectedPatterns(patterns || []);
      }}
    />
  );
}
