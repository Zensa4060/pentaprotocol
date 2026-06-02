/**
 * Collection inventory — **themes + banners only** on mobile.
 *
 * Board skins / grids / pieces are intentionally out of scope on mobile
 * (per the bug-fix plan). Ownership is derived from ``purchased_items``;
 * themes map to mobile ``ThemeId``s and banners to ``user.banner`` ids
 * (which mirror the web ``BANNERS_DATA`` / backend ``VALID_BANNERS``).
 */

import type { ThemeId } from "@/theme/themes";

export type CollectionTab = "themes" | "banners";

export interface CollectionEntry {
  id: string;
  label: string;
  description: string;
  tab: CollectionTab;
  /** Profile field / preference to set when equipping. */
  equipField: "theme" | "banner";
  /** Theme: a ThemeId. Banner: a banner id. */
  equipValue: string;
  owned: (items: string[]) => boolean;
}

const has = (items: string[], id: string) => items.includes(id);

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

export const COLLECTION_ENTRIES: CollectionEntry[] = [...THEME_ENTRIES, ...BANNER_ENTRIES];
