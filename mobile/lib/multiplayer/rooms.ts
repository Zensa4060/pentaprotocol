/**
 * Multiplayer room service — REST half of the protocol.
 *
 * The WebSocket half lives in ``./ws.ts``. We keep them separate
 * because the REST calls happen at lobby/setup time (low frequency,
 * easy to await) while the WS lifecycle is its own state machine.
 *
 * All endpoints return the normalized ``Room`` shape so the lobby
 * + match screens can read fields without a per-endpoint adapter.
 *
 * Mobile v1 only creates single-leg 7×7 unranked rooms. The server
 * supports many board modes and ranked / private formats; we just
 * don't expose UI for them yet.
 */

import { isAxiosError } from "axios";

import API from "@/lib/api";

import type { ActiveRoomCheck, Room } from "./types";

export class RoomError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "RoomError";
    this.status = status;
    this.detail = detail;
  }
}

function toRoomError(err: unknown, fallback: string): RoomError {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return new RoomError(
      typeof detail === "string" ? detail : fallback,
      status,
      typeof detail === "string" ? detail : undefined,
    );
  }
  if (err instanceof Error) return new RoomError(err.message);
  return new RoomError(fallback);
}

/**
 * Create a new room. Always 7×7 / unranked for mobile v1.
 * Returns the room (with ``player_slot`` populated). The caller
 * should immediately navigate to the waiting / match screen and
 * open the WS — the room exists in "waiting" status until P2
 * joins via ``joinRoom``.
 */
export async function createRoom(): Promise<Room> {
  try {
    const res = await API.post<Room>("/api/room/create", {
      format: "unranked",
      board_mode: "7x7",
    });
    return res.data;
  } catch (err) {
    throw toRoomError(err, "Could not create a room.");
  }
}

/** Join an existing room by its 4-char code. */
export async function joinRoom(roomCode: string): Promise<Room> {
  try {
    const res = await API.post<Room>("/api/room/join", {
      room_code: roomCode.toUpperCase().trim(),
    });
    return res.data;
  } catch (err) {
    throw toRoomError(err, "Could not join the room.");
  }
}

/**
 * Check whether the user already has an in-progress room — used by
 * the lobby to surface a "Rejoin your active match" banner. Returns
 * ``{ room_code: null }`` shape when nothing's active.
 */
export async function getActiveRoom(): Promise<ActiveRoomCheck> {
  try {
    const res = await API.get<ActiveRoomCheck>("/api/room/active/check");
    return res.data;
  } catch (err) {
    throw toRoomError(err, "Could not check for an active room.");
  }
}

/**
 * Fetch the latest room state (without WS). Used as a fallback on
 * cold-start of the match screen and after the WS reconnects, so
 * we can paint the board immediately rather than waiting for the
 * first ``room_state`` frame.
 */
export async function fetchRoom(roomCode: string): Promise<Room> {
  try {
    const res = await API.get<Room>(`/api/room/${roomCode.toUpperCase()}`);
    return res.data;
  } catch (err) {
    throw toRoomError(err, "Could not fetch room.");
  }
}

/**
 * Forfeit the current match. Server marks it finished and credits
 * the opponent. Different from ``quit_match`` over WS — the REST
 * forfeit is a hard out-of-band exit (e.g. on app cold-launch when
 * the user wants to abandon a stale match without reconnecting).
 */
export async function forfeitMatch(roomCode: string): Promise<void> {
  try {
    await API.post("/api/room/forfeit", { room_code: roomCode });
  } catch (err) {
    throw toRoomError(err, "Could not forfeit.");
  }
}
