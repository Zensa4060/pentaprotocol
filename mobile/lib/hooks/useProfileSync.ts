/**
 * ``useProfileSync`` — refreshes the cached profile from the server.
 *
 * Mounted once, near the top of the auth-gated tree (currently in
 * ``app/_layout.tsx``). On every cold start, app foreground, or
 * authentication transition we ping ``GET /api/profile/me`` and
 * patch the zustand cache with the fresh data.
 *
 * Why we still need this even though login already returns a full
 * ``User``:
 *   - The cached profile in AsyncStorage can be days old if the
 *     user just opened the app — wins, ELO, shards, mission state
 *     all drift on the server while the app is closed.
 *   - Backend trust signals (``under_review``, ``ranked_ban_until``)
 *     change without the client doing anything; we want the UI to
 *     reflect them immediately.
 *
 * Edge cases:
 *   - A 401 means our cached token is dead (rotated, banned,
 *     deleted account). We force a logout so the next render
 *     redirects to login.
 *   - A network error is intentionally silent — the cached profile
 *     is still good enough to show the home tab.
 *   - We dedupe by ``loadingRef`` so AppState fluctuations don't
 *     fire 5 overlapping requests.
 */

import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import API from "@/lib/api";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import type { User } from "@/lib/types";

const PROFILE_PATH = "/api/profile/me";

export function useProfileSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setProfile = useAuthStore((s) => s.setProfile);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refresh = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const res = await API.get<User>(PROFILE_PATH);
        setProfile(res.data);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 401) {
          // Dead token. Force logout — the auth gate in
          // ``app/index.tsx`` redirects to login on the next tick.
          await logout();
          return;
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[useProfileSync] refresh failed", err);
        }
      } finally {
        loadingRef.current = false;
      }
    };

    // Refresh on mount.
    void refresh();

    // Refresh whenever the app comes back to the foreground.
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void refresh();
    });
    return () => {
      sub.remove();
    };
  }, [isAuthenticated, setProfile]);
}
