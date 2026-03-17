"use client";
import { create } from "zustand";

// ── Token expiry helpers ──────────────────────────────────────────────────────
const THIRTY_DAYS_MS  = 30  * 24 * 60 * 60 * 1000;
const SESSION_ONLY    = -1; // sentinel: clear on tab close

function saveToken(token: string, persist: boolean) {
  const expiry = persist
    ? Date.now() + THIRTY_DAYS_MS   // "stay signed in" = 30 days
    : Date.now() + THIRTY_DAYS_MS;  // even without checkbox = 30 days (requirement 3)
  localStorage.setItem("pp_token",  token);
  localStorage.setItem("pp_expiry", String(expiry));
  localStorage.setItem("pp_persist", persist ? "1" : "0");
}

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  const token  = localStorage.getItem("pp_token");
  const expiry = Number(localStorage.getItem("pp_expiry") || "0");
  if (!token) return null;
  if (expiry && Date.now() > expiry) {
    // Token expired — clear everything
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
  user:    any | null;
  token:   string | null;
  setAuth: (user: any, token: string, persist?: boolean) => void;
  logout:  () => void;
  updateUser: (patch: Partial<any>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:  loadUser(),
  token: loadToken(),

  setAuth: (user, token, persist = false) => {
    saveToken(token, persist);
    saveUser(user);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_expiry");
    localStorage.removeItem("pp_persist");
    localStorage.removeItem("pp_user");
    // Ensure signed-out sessions don't retain equipped cosmetics
    localStorage.removeItem("pp_custom_theme");
    // NOTE: intentionally keep pp_device_token so 2FA is skipped for 30 days
    set({ user: null, token: null });
  },

  updateUser: (patch) => {
    const updated = { ...get().user, ...patch };
    saveUser(updated);
    set({ user: updated });
  },
}));