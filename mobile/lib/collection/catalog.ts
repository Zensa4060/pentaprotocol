/**
 * Collection inventory definitions — ownership via ``purchased_items``.
 */

export type CollectionTab = "themes" | "grids" | "banners";

export interface CollectionEntry {
  id: string;
  label: string;
  description: string;
  tab: CollectionTab;
  /** Profile field to set when equipping. */
  equipField: "theme" | "board_style" | "banner";
  equipValue: string;
  owned: (items: string[]) => boolean;
}

const has = (items: string[], id: string) => items.includes(id);

export const COLLECTION_ENTRIES: CollectionEntry[] = [
  {
    id: "classic_dark",
    label: "Classic Dark",
    description: "Default dark theme",
    tab: "themes",
    equipField: "theme",
    equipValue: "classic_dark",
    owned: () => true,
  },
  {
    id: "classic_light",
    label: "Classic Light",
    description: "Light theme",
    tab: "themes",
    equipField: "theme",
    equipValue: "classic_light",
    owned: () => true,
  },
  {
    id: "theme_space",
    label: "Space",
    description: "Deep space UI",
    tab: "themes",
    equipField: "theme",
    equipValue: "space",
    owned: (i) => has(i, "theme_space"),
  },
  {
    id: "theme_pixel",
    label: "Pixel",
    description: "Retro pixel UI",
    tab: "themes",
    equipField: "theme",
    equipValue: "pixel",
    owned: (i) => has(i, "theme_pixel"),
  },
  {
    id: "default",
    label: "Standard Board",
    description: "Default grid",
    tab: "grids",
    equipField: "board_style",
    equipValue: "default",
    owned: () => true,
  },
  {
    id: "red_grid",
    label: "Inferno Grid",
    description: "Fire grid skin",
    tab: "grids",
    equipField: "board_style",
    equipValue: "red_grid",
    owned: (i) => has(i, "red_grid"),
  },
  {
    id: "ice_grid",
    label: "Ice Grid",
    description: "Frost grid skin",
    tab: "grids",
    equipField: "board_style",
    equipValue: "ice_grid",
    owned: (i) => has(i, "ice_grid"),
  },
  {
    id: "glacier_grid",
    label: "Glacier Grid",
    description: "Aurora ice lattice",
    tab: "grids",
    equipField: "board_style",
    equipValue: "glacier_grid",
    owned: (i) => has(i, "glacier_grid"),
  },
  {
    id: "default",
    label: "Default Banner",
    description: "Standard profile banner",
    tab: "banners",
    equipField: "banner",
    equipValue: "default",
    owned: () => true,
  },
  {
    id: "void_rift",
    label: "Void Rift",
    description: "Void banner",
    tab: "banners",
    equipField: "banner",
    equipValue: "void_rift",
    owned: (i) => has(i, "void_rift"),
  },
  {
    id: "blood_moon",
    label: "Blood Moon",
    description: "Crimson banner",
    tab: "banners",
    equipField: "banner",
    equipValue: "blood_moon",
    owned: (i) => has(i, "blood_moon"),
  },
  {
    id: "inferno",
    label: "Inferno",
    description: "Flame banner",
    tab: "banners",
    equipField: "banner",
    equipValue: "inferno",
    owned: (i) => has(i, "inferno"),
  },
];
