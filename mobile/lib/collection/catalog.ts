/**
 * Collection inventory — themes, banners, grids, coins, badges.
 */

import { PROFILE_TITLES } from "@/lib/collection/titles";
import { STORE_COINS, STORE_GRID_BUNDLES } from "@/lib/store/catalog";
import type { ThemeId } from "@/theme/themes";
import type { User } from "@/lib/types";

export type CollectionTab = "themes" | "banners" | "grids" | "coins" | "badges";

export interface CollectionEntry {
  id: string;
  label: string;
  description: string;
  tab: CollectionTab;
  /** Profile field / preference to set when equipping. */
  equipField: "theme" | "banner" | "board_style" | "title" | "coin";
  equipValue: string;
  owned: (items: string[], user?: User | null) => boolean;
  lockedHint?: string;
}

const has = (items: string[], id: string) => items.includes(id);

const GRID_ENTRIES: CollectionEntry[] = [
  {
    id: "grid_default",
    label: "Classic Grid",
    description: "Default board skin.",
    tab: "grids",
    equipField: "board_style",
    equipValue: "default",
    owned: () => true,
  },
  ...STORE_GRID_BUNDLES.map((b) => ({
    id: `grid_${b.id}`,
    label: b.label,
    description: b.description,
    tab: "grids" as const,
    equipField: "board_style" as const,
    equipValue: b.boardId,
    owned: (items: string[]) => has(items, b.boardId),
  })),
];

const COIN_ENTRIES: CollectionEntry[] = STORE_COINS.map((c) => ({
  id: `coin_${c.id}`,
  label: c.label,
  description: c.description + " (Rulebreaker toss on web; owned here syncs account-wide.)",
  tab: "coins" as const,
  equipField: "coin" as const,
  equipValue: c.id,
  owned: (items: string[]) => has(items, c.id),
}));

const BADGE_ENTRIES: CollectionEntry[] = PROFILE_TITLES.map((t) => ({
  id: `badge_${t.id}`,
  label: t.label,
  description: t.unlockDesc,
  tab: "badges" as const,
  equipField: "title" as const,
  equipValue: t.id,
  owned: (_items: string[], user?: User | null) => (user ? t.condition(user) : t.id === "newcomer"),
}));

// ── Themes ────────────────────────────────────────────────────────────────────
const THEME_ENTRIES: CollectionEntry[] = [
  {
    id: "classic_dark",
    label: "Classic Dark",
    description: "Default blood-red dark theme.",
    tab: "themes",
    equipField: "theme",
    equipValue: "classic_dark" satisfies ThemeId,
    owned: () => true,
  },
  {
    id: "classic_light",
    label: "Espresso",
    description: "Warm espresso & amber palette.",
    tab: "themes",
    equipField: "theme",
    equipValue: "classic_light" satisfies ThemeId,
    owned: () => true,
  },
  {
    id: "theme_space",
    label: "Space",
    description: "Deep navy with neon pieces.",
    tab: "themes",
    equipField: "theme",
    equipValue: "space" satisfies ThemeId,
    owned: (i) => has(i, "theme_space"),
  },
  {
    id: "theme_pixel",
    label: "Pixel",
    description: "Retro pixel forest palette.",
    tab: "themes",
    equipField: "theme",
    equipValue: "pixel" satisfies ThemeId,
    owned: (i) => has(i, "theme_pixel"),
  },
];

// ── Banners ───────────────────────────────────────────────────────────────────
// Banner id → display label. Ids mirror the web ``BANNERS_DATA`` keys so the
// equipped value renders identically through ``BannerRenderer``.
const BANNER_DEFS: { id: string; label: string; free?: boolean }[] = [
  { id: "default", label: "Default", free: true },
  { id: "digital_rain", label: "Digital Rain" },
  { id: "lightsaber_duel", label: "Lightsaber Duel" },
  { id: "arcade", label: "Arcade" },
  { id: "hyperdrive", label: "Hyperdrive" },
  { id: "northern_lights", label: "Northern Lights" },
  { id: "void_collapse", label: "Void Collapse" },
  { id: "lava_flow", label: "Lava Flow" },
  { id: "particle_web", label: "Particle Web" },
  { id: "ink_drop", label: "Ink Drop" },
  { id: "thunder_storm", label: "Thunder Storm" },
  { id: "neon_pulse", label: "Neon Pulse" },
  { id: "deep_sea", label: "Deep Sea" },
  { id: "prismatic_light", label: "Prismatic Light" },
  { id: "sand_dunes", label: "Sand Dunes" },
  { id: "ember_phoenix", label: "Ember Phoenix" },
  { id: "crystal_cave", label: "Crystal Cave" },
  { id: "hacker_terminal", label: "Hacker Terminal" },
  { id: "tidal_surge", label: "Tidal Surge" },
  { id: "solar_wind", label: "Solar Wind" },
  { id: "lava_lamp", label: "Lava Lamp" },
];

const BANNER_ENTRIES: CollectionEntry[] = BANNER_DEFS.map((b) => ({
  id: `banner_${b.id}`,
  label: b.label,
  description: "Profile & home banner.",
  tab: "banners" as const,
  equipField: "banner" as const,
  equipValue: b.id,
  owned: b.free ? () => true : (i: string[]) => has(i, b.id),
}));

export const COLLECTION_ENTRIES: CollectionEntry[] = [
  ...THEME_ENTRIES,
  ...BANNER_ENTRIES,
  ...GRID_ENTRIES,
  ...COIN_ENTRIES,
  ...BADGE_ENTRIES,
];
