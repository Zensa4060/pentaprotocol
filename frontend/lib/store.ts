"use client";
import { create } from "zustand";
import API from "./api";
import { noteProfileProgressAfterMerge } from "./navBadgeState";

// ── Token expiry helpers ──────────────────────────────────────────────────────
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function saveToken(token: string, persist: boolean) {
  const expiry = Date.now() + THIRTY_DAYS_MS;
  localStorage.setItem("pp_token",  token);
  localStorage.setItem("pp_expiry", String(expiry));
  localStorage.setItem("pp_persist", persist ? "1" : "0");
}

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  const token  = localStorage.getItem("pp_token");
  const expiry = Number(localStorage.getItem("pp_expiry") || "0");

  if (!token || token === "null" || token === "undefined") return null;

  if (expiry && Date.now() > expiry) {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_expiry");
    localStorage.removeItem("pp_persist");
    localStorage.removeItem("pp_user");
    return null;
  }
  return token;
}

function saveUser(user: any) {
  localStorage.setItem("pp_user", JSON.stringify(user));
}

export function saveDeviceToken(token: string) {
  localStorage.setItem("pp_device_token", token);
}

export function loadDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pp_device_token");
}

export function clearDeviceToken() {
  localStorage.removeItem("pp_device_token");
}

function loadUser(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pp_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface AuthStore {
  user:            any | null;
  token:           string | null;
  logoutReason:    string | null;
  setAuth:         (user: any, token: string, persist?: boolean) => void;
  logout:          (reason?: string) => void;
  setLogoutReason: (reason: string | null) => void;
  updateUser:      (patch: Partial<any>) => void;
  refreshProfile:  () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const token = loadToken();
  const user = token ? loadUser() : null;

  return {
    user,
    token,
    logoutReason: null,

    setAuth: (user, token, persist = false) => {
      saveToken(token, persist);
      saveUser(user);
      set({ user, token });
    },

    logout: (reason?: string) => {
      localStorage.removeItem("pp_token");
      localStorage.removeItem("pp_expiry");
      localStorage.removeItem("pp_persist");
      localStorage.removeItem("pp_user");
      localStorage.removeItem("pp_custom_theme");
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

      noteProfileProgressAfterMerge(current, updated);
      saveUser(updated);
      set({ user: updated });
    },

    refreshProfile: async () => {
      const token = get().token;
      if (!token) return;
      try {
        const res = await API.get("/api/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        get().updateUser(res.data);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail: string = err?.response?.data?.detail ?? "";
        // Detect single-session kick from the backend
        if (status === 401 && detail.toLowerCase().includes("session replaced")) {
          get().logout("duplicate_session");
        }
        // All other errors: silently ignore
      }
    },
  };
});