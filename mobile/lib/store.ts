/**
 * Auth store — zustand + AsyncStorage persistence.
 *
 * Two-tier persistence on purpose:
 *   1. ``user`` + ``isAuthenticated`` flag live in AsyncStorage via
 *      zustand's ``persist`` middleware. This lets us hydrate the
 *      home tab instantly on cold start without waiting for the
 *      first ``/profile/me`` round-trip.
 *   2. The JWT itself does NOT live here. It's in ``expo-secure-store``
 *      (Keychain on iOS, EncryptedSharedPreferences on Android) and
 *      is read on every request by the axios interceptor in
 *      ``lib/api.ts``. Storing the JWT in AsyncStorage would defeat
 *      the entire point of moving to native — Android backups +
 *      jailbroken devices could exfiltrate it.
 *
 * The store exposes ``setUser`` + ``logout`` actions. ``setUser`` also
 * writes the JWT to SecureStore as a convenience so the auth screen
 * doesn't have to remember to call two APIs on a successful login.
 * ``logout`` clears both tiers.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { clearToken, setToken } from "./secureStore";
import type { User } from "./types";

/** "Stay signed in" window — mirrors the web's 30-day device token. */
const KEEP_SIGNED_IN_MS = 30 * 24 * 60 * 60 * 1000;

interface AuthState {
  /** Cached profile from the last successful login / /profile/me. */
  user: User | null;
  /**
   * Mirrors "is there a JWT in SecureStore" but stays in the
   * persisted bundle so screens can read it synchronously without
   * an async SecureStore call. We trust it for UI gating only;
   * actual API auth always goes through the bearer header (which
   * reads SecureStore fresh).
   */
  isAuthenticated: boolean;
  /** True only between app cold-start and first store hydration. */
  hydrated: boolean;

  /**
   * The user ticked "Stay signed in for 30 days" at login. When
   * false, the session is treated as session-only: it survives
   * backgrounding (the JS context stays alive) but is dropped on the
   * next cold start so the login screen reappears.
   */
  keepSignedIn: boolean;

  /**
   * Epoch-ms deadline for a "kept" session (30 days out), or null for
   * a session-only login. Past this, the persisted session is dropped
   * on cold start even if "stay signed in" was ticked.
   */
  sessionExpiresAt: number | null;

  /** Mark the persisted slice as loaded. Wired in below. */
  setHydrated: () => void;

  /**
   * Cold-start gate for the "stay signed in" choice. Runs once during
   * rehydration (before ``setHydrated``), so the very first render of
   * the auth gate already sees the correct state — no logged-in flash.
   * Drops the session when the user did not opt to stay signed in, or
   * when the 30-day window has lapsed.
   */
  applySessionPolicy: () => void;

  /**
   * Atomically set the JWT (SecureStore) + cached profile (this
   * store). Used by login / signup / Google / 2FA success paths.
   *
   * ``keepSignedIn`` records the login screen's checkbox: true keeps
   * the session for 30 days across cold starts; false (the default,
   * matching the web) makes it session-only.
   */
  setUser: (user: User, token: string, keepSignedIn?: boolean) => Promise<void>;

  /**
   * Replace the cached profile wholesale. Use after a fresh
   * ``/profile/me`` fetch where you have the authoritative
   * server-side shape and want to drop the local copy. Does NOT
   * touch the JWT — auth flag stays as-is.
   */
  setProfile: (user: User) => void;

  /** Shallow-merge a partial onto the cached profile. */
  patchUser: (patch: Partial<User>) => void;

  /** Pending level-up celebration (global overlay). */
  pendingLevelUp: { from: number; to: number } | null;
  setPendingLevelUp: (val: { from: number; to: number } | null) => void;

  /** Clear JWT + profile + auth flag. Safe to call from anywhere. */
  logout: () => Promise<void>;
}

function noteLevelUp(
  prev: User | null,
  next: User,
  set: (partial: Partial<AuthState>) => void,
): void {
  const oldLevel = Number(prev?.level ?? 1);
  const newLevel = Number(next.level ?? oldLevel);
  if (newLevel > oldLevel) {
    set({ pendingLevelUp: { from: oldLevel, to: newLevel } });
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,
      keepSignedIn: false,
      sessionExpiresAt: null,
      pendingLevelUp: null,

      setHydrated: () => set({ hydrated: true }),

      applySessionPolicy: () => {
        const { isAuthenticated, keepSignedIn, sessionExpiresAt } = get();
        if (!isAuthenticated) return;
        const lapsed = keepSignedIn
          ? sessionExpiresAt != null && Date.now() > sessionExpiresAt
          : true; // session-only login — never survives a cold start.
        if (lapsed) {
          // Clear the JWT too. Fire-and-forget: the flags below flip
          // synchronously, which is what the auth gate reads, and the
          // login screen issues no authed requests in the meantime.
          void clearToken();
          set({
            user: null,
            isAuthenticated: false,
            keepSignedIn: false,
            sessionExpiresAt: null,
            pendingLevelUp: null,
          });
        }
      },

      setPendingLevelUp: (val) => set({ pendingLevelUp: val }),

      setUser: async (user, token, keepSignedIn = false) => {
        await setToken(token);
        noteLevelUp(get().user, user, set);
        set({
          user,
          isAuthenticated: true,
          keepSignedIn,
          sessionExpiresAt: keepSignedIn ? Date.now() + KEEP_SIGNED_IN_MS : null,
        });
      },

      setProfile: (user) => {
        noteLevelUp(get().user, user, set);
        set({ user });
      },

      patchUser: (patch) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...patch };
        noteLevelUp(current, updated, set);
        set({ user: updated });
      },

      logout: async () => {
        await clearToken();
        set({
          user: null,
          isAuthenticated: false,
          keepSignedIn: false,
          sessionExpiresAt: null,
          pendingLevelUp: null,
        });
      },
    }),
    {
      name: "pp.auth",
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the non-secret slice. The JWT lives in
      // SecureStore; ``hydrated`` is a transient flag we recompute
      // on every launch.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        keepSignedIn: state.keepSignedIn,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
      migrate: (persisted, fromVersion) => {
        // v1 predates the "stay signed in" choice and always persisted
        // the session. Honour existing logins as "kept" so upgrading
        // doesn't force a surprise re-login; the new policy applies to
        // every login from here on.
        if (fromVersion < 2 && persisted && typeof persisted === "object") {
          const p = persisted as Record<string, unknown>;
          if (p.isAuthenticated) {
            p.keepSignedIn = true;
            p.sessionExpiresAt = Date.now() + KEEP_SIGNED_IN_MS;
          }
        }
        return persisted as never;
      },
      onRehydrateStorage: () => (state) => {
        // Enforce the stay-signed-in policy *before* unblocking render,
        // so the auth gate's first read is already correct.
        state?.applySessionPolicy();
        state?.setHydrated();
      },
      version: 2,
    },
  ),
);
