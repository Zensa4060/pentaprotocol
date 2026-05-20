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

  /** Mark the persisted slice as loaded. Wired in below. */
  setHydrated: () => void;

  /**
   * Atomically set the JWT (SecureStore) + cached profile (this
   * store). Used by login / signup / Google / 2FA success paths.
   */
  setUser: (user: User, token: string) => Promise<void>;

  /** Overwrite the cached profile only — e.g. after a /profile/me refresh. */
  patchUser: (patch: Partial<User>) => void;

  /** Clear JWT + profile + auth flag. Safe to call from anywhere. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      setUser: async (user, token) => {
        await setToken(token);
        set({ user, isAuthenticated: true });
      },

      patchUser: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },

      logout: async () => {
        await clearToken();
        set({ user: null, isAuthenticated: false });
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      version: 1,
    },
  ),
);
