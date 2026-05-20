/**
 * Axios client for the PentaProtocol backend.
 *
 * Compared to the web ``frontend/lib/api.ts`` this client is
 * simpler because:
 *   1. There's no Next.js proxy / same-origin path to fall back to —
 *      the React Native app always talks directly to the public API
 *      origin from ``EXPO_PUBLIC_API_URL``.
 *   2. There's no HttpOnly cookie to rely on. We pull the JWT out
 *      of secure storage on every request and attach it as
 *      ``Authorization: Bearer <token>``. The backend already
 *      supports this auth shape (see
 *      ``backend/app/core/auth_dep.get_current_user`` — it checks
 *      the bearer header when the cookie isn't present, which is
 *      always the case here).
 *   3. There's no ITP / 3rd-party cookie quirk to work around: the
 *      native HTTP stack happily attaches headers cross-origin.
 *
 * Token refresh + auto-logout-on-401 are intentionally NOT in v1.
 * They land in Phase 1 once the auth screens are stable, so we
 * don't accidentally bounce the user out of the login screen
 * itself while they're still typing credentials.
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { getToken } from "./secureStore";

/**
 * Resolves the API base URL at *call time* (not module-load time)
 * so the user-configurable ``EXPO_PUBLIC_API_URL`` env var picks up
 * Expo's metro reload without a full app restart.
 *
 * Defaults to a sane localhost during dev; in production it's set
 * via ``eas.json`` / EAS env vars and the build embeds the value
 * at compile time.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  // Local dev fallback. Android emulators talk to the host machine
  // via 10.0.2.2; iOS simulators use localhost directly. We default
  // to localhost and tell the user (in README) to switch when they
  // run on an Android emulator.
  return "http://localhost:8000";
}

/** ``http:// → ws://`` / ``https:// → wss://`` for the WebSocket layer. */
export function getWsBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith("https://")) return base.replace("https://", "wss://");
  if (base.startsWith("http://")) return base.replace("http://", "ws://");
  return "ws://localhost:8000";
}

const API: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  // 15 s is generous for a mobile network. Most API calls finish
  // under 300 ms; the tail is dominated by handshake on cold
  // connections after the OS reaps the socket.
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Request interceptor — attach the bearer token if we have one.
 *
 * We resolve the token from SecureStore on each request rather than
 * caching it in module scope so:
 *   - Logout (which clears SecureStore) takes effect immediately
 *     for in-flight calls.
 *   - The auth gate can swap users without us having to remember to
 *     bust an in-memory cache.
 * The SecureStore read is a sub-millisecond JNI / ObjC call on
 * device, well under our budget per request.
 */
API.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Always rebase URL in case the env var changed between Metro
  // reloads (happens a lot during development).
  config.baseURL = getApiBaseUrl();
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor — surface a stable error shape to callers.
 *
 * We DON'T auto-logout on 401 here (see file header). All we do is
 * normalize the rejection into something a screen-level
 * ``try / catch`` can consume without spelunking through axios'
 * error tree on every screen.
 */
API.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[API]",
        error.config?.method?.toUpperCase(),
        error.config?.url,
        "→",
        error.response?.status ?? error.code ?? "no-status",
        error.response?.data?.detail ?? error.message,
      );
    }
    return Promise.reject(error);
  },
);

export default API;
