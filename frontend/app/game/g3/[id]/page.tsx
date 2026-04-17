"use client";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppShell";
import GameScreen from "@/components/GameScreen";
import { BOT_MAP } from "@/lib/routes";
import type { Difficulty } from "@/lib/botEngine";

export default function Game7x7Page() {
  const ctx = useApp();
  const searchParams = useSearchParams();
  const isMulti = !!ctx.multiRoomCode;

  const botQuery = (searchParams.get("bot") || "").toLowerCase();
  const botEntry = botQuery ? BOT_MAP[botQuery] : undefined;
  const isBot = !isMulti && !!botEntry;
  const difficulty: Difficulty | undefined = botEntry?.difficulty;

  return (
    <GameScreen
      key={`game_g3_${ctx.multiRoomCode || (isBot ? `ai_${botQuery}` : "sp")}`}
      themeId={ctx.themeId}
      isSingleplayer={!isMulti}
      gameMode={isMulti ? (ctx.isRanked ? "ranked" : "unranked") : isBot ? "ai" : "singleplayer"}
      difficulty={difficulty}
      setScreenAction={ctx.navigate}
      roomCode={isMulti ? ctx.multiRoomCode : undefined}
      playerSlot={isMulti ? (ctx.multiPlayerSlot ?? undefined) : undefined}
      matchupData={isMulti ? (ctx.multiMatchup ?? undefined) : undefined}
      p1Name={ctx.user?.username}
      graphicsQuality={ctx.graphicsQuality}
      boardMode="7x7"
      selectedPatterns={ctx.selectedPatterns}
      multiplayerRulesBootstrap={isMulti ? ctx.multiplayerRulesBootstrap : undefined}
      setHomeNoticeAction={ctx.setHomeNotice}
      onMultiplayerBoardSync={isMulti ? (mode, pats) => { ctx.setBoardMode(mode); ctx.setSelectedPatterns(pats); } : undefined}
      onMultiplayerSeriesSealedAction={isMulti ? ctx.sealMultiSeriesNavigation : undefined}
      onMultiplayerSeriesResumedAction={isMulti ? ctx.resumeMultiSeriesNavigation : undefined}
      onMultiplayerNavLockChange={isMulti ? ctx.setMultiplayerNavUnlocked : undefined}
      playHoverAction={ctx.sfx.hover}
      playPlaceAction={ctx.sfx.place}
      playVictoryAction={ctx.sfx.victory}
      playDefeatAction={ctx.sfx.defeat}
      playRulebreakerAction={ctx.sfx.rulebreaker}
      playTransitionAction={ctx.sfx.transition}
      playClickAction={ctx.sfx.click}
    />
  );
}
