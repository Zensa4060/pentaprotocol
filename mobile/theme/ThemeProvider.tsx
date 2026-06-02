/**
 * Theme context — holds the active theme palette and lets any screen
 * read it (``useTheme``) or change it (``setTheme``).
 *
 * The active theme id is persisted in AsyncStorage (``pp_theme_id``,
 * via ``lib/themePreference``) so it survives restarts. Equipping a
 * theme from the Collection screen calls ``setTheme`` which both
 * persists and updates this context — so the board, home, profile and
 * every other migrated surface re-render with the new palette
 * immediately (fixes BUG-10).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadThemePreference, saveThemePreference } from "@/lib/themePreference";
import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  THEMES,
  type ThemeId,
  type ThemePalette,
} from "./themes";

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemePalette;
  setTheme: (id: ThemeId) => Promise<void>;
  /** True until the persisted preference has been read once. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadThemePreference()
      .then((id) => {
        if (!cancelled) setThemeId(normalizeThemeId(id));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    const next = normalizeThemeId(id);
    setThemeId(next); // optimistic — UI updates instantly
    try {
      await saveThemePreference(next);
    } catch {
      /* best effort — the in-memory theme still applied */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, theme: THEMES[themeId], setTheme, ready }),
    [themeId, setTheme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Full theme context (palette + id + setter). */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Defensive fallback so a stray consumer outside the provider
    // still renders with the default palette instead of crashing.
    return {
      themeId: DEFAULT_THEME_ID,
      theme: THEMES[DEFAULT_THEME_ID],
      setTheme: async () => undefined,
      ready: true,
    };
  }
  return ctx;
}

/** Convenience — just the active palette. */
export function usePalette(): ThemePalette {
  return useTheme().theme;
}
