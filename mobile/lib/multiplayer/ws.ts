/**
 * Multiplayer WebSocket client.
 *
 * Connects to the per-room endpoint
 * ``wss://<host>/api/room/ws/{room_code}/{slot}`` using a
 * short-lived ticket issued by ``POST /api/room/ws-ticket``.
 *
 * Design choices:
 *   - **Ticket-first, not token query-string.** The server still
 *     accepts ``?token=<jwt>`` for legacy callers, but tickets are
 *     the preferred path: they're single-use, short-lived, and
 *     don't leak the long-lived JWT into server logs. The mobile
 *     client only ever uses tickets.
 *   - **One reconnect with a fresh ticket.** If the socket drops,
 *     we try once to re-connect (issuing a brand-new ticket). If
 *     that fails the caller is told ``"disconnected"`` and the UI
 *     redirects to the lobby. We avoid the multi-step exponential
 *     reconnect dance because mobile match sessions are short and
 *     a hung silent reconnect would be worse than a clear "match
 *     interrupted" message.
 *   - **Envelope auto-fill.** Server validates a monotonic ``seq``
 *     and per-frame ``client_msg_id`` (replay guard). Screens just
 *     call ``send({ type, ... })`` and never have to think about
 *     either.
 *   - **Typed listener.** A single ``onMessage`` callback receives
 *     the parsed inbound frame; the parser is permissive — anything
 *     with a ``type`` field is forwarded so screens can switch on
 *     types that aren't in our union yet without a recompile.
 */

import API, { getWsBaseUrl } from "@/lib/api";

import type { InboundMessage, OutboundMessage, PlayerSlot } from "./types";

interface TicketResponse {
  ticket: string;
  expires_in: number;
}

/**
 * Request a single-use WS ticket for the given room + slot.
 * The server scopes the ticket to that pair so we can't reuse
 * one ticket to connect to a different room.
 */
async function fetchTicket(roomCode: string, slot: PlayerSlot): Promise<string> {
  const res = await API.post<TicketResponse>("/api/room/ws-ticket", {
    room_code: roomCode.toUpperCase(),
    slot,
  });
  return res.data.ticket;
}

export type WsConnectionStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "disconnected"
  | "rejected";

export interface MatchSocketOptions {
  roomCode: string;
  slot: PlayerSlot;
  onMessage: (msg: InboundMessage) => void;
  /**
   * Called any time the connection status changes. ``rejected`` is a
   * terminal failure (auth / closed by server with a 4xxx code);
   * ``disconnected`` is a normal close — caller should usually
   * route to the lobby on either.
   */
  onStatus?: (status: WsConnectionStatus, detail?: string) => void;
}

export interface MatchSocket {
  /** Current status. Updates flow through ``onStatus``. */
  status: () => WsConnectionStatus;
  /** Queue a typed frame for delivery. No-op if not yet ``open``. */
  send: (msg: OutboundMessage) => void;
  /** Close the socket. Idempotent. */
  close: () => void;
}

/**
 * Open and manage a single room WebSocket.
 *
 * Lifecycle:
 *   1. Construct → status ``connecting`` (ticket fetch + WS open).
 *   2. ``onopen`` → status ``open``.
 *   3. Inbound frames → ``onMessage(parsed)``.
 *   4. Outbound sends are buffered until the socket is open, then
 *      flushed in order.
 *   5. ``onclose`` (unexpected) → status ``reconnecting``, single
 *      retry; success returns to ``open``; failure → ``disconnected``.
 *   6. ``close()`` → status ``disconnected`` (no further callbacks).
 */
