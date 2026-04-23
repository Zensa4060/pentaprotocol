"use client";
import { create } from "zustand";
import API from "./api";
import { noteProfileProgressAfterMerge } from "./navBadgeState";

// ── HttpOnly session migration (Phase 3 / security review F-03) ─────────────
// Prior to this migration the JWT lived in ``localStorage["pp_token"]`` —
// reachable by any script in the origin, and therefore a one-XSS-primitive
// away from a full account takeover. The JWT now lives exclusively in the
// ``pp_token`` HttpOnly + Secure + SameSite=Lax cookie set by the backend
// (see backend/app/core/session_cookies.py). Because this file can no
// longer *read* the token, the Zustand "token" field has changed meaning:
// it is now a non-secret sentinel — either ``null`` (logged out) or the
// string ``"cookie"`` (logged in; real token lives in the HttpOnly cookie).
//
// All existing call sites that still pass ``Authorization: Bearer ${token}``
// end up sending ``Bearer cookie``, which the backend harmlessly ignores
// in favour of the real cookie (cookie-first auth dependency — see
// backend/app/core/auth_dep.get_current_user). Those manual headers will
// be cleaned up over time; leaving them in place does not weaken
// security because the backend never trusts them when the cookie is
// present.
//
// The non-HttpOnly ``pp_auth`` companion cookie still exists. It carries
// ONLY the session expiry timestamp (in ms) so the edge proxy and this
// module can decide synchronously — without a network roundtrip —
// whether a session is active. Forging it accomplishes nothing because
// the real JWT validation still runs on every backend call.

export const SESSION_SENTINEL = "cookie";

const AUTH_COOKIE_NAME = "pp_auth";

function readPresenceCookie(): number {
  if (typeof document === "undefined") return 0;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + AUTH_COOKIE_NAME + "=([^;]*)"),
  );
  if (!match) return 0;
  const raw = Number(decodeURIComponent(match[1]));
  return Number.isFinite(raw) ? raw : 0;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function hasActiveSession(): boolean {
  const expiry = readPresenceCookie();
  return expiry > 0 && expiry > Date.now();
}

// One-time cleanup of legacy localStorage entries written by the
// previous release line. Safe to call on every boot — it no-ops if
// the keys are already absent. We deliberately keep ``pp_user`` (the
// non-secret cached profile) because it's still read synchronously to
// render the UI before /auth/me resolves.
function cleanupLegacyLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_expiry");
    localStorage.removeItem("pp_persist");
    localStorage.removeItem("pp_device_token");
  } catch {
    // localStorage unavailable (SSR, privacy mode) — nothing to do.
  }
}

function saveUser(user: any) {
  try {
    localStorage.setItem("pp_user", JSON.stringify(user));
  } catch {
    // Quota / private mode — the user will simply be re-fetched on
    // next /auth/me call. Not a fatal error.
  }
}

function loadUser(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pp_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Device-token helpers retained so existing callers don't error on
// import; they are now no-ops because the raw token lives in the
// HttpOnly ``pp_device_token`` cookie set by the backend at 2FA login.
// They return ``null`` so any fallback logic treats the client as
// "no trusted device" — the backend checks the cookie independently.
export function saveDeviceToken(_token: string) {
  // Intentional no-op: backend writes the HttpOnly pp_device_token cookie.
}

export function loadDeviceToken(): string | null {
  return null;
}

export function clearDeviceToken() {
  // Kept for parity with the pre-migration API. The actual cookie is
  // cleared server-side on /auth/logout.
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface AuthStore {
  user:            any | null;
  token:           string | null;
  logoutReason:    string | null;
  setAuth:         (user: any, token?: string, persist?: boolean) => void;
  logout:          (reason?: string) => void;
  setLogoutReason: (reason: string | null) => void;
  updateUser:      (patch: Partial<any>) => void;
  refreshProfile:  () => Promise<void>;
  pendingLevelUp:  { from: number; to: number } | null;
  setPendingLevelUp: (val: { from: number; to: number } | null) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  cleanupLegacyLocalStorage();
  const active = hasActiveSession();
  const token = active ? SESSION_SENTINEL : null;
  const user = active ? loadUser() : null;

  return {
    user,
    token,
    logoutReason: null,
    pendingLevelUp: null,

    setPendingLevelUp: (val) => set({ pendingLevelUp: val }),

    // ``token`` param is ignored — retained only so existing callers
    // (AuthScreen, Google sign-in) compile without refactoring. The
    // backend has already set pp_token + pp_auth cookies before the
    // response reached the client.
    setAuth: (user, _token = SESSION_SENTINEL, _persist = false) => {
      saveUser(user);
      set({ user, token: SESSION_SENTINEL });
    },

    logout: (reason?: string) => {
      localStorage.removeItem("pp_user");
      localStorage.removeItem("pp_custom_theme");
      clearAuthCookie();
      // Fire-and-forget backend logout so the HttpOnly cookies get
      // cleared too. Any network failure here is non-fatal — the
      // cookies expire naturally after the JWT TTL (12h).
      try {
        API.post("/api/auth/logout").catch(() => {});
      } catch {
        // API may not be fully initialised in some edge cases (SSR);
        // ignore — cookies expire on their own.
      }
      set({ user: null, token: null, logoutReason: reason ?? null });
    },

    setLogoutReason: (reason) => set({ logoutReason: reason }),

    updateUser: (patch) => {
      const current = get().user;
      const mergeArray = (key: string) => {
        const patched  = patch[key];
        const existing = current?.[key];
        if (patched  === undefined) return existing ?? [];
        if (existing === undefined) return patched;
        return patched.length >= existing.length ? patched : existing;
      };

      const updated = {
        ...current,
        ...patch,
        purchased_items: mergeArray("purchased_items"),
      };

      const oldLevel = Number(current?.level ?? 1);
      const newLevel = Number(updated?.level ?? oldLevel);
      if (newLevel > oldLevel) {
        set({ pendingLevelUp: { from: oldLevel, to: newLevel } });
      }

      noteProfileProgressAfterMerge(current, updated);
      saveUser(updated);
      set({ user: updated });
    },

    refreshProfile: async () => {
      if (!get().token) return;
      try {
        const res = await API.get("/api/profile/me", { timeout: 15000 });
        get().updateUser(res.data);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail: string = err?.response?.data?.detail ?? "";
        if (status === 401 && detail.toLowerCase().includes("session replaced")) {
          get().logout("duplicate_session");
        } else if (status === 404 || status === 401) {
          get().logout("user_not_found");
        }
        // Network errors and 5xx: silently ignore (don't log out).
      }
    },
  };
});
