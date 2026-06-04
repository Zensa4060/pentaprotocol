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
import { loadSkinPreference, saveSkinPreference } from "@/lib/skinPreference";
import {
  BOARD_SKINS,
  PIECE_SKINS,
  DEFAULT_BOARD_SKIN,
  DEFAULT_PIECE_SKIN,
  bundleById,
} from "@/lib/cosmetics/skins";
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
  /** Equipped board + piece skin ids (cosmetic, on-device). */
  boardSkinId: string;
  pieceSkinId: string;
  /** Equip a board+piece bundle in one call (auto-pairs the piece). */
  equipBundle: (bundleId: string) => Promise<void>;
  /** True until the persisted preference has been read once. */
  ready: boolean;
}

/**
 * Final board render data = active theme palette with the equipped
 * board/piece skin merged on top. ``boardBgStops`` is non-null only
 * when a skin is equipped (the board then renders as a gradient).
 */
export interface BoardStyle extends ThemePalette {
  boardBgStops: readonly [string, string, ...string[]] | null;
  /** Skin glyphs are emoji ⇒ don't tint them. */
  pieceIsEmoji: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [boardSkinId, setBoardSkinId] = useState<string>(DEFAULT_BOARD_SKIN);
  const [pieceSkinId, setPieceSkinId] = useState<string>(DEFAULT_PIECE_SKIN);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Load theme + skin preferences together; gate ``ready`` on both.
    Promise.all([loadThemePreference(), loadSkinPreference()])
      .then(([id, skin]) => {
        if (cancelled) return;
        setThemeId(normalizeThemeId(id));
        if (BOARD_SKINS[skin.boardSkinId]) setBoardSkinId(skin.boardSkinId);
        if (PIECE_SKINS[skin.pieceSkinId]) setPieceSkinId(skin.pieceSkinId);
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

  const equipBundle = useCallback(async (bundleId: string) => {
    const bundle = bundleById(bundleId);
    if (!bundle) return;
    setBoardSkinId(bundle.boardId); // optimistic
    setPieceSkinId(bundle.pieceId);
    try {
      await saveSkinPreference({ boardSkinId: bundle.boardId, pieceSkinId: bundle.pieceId });
    } catch {
      /* best effort — the in-memory skin still applied */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, theme: THEMES[themeId], setTheme, boardSkinId, pieceSkinId, equipBundle, ready }),
    [themeId, setTheme, boardSkinId, pieceSkinId, equipBundle, ready],
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
      boardSkinId: DEFAULT_BOARD_SKIN,
      pieceSkinId: DEFAULT_PIECE_SKIN,
      equipBundle: async () => undefined,
      ready: true,
    };
  }
  return ctx;
}

/** Convenience — just the active palette. */
export function usePalette(): ThemePalette {
  return useTheme().theme;
}

/**
 * The merged board render data: active theme palette + equipped board /
 * piece skin. The board renderer (``components/game/BoardGrid``) consumes
 * this so equipping a grid reskins the board (gradient + glyphs) while a
 * ``default`` skin transparently falls back to the theme's flat board.
 */
export function useBoardStyle(): BoardStyle {
  const { theme, boardSkinId, pieceSkinId } = useTheme();
  const board = BOARD_SKINS[boardSkinId] ?? BOARD_SKINS.default;
  const piece = PIECE_SKINS[pieceSkinId] ?? PIECE_SKINS.default;

  return {
    ...theme,
    boardBgStops: board.bgStops,
    boardLine: board.line ?? theme.boardLine,
    boardCell: board.cell ?? theme.boardCell,
    accentHot: board.accent ?? theme.accentHot,
    glyphP1: piece.p1Glyph || theme.glyphP1,
    glyphP2: piece.p2Glyph || theme.glyphP2,
    p1: piece.p1 ?? theme.p1,
    p2: piece.p2 ?? theme.p2,
    pieceIsEmoji: !!piece.emoji,
  };
}