export function openMatchSocket(opts: MatchSocketOptions): MatchSocket {
  let socket: WebSocket | null = null;
  let status: WsConnectionStatus = "connecting";
  let disposed = false;
  let triedReconnect = false;
  let outboundSeq = 0;
  const outboundBuffer: OutboundMessage[] = [];

  const setStatus = (next: WsConnectionStatus, detail?: string) => {
    if (status === next) return;
    status = next;
    opts.onStatus?.(next, detail);
  };

  const flushBuffer = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (outboundBuffer.length > 0) {
      const next = outboundBuffer.shift()!;
      writeEnvelope(socket, next, ++outboundSeq);
    }
  };

  const connect = async () => {
    if (disposed) return;
    try {
      const ticket = await fetchTicket(opts.roomCode, opts.slot);
      if (disposed) return;
      const url = `${getWsBaseUrl()}/api/room/ws/${opts.roomCode.toUpperCase()}/${opts.slot}?ticket=${encodeURIComponent(
        ticket,
      )}`;
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        triedReconnect = false;
        setStatus("open");
        flushBuffer();
      };

      ws.onmessage = (ev: WebSocketMessageEvent) => {
        if (disposed) return;
        const raw = typeof ev.data === "string" ? ev.data : "";
        if (!raw) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn("[ws] dropping malformed frame", raw);
          }
          return;
        }
        if (!isInbound(parsed)) return;
        opts.onMessage(parsed);
      };

      ws.onerror = (ev) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[ws] error", ev);
        }
      };

      ws.onclose = (ev: WebSocketCloseEvent) => {
        if (disposed) return;
        socket = null;

        // Server-side rejections (auth, slot mismatch, etc.) come
        // back as 1008 (policy) or 4xxx (custom). Don't retry —
        // either the caller's slot/token is wrong or we've been
        // booted by a duplicate session.
        const code = typeof ev.code === "number" ? ev.code : 0;
        const reason = typeof ev.reason === "string" ? ev.reason : "";
        if (code === 1008 || (code >= 4000 && code <= 4999)) {
          setStatus("rejected", reason || `Closed (${code})`);
          return;
        }

        if (triedReconnect) {
          setStatus("disconnected", reason || "Connection lost");
          return;
        }
        triedReconnect = true;
        setStatus("reconnecting", reason);
        // Brief backoff — long enough for a transient network blip
        // to recover, short enough that a real player isn't staring
        // at a loading state.
        setTimeout(() => {
          if (disposed) return;
          connect().catch((err) => {
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.warn("[ws] reconnect failed", err);
            }
            setStatus("disconnected", "Reconnect failed");
          });
        }, 1200);
      };
    } catch (err) {
      if (disposed) return;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[ws] connect failed", err);
      }
      setStatus("disconnected", err instanceof Error ? err.message : "Connect failed");
    }
  };

  connect().catch(() => setStatus("disconnected", "Connect threw"));

  return {
    status: () => status,
    send: (msg) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        outboundBuffer.push(msg);
        return;
      }
      writeEnvelope(socket, msg, ++outboundSeq);
    },
    close: () => {
      if (disposed) return;
      disposed = true;
      const ws = socket;
      socket = null;
      if (ws) {
        try {
          ws.close(1000, "Client closed");
        } catch {
          // ignore — close() can throw on RN if the socket is mid-handshake
        }
      }
      setStatus("disconnected", "Client closed");
    },
  };
}

// ─── Envelope helpers ─────────────────────────────────────────────────────────

/**
 * Cheap unique id, 22 chars. Replaces a uuid dep — we just need
 * something unlikely to collide within a single connection's
 * replay window (32 frames). Base36 timestamp + base36 random
 * tail keeps it both short and readable in server logs.
 */
function clientMsgId(): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e10).toString(36);
  return `m-${t}-${r}`;
}

function writeEnvelope(ws: WebSocket, msg: OutboundMessage, seq: number): void {
  const envelope = {
    ...msg,
    seq,
    client_msg_id: clientMsgId(),
  };
  try {
    ws.send(JSON.stringify(envelope));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[ws] send failed", err);
    }
  }
}

function isInbound(raw: unknown): raw is InboundMessage {
  if (!raw || typeof raw !== "object") return false;
  const type = (raw as { type?: unknown }).type;
  return typeof type === "string" && type.length > 0;
}
