// ── Custom Theme Types ────────────────────────────────────────────────────────

export type MusicPack = "classic" | "space" | "pixel";
export type SfxPack   = "classic" | "space" | "pixel";
export type BoardSkin =
  | "default" | "marble" | "forest" | "void" | "gold" | "ice"
  | "red_grid" | "ice_grid" | "glacier_grid" | "bloodmoon_grid" | "egypt_grid" | "synthwave_grid" | "matrix_grid" | "arcane_grid" | "bio_grid" | "forge_grid" | "void_grid" | "tokyo_grid" | "space_grid" | "pixel_grid";
export type CoinSkin   = "default" | "crystal" | "emerald" | "ruby" | "obsidian" | "legend";
export type TossAnim   = "default" | "slow_mo" | "lightning" | "galaxy" | "matrix" | "wraith_king";
export type PieceSkin =
  | "default" | "roman" | "rune" | "symbol" | "legend"
  | "flame_skull" | "snowflake_shard" | "glacier_shard" | "bloodmoon_sigils" | "egypt_sigils" | "synthwave_sigils" | "matrix_sigils" | "arcane_sigils" | "bio_sigils" | "forge_sigils" | "void_sigils" | "tokyo_sigils" | "space_sigils" | "pixel_sigils";
export type BgSource   = "classic_light" | "classic_dark" | "space" | "pixel";

// Keep SoundPack as alias for backward compat
export type SoundPack = SfxPack;

export interface CustomThemeConfig {
  musicPack:  MusicPack;
  sfxPack:    SfxPack;
  boardSkin:  BoardSkin;
  coinSkin:   CoinSkin;
  tossSkin:   TossAnim;
  pieceSkin:  PieceSkin;
  background: BgSource;
  bannerSkin: string;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  musicPack:  "classic",
  sfxPack:    "classic",
  boardSkin:  "default",
  coinSkin:   "default",
  tossSkin:   "default",
  pieceSkin:  "default",
  background: "classic_dark",
  bannerSkin: "default",
};

export const CUSTOM_THEME_STORAGE_KEY = "pp_custom_theme";

export function loadCustomTheme(): CustomThemeConfig {
  try {
    // Cosmetics must be account-specific.
    // If signed out, always fall back to defaults.
    const userRaw = localStorage.getItem("pp_user");
    if (!userRaw) return { ...DEFAULT_CUSTOM_THEME };
    const user = JSON.parse(userRaw);
    const userId = user?.id || user?._id;
    if (!userId) return { ...DEFAULT_CUSTOM_THEME };

    const userKey = `${CUSTOM_THEME_STORAGE_KEY}:${userId}`;

    // One-time migration from old global key -> per-user key
    const legacy = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (legacy && !localStorage.getItem(userKey)) {
      localStorage.setItem(userKey, legacy);
      localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
    }

    const raw = localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old soundPack key to sfxPack + musicPack
      if (parsed.soundPack && !parsed.sfxPack) {
        parsed.sfxPack   = parsed.soundPack;
        parsed.musicPack = parsed.soundPack;
        delete parsed.soundPack;
      }
      return { ...DEFAULT_CUSTOM_THEME, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_CUSTOM_THEME };
}

export function saveCustomTheme(cfg: CustomThemeConfig) {
  try {
    const userRaw = localStorage.getItem("pp_user");
    if (!userRaw) return; // signed out: don't persist cosmetics
    const user = JSON.parse(userRaw);
    const userId = user?.id || user?._id;
    if (!userId) return;
    const userKey = `${CUSTOM_THEME_STORAGE_KEY}:${userId}`;
    localStorage.setItem(userKey, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

const PIECE_SKIN_DATA: Record<string, { p1: string; p2: string }> = {
  default: { p1: "X",  p2: "Y"  },
  roman:   { p1: "I",  p2: "V"  },
  rune:    { p1: "R",  p2: "T"  },
  symbol:  { p1: "+",  p2: "*"  },
  legend:      { p1: "^",  p2: "@"  },
  flame_skull: { p1: "🔥", p2: "💀" },
};

const BOARD_SKIN_DATA: Record<string, { boardBg: string; boardLine: string; border: string }> = {
  default: { boardBg: "#111111", boardLine: "#2E2E2E", border: "#2E2E2E" },
  marble:  { boardBg: "#1a1616", boardLine: "#3a2828", border: "#4a3333" },
  forest:  { boardBg: "#0d1a0d", boardLine: "#243d18", border: "#2d4a1a" },
  void:    { boardBg: "#000000", boardLine: "#0d0020", border: "#1a0030" },
  gold:    { boardBg: "#1a1000", boardLine: "#2a1800", border: "#4a3300" },
  ice:     { boardBg: "#001a2a", boardLine: "#00263b", border: "#004466" },
  red_grid: { boardBg: "rgba(10,2,1,0.99)", boardLine: "rgba(140,20,0,0.35)", border: "rgba(140,20,0,0.35)" },
  ice_grid: { boardBg: "rgba(1,4,14,0.99)", boardLine: "rgba(80,160,220,0.28)", border: "rgba(80,160,220,0.28)" },
};

export function resolveCustomTheme(
  cfg: CustomThemeConfig,
  THEMES: Record<string, any>,
): Record<string, any> {
  const base = { ...THEMES[cfg.background] };

  const bd = BOARD_SKIN_DATA[cfg.boardSkin] ?? BOARD_SKIN_DATA.default;
  base.boardBg   = bd.boardBg;
  base.boardLine = bd.boardLine;
  base.border    = bd.border;

  const ps = PIECE_SKIN_DATA[cfg.pieceSkin] ?? PIECE_SKIN_DATA.default;
  base.pieces = { p1: ps.p1, p2: ps.p2 };

  // Store packs on the theme object so useAudio can read them
  base._musicPack = cfg.musicPack;
  base._sfxPack   = cfg.sfxPack;

  return base;
}