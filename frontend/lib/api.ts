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

  // Production browser path: always use same-origin `/api/*` and rely on
  // Next rewrites/proxy to forward to the backend origin. This keeps auth
  // cookies first-party on iOS/WebKit where cross-site cookie delivery is
  // aggressively restricted and caused login -> immediate 401 on /profile/me.
  if (typeof window !== "undefined") return "";
  if (envUrl) return envUrl;
  return "http://localhost:8000";
}

/** Convert the API base URL into a WebSocket base URL (http:// → ws://, https:// → wss://). */
export function getWsBaseUrl(): string {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  // Keep WebSocket on backend origin when configured. WS auth uses short-lived
  // tickets, so we do not depend on browser cookies at upgrade-time.
  if (envUrl) {
    if (envUrl.startsWith("https://")) return envUrl.replace("https://", "wss://");
    if (envUrl.startsWith("http://")) return envUrl.replace("http://", "ws://");
  }
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

// ── Session cookie migration (Phase 3 / review F-03) ─────────────────────────
// `withCredentials: true` tells the browser to attach the HttpOnly
// ``pp_token`` cookie on every request, including cross-origin ones
// against the Railway backend. Without it the cookie would be stripped
// and requests would come back 401.
//
// We also drop the legacy request interceptor that read ``pp_token``
// from localStorage and attached it as ``Authorization: Bearer …``.
// The JWT no longer lives in localStorage — the HttpOnly cookie is the
// sole source of truth for authentication, and passing a Bearer header
// would re-expose the token to any script that wrapped `fetch` / read
// axios config.
const API = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
    const cfg = (error?.config ?? {}) as any;
    const reqUrl: string = String(cfg?.url ?? "");
    const canRetryToEnv =
      typeof window !== "undefined" &&
      !!envUrl &&
      envUrl.startsWith("http") &&
      !cfg?._retryToEnvApi &&
      API.defaults.baseURL === "" &&
      reqUrl.startsWith("/api/");

    // Production safety net: if same-origin /api rewrites are missing/misconfigured
    // on a deploy, retry once against NEXT_PUBLIC_API_URL so auth does not hard-fail.
    if (canRetryToEnv) {
      const status = error?.response?.status;
      const isLikelyRouteMiss = status === 404 || status === 405;
      const isNetworkish =
        !error?.response &&
        (error?.code === "ERR_NETWORK" ||
          error?.code === "ECONNABORTED" ||
          /network|fetch|timeout/i.test(String(error?.message ?? "")));
      if (isLikelyRouteMiss || isNetworkish) {
        cfg._retryToEnvApi = true;
        cfg.baseURL = envUrl;
        try {
          return await API.request(cfg);
        } catch (retryErr) {
          return Promise.reject(retryErr);
        }
      }
    }

    if (error.response?.status === 401) {
      // The HttpOnly cookie is cleared server-side (/auth/logout) or
      // has simply expired. Clear the readable presence hint plus any
      // non-secret cached profile so the next render bounces the user
      // to /auth without flashing protected content.
      localStorage.removeItem("pp_user");
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