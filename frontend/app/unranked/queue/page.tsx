"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import LobbyScreen from "@/components/LobbyScreen";

/**
 * /unranked/queue — user is actively searching for an unranked match.
 * If queue state is lost (e.g. direct URL hit / reload), bounce back to /play/lobby.
 */
export default function UnrankedQueuePage() {
  const ctx = useApp();
  const router = useRouter();

  useEffect(() => {
    if (ctx.queuePhase === "none") router.replace("/play/lobby");
  }, [ctx.queuePhase, router]);

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
        forcedPhase="queuing"
        boardMode={ctx.boardMode}
        onBoardModeAction={ctx.setBoardMode}
        isRanked={ctx.isRanked}
      />
    </AuthGuard>
  );
}
