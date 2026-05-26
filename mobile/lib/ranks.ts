/**
 * Rank ladder — aligned with web ``NavBar`` ``RANKS`` / ``getRank``.
 */

import type { ImageSourcePropType } from "react-native";

export interface RankDef {
  name: string;
  min: number;
  max: number;
  color: string;
  image?: ImageSourcePropType;
  scale?: number;
}

export const RANKS: RankDef[] = [
  { name: "UNRANKED", min: -1, max: -1, color: "#FF33FF" },
  {
    name: "ROOKIE",
    min: 0,
    max: 500,
    color: "#9CA3AF",
    image: require("../assets/ranks/novice.png"),
    scale: 1.3,
  },
  {
    name: "SKILLED",
    min: 500,
    max: 1000,
    color: "#60A5FA",
    image: require("../assets/ranks/advanced.png"),
    scale: 1.3,
  },
  {
    name: "ELITE",
    min: 1000,
    max: 1500,
    color: "#A78BFA",
    image: require("../assets/ranks/professional.png"),
    scale: 0.741,
  },
  {
    name: "MYTHIC",
    min: 1500,
    max: 2000,
    color: "#10B981",
    image: require("../assets/ranks/emerald.png"),
    scale: 1.495,
  },
  {
    name: "CRACKED",
    min: 2000,
    max: 2500,
    color: "#FF3333",
    image: require("../assets/ranks/master.png"),
  },
  {
    name: "CHRONICLE",
    min: 2500,
    max: 1_000_000,
    color: "#F59E0B",
    image: require("../assets/ranks/legend.png"),
  },
];

export function getRank(elo: number, isPlacement = false): RankDef {
  if (isPlacement) return RANKS.find((r) => r.name === "UNRANKED") ?? RANKS[0];
  return RANKS.find((r) => elo >= r.min && elo < r.max) ?? RANKS[0];
}
