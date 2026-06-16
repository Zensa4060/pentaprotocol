/**
 * Store catalog — mirrors web Storescreen + backend price overrides.
 */

export interface StoreItem {
  id: string;
  label: string;
  description: string;
  pricePc: number;
  pricePs: number;
  category: "theme" | "banner" | "coin";
}

export interface GridBundle {
  id: string;
  label: string;
  description: string;
  boardId: string;
  pieceId: string;
  bundlePrice: number;
  accentColor: string;
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

export const STORE_COINS: StoreItem[] = [
  {
    id: "coin_bundle_wraith_king",
    label: "Wraith King Coin",
    description: "Rulebreaker toss — crowned skull & soul portal.",
    pricePc: 299,
    pricePs: 50,
    category: "coin",
  },

];

const grid = (
  id: string,
  label: string,
  desc: string,
  boardId: string,
  pieceId: string,
  accent: string,
): GridBundle => ({
  id,
  label,
  description: desc,
  boardId,
  pieceId,
  bundlePrice: 2198,
  accentColor: accent,
});

export const STORE_GRID_BUNDLES: GridBundle[] = [
  grid("bundle_fire", "Inferno Bundle", "Flame board + skull pieces.", "red_grid", "piece_flame_skull", "#FF3300"),
  grid("bundle_ice", "Ice Bundle", "Crystalline frost board + shards.", "ice_grid", "piece_snowflake_shard", "#50a0dc"),
  grid("bundle_glaciergrid", "Glacier Bundle", "Aurora-lit arctic grid.", "glacier_grid", "piece_glacier_shard", "#7DD3FC"),
  grid("bundle_bloodmoon", "Bloodmoon Bundle", "Ritual crimson & violet omen.", "bloodmoon_grid", "piece_bloodmoon_sigils", "#DC2626"),
  grid("bundle_egypt", "Egypt Bundle", "Golden dunes and hieroglyphs.", "egypt_grid", "piece_egypt_sigils", "#F59E0B"),
  grid("bundle_synthwave", "Synthwave Bundle", "Neon horizon retro pulse.", "synthwave_grid", "piece_synthwave_sigils", "#FF00B4"),
  grid("bundle_matrix", "Matrix Bundle", "Code rain and green pulse.", "matrix_grid", "piece_matrix_sigils", "#00FF41"),
  grid("bundle_arcane", "Arcane Bundle", "Runes, mist, magic circles.", "arcane_grid", "piece_arcane_sigils", "#A855F7"),
  grid("bundle_bio", "Bio Bundle", "Bioluminescent abyss glow.", "bio_grid", "piece_bio_sigils", "#00FFD0"),
  grid("bundle_forge", "Forge Bundle", "Molten veins and embers.", "forge_grid", "piece_forge_sigils", "#FF6600"),
  grid("bundle_void", "Void Bundle", "Nebulae and cosmic pulses.", "void_grid", "piece_void_sigils", "#8B5CF6"),
  grid("bundle_space", "Space Bundle", "Rockets and satellite signals.", "space_grid", "piece_space_sigils", "#00D9FF"),
  grid("bundle_pixel", "Pixel Bundle", "8-bit CRT dither glow.", "pixel_grid", "piece_pixel_sigils", "#FFDD00"),
  grid("bundle_tokyo", "Tokyo Bundle", "Neon rain and city glow.", "tokyo_grid", "piece_tokyo_sigils", "#FF0066"),
];

/**
 * Grid bundles whose verbatim web canvas + piece skin are fully ported and
 * verified — the ONLY grids surfaced in the Store and Collection. Every other
 * bundle in `STORE_GRID_BUNDLES` stays hidden until its board id is added here.
 * Widen this set one id at a time as each grid is ported in `boardSkin.ts` /
 * `webCanvas.ts`.
 */
export const LIVE_GRID_BOARD_IDS = new Set<string>([
  "glacier_grid",
  "red_grid",
  "synthwave_grid",
  "matrix_grid",
  "bloodmoon_grid",
  "egypt_grid",
  "arcane_grid",
  "bio_grid",
  "forge_grid",
  "void_grid",
  "space_grid",
  "pixel_grid",
  "tokyo_grid",
]);

/** True if a grid bundle's board skin is live (shown in Store / Collection). */
export const isGridLive = (boardId: string): boolean => LIVE_GRID_BOARD_IDS.has(boardId);

/** Live grid bundles only — what the Store and Collection actually display. */
export const LIVE_GRID_BUNDLES: GridBundle[] = STORE_GRID_BUNDLES.filter((b) => isGridLive(b.boardId));

export const PC_PACKAGES = [
  { id: "starter", credits: 100, priceInr: 49, bonus: 0, label: "STARTER" },
  { id: "plus", credits: 500, priceInr: 199, bonus: 50, label: "PLUS" },
  { id: "pro", credits: 1000, priceInr: 399, bonus: 150, label: "PRO" },
  { id: "mega", credits: 2000, priceInr: 599, bonus: 400, label: "MEGA" },
  { id: "elite", credits: 3000, priceInr: 799, bonus: 600, label: "ELITE" },
] as const;

export const PS_PACKAGES = PC_PACKAGES.map((p) => ({
  ...p,
  priceInr: Math.max(1, Math.floor(p.priceInr / 2)),
}));
