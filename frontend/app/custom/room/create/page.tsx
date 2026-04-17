"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import LobbyScreen from "@/components/LobbyScreen";

/**
 * /custom/room/create — creating or waiting in a custom multiplayer room.
 * Once the room has a 2nd player, handleRoomReady navigates straight to /game/g{n}/{id}.
 */
export default function CustomRoomCreatePage() {
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
        boardMode={ctx.boardMode}
        onBoardModeAction={ctx.setBoardMode}
        initialRoomSection="create"
      />
    </AuthGuard>
  );
}
