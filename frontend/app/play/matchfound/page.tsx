"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import LobbyScreen from "@/components/LobbyScreen";

export default function MatchFoundPage() {
  const ctx = useApp();
  return (
    <AuthGuard>
      <LobbyScreen
        setScreenAction={ctx.navigate}
        themeId={ctx.themeId}
        onQueueStartAction={ctx.startMatchmaking}
        onQueueCancelAction={ctx.cancelMatchmaking}
        onHoverAction={ctx.sfx.hover}
        onClickAction={ctx.sfx.click}
        onRoomReadyAction={ctx.handleRoomReady}
        queuePhase={ctx.queuePhase}
        queueElapsed={ctx.queueElapsed}
        matchupOpponent={ctx.matchupOpponent}
        queueError={ctx.queueError}
        forcedPhase="matchup"
        boardMode={ctx.boardMode}
        onBoardModeAction={ctx.setBoardMode}
        isRanked={ctx.isRanked}
      />
    </AuthGuard>
  );
}
