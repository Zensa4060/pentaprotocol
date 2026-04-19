import axios from "axios";

export function getApiBaseUrl(): string {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  const hostname = typeof window !== "undefined" ? window.location?.hostname : undefined;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  // Local dev should default to local backend even when a stale remote env URL is present.
  if (isLocalhost) {
    if (envUrl && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) return envUrl;
    return "http://localhost:8000";
  }

  if (envUrl) return envUrl;
  if (typeof window !== "undefined")
    return ""; // production: same origin (use rewrites/proxy so /api goes to backend)
  return "http://localhost:8000";
}

/** Convert the API base URL into a WebSocket base URL (http:// → ws://, https:// → wss://). */
export function getWsBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith("https://")) return base.replace("https://", "wss://");
  if (base.startsWith("http://")) return base.replace("http://", "ws://");
  // Empty (same-origin) → derive from window.location
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:8000";
}

const API = axios.create({
  baseURL: getApiBaseUrl(),
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("pp_token");
      localStorage.removeItem("pp_user");
      localStorage.removeItem("pp_expiry");
      // Clear the edge-gate presence cookie so the Next.js proxy
      // bounces the user to /auth on the next navigation instead of
      // rendering a protected route and getting another 401 in the
      // background.
      if (typeof document !== "undefined") {
        document.cookie = "pp_auth=; Path=/; Max-Age=0; SameSite=Lax";
      }
    }
    // Server-side policy gate: when any protected endpoint returns
    // 403 legal_required we flip the local policy-acceptance flag off
    // so the PolicyAcceptanceGate re-mounts on the next render. This
    // mirrors what a fresh login would do and keeps the client in sync
    // with a backend policy-version bump.
    if (error.response?.status === 403 && error.response?.data?.detail === "legal_required") {
      try {
        localStorage.removeItem("pp_legal_accept_v2");
      } catch {
        // localStorage unavailable (SSR, privacy-blocked) — ignore; the
        // next auth refresh will surface the gate anyway.
      }
    }
    return Promise.reject(error);
  }
);

// ── WebSocket ticket helpers (Phase 2.3) ────────────────────────────────────
// Every WS connection now goes through the short-lived, single-use
// ticket endpoint instead of putting the JWT in the connect URL. That
// keeps the token out of proxy logs, browser history, and any
// WS-URL-echoing debug surface. Expired / missing tickets are rejected
// server-side; the handler also runs a JWT-expiry watchdog to close
// the socket on its own even if the user never disconnects.

export async function fetchWsTicket(
  opts: { room_code?: string; slot?: "P1" | "P2" } = {},
): Promise<string> {
  const res = await API.post("/api/room/ws-ticket", {
    room_code: opts.room_code,
    slot: opts.slot,
  });
  const ticket = res?.data?.ticket;
  if (!ticket || typeof ticket !== "string") {
    throw new Error("ws_ticket_missing");
  }
  return ticket;
}

/**
 * Open a WebSocket to one of the backend handlers, authenticated via a
 * fresh single-use ticket. Returns the open (or connecting) socket —
 * the caller hooks onopen / onmessage / onclose as usual. If the
 * ticket fetch fails (e.g. 429 reconnect-throttled, 401 expired JWT,
 * 503 Redis out) this rejects instead of silently opening an unauthed
 * socket.
 */
export async function openWs(
  relativePath: string,
  opts: { room_code?: string; slot?: "P1" | "P2" } = {},
): Promise<WebSocket> {
  const ticket = await fetchWsTicket(opts);
  const base = getWsBaseUrl();
  const sep = relativePath.includes("?") ? "&" : "?";
  return new WebSocket(`${base}${relativePath}${sep}ticket=${encodeURIComponent(ticket)}`);
}

export default API;