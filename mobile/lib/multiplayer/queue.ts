/**
 * Public matchmaking — ``POST /api/room/queue/join`` + poll status.
 */

import API from "@/lib/api";
import type { BoardMode } from "@/lib/game/boardConfig";
import type { PlayerSlot, Room, RoomFormat } from "@/lib/multiplayer/types";

export class QueueError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "QueueError";
    this.status = status;
  }
}

export interface QueueJoinResult {
  matched: boolean;
  room_code: string;
  player_slot: PlayerSlot;
  room?: Room;
}

export async function joinQueue(
  format: RoomFormat,
  boardMode: BoardMode | "5x5_6x6_7x7",
): Promise<QueueJoinResult> {
  try {
    const res = await API.post<{
      matched: boolean;
      room_code: string;
      player_slot: PlayerSlot;
      room?: Room;
    }>("/api/room/queue/join", {
      format,
      board_mode: boardMode,
    }, { timeout: 60_000 });
    return res.data;
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: { detail?: string } } };
    const detail = ax.response?.data?.detail;
    throw new QueueError(
      typeof detail === "string" ? detail : "Could not join queue.",
      ax.response?.status,
    );
  }
}

export async function leaveQueue(
  format: RoomFormat,
  boardMode: BoardMode | "5x5_6x6_7x7",
  roomCode?: string,
): Promise<void> {
  await API.post("/api/room/queue/leave", {
    format,
    board_mode: boardMode,
    ...(roomCode ? { room_code: roomCode } : {}),
  });
}

export async function pollQueueStatus(roomCode: string): Promise<Room> {
  const res = await API.get<Room>(`/api/room/queue/status/${roomCode}`);
  return res.data;
}

export function isQueueMatched(room: Room, mySlot: PlayerSlot): boolean {
  if (room.status !== "active") return false;
  return mySlot === "P1" ? !!room.player2_id : !!room.player1_id;
}
