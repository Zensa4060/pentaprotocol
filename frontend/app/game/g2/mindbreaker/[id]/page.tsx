"use client";
import { useApp } from "@/components/AppShell";
import GameScreen from "@/components/GameScreen";

export default function Mindbreaker6x6Page() {
  const ctx = useApp();
  const isMulti = !!ctx.multiRoomCode;
  return (
    <GameScreen
      key="game_g2_mindbreaker"
      themeId={ctx.themeId}
      isSingleplayer={!isMulti}
      gameMode={isMulti ? (ctx.isRanked ? "ranked" : "unranked") : "singleplayer"}
      setScreenAction={ctx.navigate}
      roomCode={isMulti ? ctx.multiRoomCode : undefined}
      playerSlot={isMulti ? (ctx.multiPlayerSlot ?? undefined) : undefined}
      matchupData={isMulti ? (ctx.multiMatchup ?? undefined) : undefined}
      p1Name={ctx.user?.username}
      graphicsQuality={ctx.graphicsQuality}
      boardMode="6x6"
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
