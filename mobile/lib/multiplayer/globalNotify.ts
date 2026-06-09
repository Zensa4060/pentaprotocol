/**
 * Global notify WebSocket — mirrors web ``AppShell`` ``/api/room/ws/global/notify``.
 *
 * The matchmaker's liveness check (``ws_manager.has_active_connections``) requires
 * an open authenticated socket before pairing queue opponents. Web keeps this
 * open for the whole session; mobile must do the same or queue joins race.
 */

import { AppState, type AppStateStatus } from "react-native";

import API, { getWsBaseUrl } from "@/lib/api";

const HEARTBEAT_MS = 20_000;

interface TicketResponse {
  ticket: string;
}

async function fetchGlobalTicket(): Promise<string> {
  const res = await API.post<TicketResponse>("/api/room/ws-ticket", {});
  return res.data.ticket;
}

export interface GlobalNotifySocket {
  close: () => void;
}

/** Hold open while authenticated — idempotent per app session. */
export function openGlobalNotifySocket(): GlobalNotifySocket {
  let socket: WebSocket | null = null;
  let disposed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const stopHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const connect = async () => {
    if (disposed) return;
    try {
      const ticket = await fetchGlobalTicket();
      if (disposed) return;
      const url = `${getWsBaseUrl()}/api/room/ws/global/notify?ticket=${encodeURIComponent(ticket)}`;
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        stopHeartbeat();
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          }
        }, HEARTBEAT_MS);
      };

      ws.onclose = () => {
        stopHeartbeat();
        socket = null;
        if (!disposed) {
          reconnectTimer = setTimeout(() => {
            void connect();
          }, 4000);
        }
      };

      ws.onerror = () => {
        /* onclose handles reconnect */
      };
    } catch {
      if (!disposed) {
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 8000);
      }
    }
  };

  void connect();

  const onAppState = (next: AppStateStatus) => {
    if (disposed || next !== "active") return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      void connect();
    }
  };
  const sub = AppState.addEventListener("change", onAppState);

  return {
    close: () => {
      disposed = true;
      stopHeartbeat();
      sub.remove();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close(1000, "Client closed");
      } catch {
        /* ignore */
      }
      socket = null;
    },
  };
}
