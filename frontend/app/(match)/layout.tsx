"use client";

import { useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import GameScreen from "@/components/GameScreen";
import { useApp } from "@/components/AppShell";
import { BOT_MAP, parseMatchPath } from "@/lib/routes";
import type { BoardMode } from "@/lib/types";
import type { Difficulty } from "@/lib/botEngine";

type LastGameRouteRef = {
  boardMode: BoardMode;
  variant?: string;
};

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  const ctx = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastGameRouteRef = useRef<LastGameRouteRef | null>(null);

  const matchInfo = useMemo(() => parseMatchPath(pathname), [pathname]);
  if (!matchInfo) return <>{children}</>;

  if (matchInfo.phasePath === "game" && matchInfo.boardMode) {
    lastGameRouteRef.current = {
      boardMode: matchInfo.boardMode,
      variant: matchInfo.variant,
    };
  }

  const inferredBoardMode = matchInfo.boardMode ?? lastGameRouteRef.current?.boardMode ?? ctx.boardMode ?? "5x5";
  const inferredVariant = matchInfo.variant ?? lastGameRouteRef.current?.variant;

  const isMulti = !!ctx.multiRoomCode;
  const botQuery = (searchParams.get("bot") || "").toLowerCase();
  const botEntry = botQuery ? BOT_MAP[botQuery] : undefined;
  const isBot = !isMulti && !!botEntry;
  const difficulty: Difficulty | undefined = botEntry?.difficulty;
  const botId: string | undefined = isBot ? botQuery : undefined;

  return (
    <AuthGuard>
      <GameScreen
        themeId={ctx.themeId}
        isSingleplayer={!isMulti}
        gameMode={isMulti ? (ctx.isRanked ? "ranked" : "unranked") : isBot ? "ai" : "singleplayer"}
        difficulty={difficulty}
        botId={botId}
        setScreenAction={ctx.navigate}
        roomCode={isMulti ? ctx.multiRoomCode : undefined}
        playerSlot={isMulti ? (ctx.multiPlayerSlot ?? undefined) : undefined}
        matchupData={isMulti ? (ctx.multiMatchup ?? undefined) : undefined}
        p1Name={ctx.user?.username}
        graphicsQuality={ctx.graphicsQuality}
        boardMode={inferredBoardMode}
        variant={inferredVariant}
        gameId={matchInfo.gameId}
        phasePath={matchInfo.phasePath}
        selectedPatterns={ctx.selectedPatterns}
        multiplayerRulesBootstrap={isMulti ? ctx.multiplayerRulesBootstrap : undefined}
        setHomeNoticeAction={ctx.setHomeNotice}
        onMultiplayerBoardSync={
          isMulti
            ? (mode, pats) => {
                ctx.setBoardMode(mode);
                ctx.setSelectedPatterns(pats);
              }
            : undefined
        }
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
        onOpenSettingsAction={() => {
          ctx.sfx.click();
          ctx.setShowSettings(true);
        }}
      />
      {children}
    </AuthGuard>
  );
}
