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
}

const SKINS: Record<string, BoardSkin> = {
  glacier_grid: {
    id: "glacier_grid",
    boardBg: "#04101E",
    boardLine: "rgba(125,211,252,0.45)",
    cellBg: "#081A2E",
    cellBorder: "rgba(125,211,252,0.28)",
    accent: "#7DD3FC",
  },
  bloodmoon_grid: {
    id: "bloodmoon_grid",
    boardBg: "#170404",
    boardLine: "rgba(220,38,38,0.5)",
    cellBg: "#220707",
    cellBorder: "rgba(220,38,38,0.3)",
    accent: "#F87171",
  },
};

/** Skin for an equipped ``board_style`` — null for default/unknown ids. */
export function boardSkinFor(boardStyle: string | null | undefined): BoardSkin | null {
  if (!boardStyle || boardStyle === "default") return null;
  return SKINS[boardStyle] ?? null;
}
