/**
 * Board grid skins — the ``board_style`` cosmetic equipped from the
 * Collection (store grid bundles). Applied as color overrides on top of
 * the active theme palette in ``BoardGrid``.
 */

export interface BoardSkin {
  id: string;
  /** Board frame background. */
  boardBg: string;
  /** Frame border / grid line color. */
  boardLine: string;
  /** Empty cell fill. */
  cellBg: string;
  /** Cell border. */
  cellBorder: string;
  /** Accent used for last-move ring / coordinate labels. */
  accent: string;
  /** Bundle piece skin: per-player stone colors + glow. */
  p1Color: string;
  p2Color: string;
  pieceGlow: string;
  /** Animated atmosphere overlay tints (slow-breathing wash on the board). */
  atmosphereInner: string;
  atmosphereOuter: string;
}

const SKINS: Record<string, BoardSkin> = {
  // Glacier Bundle — aurora-lit arctic grid + glacier shard pieces.
  glacier_grid: {
    id: "glacier_grid",
    boardBg: "#04101E",
    boardLine: "rgba(125,211,252,0.45)",
    cellBg: "#081A2E",
    cellBorder: "rgba(125,211,252,0.28)",
    accent: "#7DD3FC",
    p1Color: "#E0F2FE",
    p2Color: "#38BDF8",
    pieceGlow: "rgba(125,211,252,0.85)",
    atmosphereInner: "rgba(56,189,248,0.16)",
    atmosphereOuter: "rgba(167,139,250,0.10)",
  },
  // Bloodmoon Bundle — ritual crimson & violet omen + sigil pieces.
  bloodmoon_grid: {
    id: "bloodmoon_grid",
    boardBg: "#170404",
    boardLine: "rgba(220,38,38,0.5)",
    cellBg: "#220707",
    cellBorder: "rgba(220,38,38,0.3)",
    accent: "#F87171",
    p1Color: "#FCA5A5",
    p2Color: "#C4B5FD",
    pieceGlow: "rgba(220,38,38,0.85)",
    atmosphereInner: "rgba(220,38,38,0.16)",
    atmosphereOuter: "rgba(139,92,246,0.10)",
  },
};

/** Skin for an equipped ``board_style`` — null for default/unknown ids. */
export function boardSkinFor(boardStyle: string | null | undefined): BoardSkin | null {
  if (!boardStyle || boardStyle === "default") return null;
  return SKINS[boardStyle] ?? null;
}
