/**
 * Store catalog — prices mirror ``backend/app/routers/store.py``.
 */

export interface StoreItem {
  id: string;
  label: string;
  description: string;
  pricePc: number;
  pricePs: number;
  category: "theme" | "banner" | "grid" | "piece" | "bundle";
}

export const STORE_THEMES: StoreItem[] = [
  {
    id: "theme_space",
    label: "Space Theme",
    description: "Space board + ranked OST pack",
    pricePc: 2099,
    pricePs: 700,
    category: "theme",
  },
  {
    id: "theme_pixel",
    label: "Pixel Theme",
    description: "Pixel board + ranked OST pack",
    pricePc: 2099,
    pricePs: 700,
    category: "theme",
  },
];

export const STORE_BANNERS: StoreItem[] = [
  { id: "void_rift", label: "Void Rift", description: "Profile banner", pricePc: 299, pricePs: 0, category: "banner" },
  { id: "blood_moon", label: "Blood Moon", description: "Profile banner", pricePc: 299, pricePs: 0, category: "banner" },
  { id: "inferno", label: "Inferno", description: "Profile banner", pricePc: 299, pricePs: 0, category: "banner" },
  { id: "starfield", label: "Starfield", description: "Profile banner", pricePc: 299, pricePs: 0, category: "banner" },
];

export const STORE_GRIDS: StoreItem[] = [
  { id: "red_grid", label: "Inferno Grid", description: "5×5 board skin", pricePc: 1599, pricePs: 0, category: "grid" },
  { id: "ice_grid", label: "Ice Grid", description: "5×5 board skin", pricePc: 1599, pricePs: 0, category: "grid" },
  { id: "glacier_grid", label: "Glacier Grid", description: "5×5 board skin", pricePc: 1599, pricePs: 0, category: "grid" },
  { id: "space_grid", label: "Space Grid", description: "Premium grid", pricePc: 900, pricePs: 300, category: "grid" },
  { id: "pixel_grid", label: "Pixel Grid", description: "Premium grid", pricePc: 900, pricePs: 300, category: "grid" },
];

export const STORE_PIECES: StoreItem[] = [
  { id: "piece_flame_skull", label: "Flame & Skull", description: "Piece skin", pricePc: 599, pricePs: 0, category: "piece" },
  { id: "piece_snowflake_shard", label: "Snow & Shard", description: "Piece skin", pricePc: 599, pricePs: 0, category: "piece" },
];

export const PC_PACKAGES = [
  { id: "starter", credits: 100, priceInr: 49, bonus: 0, label: "STARTER" },
  { id: "plus", credits: 500, priceInr: 199, bonus: 50, label: "PLUS" },
  { id: "pro", credits: 1000, priceInr: 349, bonus: 150, label: "PRO" },
  { id: "mega", credits: 2000, priceInr: 599, bonus: 400, label: "MEGA" },
] as const;
