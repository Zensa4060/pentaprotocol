/**
 * Store catalog — **themes + banners only** on mobile.
 *
 * Prices mirror ``backend/app/routers/store.py::_ITEM_PRICE_OVERRIDES``
 * (themes 2099 PC + 700 PS; animated banners 299 PC). Board skins /
 * grids / pieces are intentionally not sold on mobile.
 */

export interface StoreItem {
  id: string;
  label: string;
  description: string;
  pricePc: number;
  pricePs: number;
  category: "theme" | "banner";
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

export const PC_PACKAGES = [
  { id: "starter", credits: 100, priceInr: 49, bonus: 0, label: "STARTER" },
  { id: "plus", credits: 500, priceInr: 199, bonus: 50, label: "PLUS" },
  { id: "pro", credits: 1000, priceInr: 349, bonus: 150, label: "PRO" },
  { id: "mega", credits: 2000, priceInr: 599, bonus: 400, label: "MEGA" },
] as const;
