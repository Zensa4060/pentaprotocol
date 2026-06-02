/**
 * Direct messages — ``GET/POST /api/friends/messages*`` plus the DM
 * notify WebSocket ``/api/friends/ws/dm``.
 *
 * The WS is receive-only on the client (server pushes ``dm_message``
 * frames and answers ``ping`` with ``pong``); messages are *sent* over
 * the POST endpoint. We authenticate the socket with the legacy
 * ``?token=<jwt>`` query param (the server's ``_ws_auth`` accepts it).
 */

import API, { getWsBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/secureStore";
import { ApiError } from "@/lib/profile";
import type { DirectMessage } from "@/lib/types";
import { isAxiosError } from "axios";

function wrap(err: unknown, fallback: string): ApiError {
  if (isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return new ApiError(typeof detail === "string" ? detail : fallback, err.response?.status, detail);
  }
  return new ApiError(fallback);
}

export async function listMessages(targetId: string): Promise<DirectMessage[]> {
  try {
    const res = await API.get<{ messages: DirectMessage[] }>(`/api/friends/messages/${targetId}`);
    return res.data.messages ?? [];
  } catch (err) {
    throw wrap(err, "Could not load messages.");
  }
}

export async function sendMessage(targetId: string, text: string): Promise<void> {
  try {
    await API.post("/api/friends/messages", { to_user: targetId, text });
  } catch (err) {
    throw wrap(err, "Could not send message.");
  }
}

export interface DmSocket {
  close: () => void;
}

/**
 * Open the DM notify socket. ``onMessage`` fires for every inbound
 * ``dm_message`` frame (both directions are broadcast). Best-effort:
 * if the token is missing or the socket drops, the caller still has
 * the POST/GET path and a re-open on next mount.
 */
export async function openDmSocket(onMessage: (m: DirectMessage) => void): Promise<DmSocket> {
  const token = await getToken();
  const url = `${getWsBaseUrl()}/api/friends/ws/dm${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  let ws: WebSocket | null = new WebSocket(url);
  let ping: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  ws.onopen = () => {
    ping = setInterval(() => {
      try {
        ws?.send("ping");
      } catch {
        /* ignore */
      }
    }, 25_000);
  };
  ws.onmessage = (ev: WebSocketMessageEvent) => {
    const raw = typeof ev.data === "string" ? ev.data : "";
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { type?: string; message?: DirectMessage };
      if (parsed.type === "dm_message" && parsed.message) onMessage(parsed.message);
    } catch {
      /* ignore non-JSON (e.g. pong) */
    }
  };

  return {
    close: () => {
      if (closed) return;
      closed = true;
      if (ping) clearInterval(ping);
      try {
        ws?.close(1000, "client closed");
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}
