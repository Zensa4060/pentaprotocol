/**
 * Store catalog — **themes, banners + grids** on mobile.
 *
 * Prices mirror ``backend/app/routers/store.py::_canonical_item_price``
 * (themes 2099 PC + 700 PS; animated banners 299 PC; any ``*_grid``
 * 1599 PC, with ``space_grid`` / ``pixel_grid`` at 900 PC + 300 PS).
 * Grids are derived from ``SKIN_BUNDLES`` so the store id == the board's
 * ``*_grid`` id the backend already accepts (no backend changes).
 */

import { SKIN_BUNDLES } from "@/lib/cosmetics/skins";

export interface StoreItem {
  id: string;
  label: string;
  description: string;
  pricePc: number;
  pricePs: number;
  category: "theme" | "banner" | "grid";
}

export const STORE_THEMES: StoreItem[] = [
  {
    id: "theme_space",
    label: "Space Theme",
    description: "Deep-navy UI, neon pieces + ranked OST pack.",
    pricePc: 2099,
    pricePs: 700,
    category: "theme",
  },
  {
    id: "theme_pixel",
    label: "Pixel Theme",
    description: "Retro pixel forest UI + ranked OST pack.",
    pricePc: 2099,
    pricePs: 700,
    category: "theme",
  },
];

const banner = (id: string, label: string): StoreItem => ({
  id,
  label,
  description: "Animated profile & home banner.",
  pricePc: 299,
  pricePs: 0,
  category: "banner",
});

export const STORE_BANNERS: StoreItem[] = [
  banner("digital_rain", "Digital Rain"),
  banner("lightsaber_duel", "Lightsaber Duel"),
  banner("arcade", "Arcade"),
  banner("hyperdrive", "Hyperdrive"),
  banner("northern_lights", "Northern Lights"),
  banner("void_collapse", "Void Collapse"),
  banner("lava_flow", "Lava Flow"),
  banner("particle_web", "Particle Web"),
  banner("ink_drop", "Ink Drop"),
  banner("thunder_storm", "Thunder Storm"),
  banner("neon_pulse", "Neon Pulse"),
  banner("deep_sea", "Deep Sea"),
  banner("prismatic_light", "Prismatic Light"),
  banner("sand_dunes", "Sand Dunes"),
  banner("ember_phoenix", "Ember Phoenix"),
  banner("crystal_cave", "Crystal Cave"),
  banner("hacker_terminal", "Hacker Terminal"),
  banner("tidal_surge", "Tidal Surge"),
  banner("solar_wind", "Solar Wind"),
  banner("lava_lamp", "Lava Lamp"),
];

// ── Grids (board skins + matching pieces) ───────────────────────────────────
// id == the board's ``*_grid`` id (backend-priced); skips the free default.
export const STORE_GRIDS: StoreItem[] = SKIN_BUNDLES.filter((b) => !b.free).map((b) => ({
  id: b.boardId,
  label: `${b.label} Grid`,
  description: "Board skin + matching pieces.",
  pricePc: b.pricePc,
  pricePs: b.pricePs,
  category: "grid" as const,
}));

export const PC_PACKAGES = [
  { id: "starter", credits: 100, priceInr: 49, bonus: 0, label: "STARTER" },
  { id: "plus", credits: 500, priceInr: 199, bonus: 50, label: "PLUS" },
  { id: "pro", credits: 1000, priceInr: 349, bonus: 150, label: "PRO" },
  { id: "mega", credits: 2000, priceInr: 599, bonus: 400, label: "MEGA" },
] as const;
