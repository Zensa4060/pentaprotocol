/**
 * Board grid skins — the ``board_style`` cosmetic equipped from the
 * Collection (store grid bundles). Applied in ``BoardGrid``.
 *
 * Currently ONLY ``glacier_grid`` is implemented (rendered 1:1 from the web
 * via a WebView canvas + SVG pieces). Every other ``board_style`` resolves to
 * ``null`` here, so those boards fall back to the plain theme board — i.e. all
 * other grid skins are intentionally removed from the game for now. The
 * remaining 13 get re-added here as each is ported.
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
  /** Bundle piece glyphs — REPLACE the theme glyphs (e.g. glacier shards). */
  p1Glyph: string;
  p2Glyph: string;
  /** Animated atmosphere overlay tints (slow-breathing wash on the board). */
  atmosphereInner: string;
  atmosphereOuter: string;
}

const SKINS: Record<string, BoardSkin> = {
  // Glacier Bundle — aurora-lit arctic grid + glacier shard pieces. Rendered
  // via the verbatim web GlacierGrid canvas (WebView) + SVG snowflake/shard.
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
    p1Glyph: "❅",
    p2Glyph: "❖",
    atmosphereInner: "rgba(56,189,248,0.16)",
    atmosphereOuter: "rgba(167,139,250,0.10)",
  },
  // Matrix Bundle — falling code rain + glowing green grid, code-bracket &
  // binary-pill pieces. Rendered via the verbatim web MatrixGrid canvas.
  matrix_grid: {
    id: "matrix_grid",
    boardBg: "#000800",
    boardLine: "rgba(0,255,65,0.45)",
    cellBg: "#02160A",
    cellBorder: "rgba(0,255,65,0.22)",
    accent: "#00FF41",
    p1Color: "#00FF41",
    p2Color: "#4ADE80",
    pieceGlow: "rgba(0,255,65,0.85)",
    p1Glyph: "[ ]",
    p2Glyph: "01",
    atmosphereInner: "rgba(0,255,65,0.14)",
    atmosphereOuter: "rgba(0,200,40,0.08)",
  },
  // Inferno Bundle — molten-ember board + flame / skull pieces. Rendered via
  // the verbatim web RedGrid backdrop (embers + diagonal heat wash).
  red_grid: {
    id: "red_grid",
    boardBg: "#140300",
    boardLine: "rgba(255,50,0,0.30)",
    cellBg: "rgba(255,50,0,0.02)",
    cellBorder: "rgba(255,50,0,0.12)",
    accent: "#FF6633",
    p1Color: "#FF7722",
    p2Color: "#CC0000",
    pieceGlow: "rgba(255,90,0,0.85)",
    p1Glyph: "🔥",
    p2Glyph: "☠",
    atmosphereInner: "rgba(255,90,0,0.12)",
    atmosphereOuter: "rgba(204,0,0,0.08)",
  },
  // Synthwave Bundle — retro sunset, neon skyline + perspective grid, with
  // retro-sun / neon-palm pieces. Rendered via the verbatim web SynthwaveGrid.
  synthwave_grid: {
    id: "synthwave_grid",
    boardBg: "#1A004A",
    boardLine: "rgba(255,0,180,0.40)",
    cellBg: "rgba(40,0,60,0.30)",
    cellBorder: "rgba(255,0,180,0.18)",
    accent: "#FF00B4",
    p1Color: "#FF2DB4",
    p2Color: "#00DCFF",
    pieceGlow: "rgba(255,0,200,0.85)",
    p1Glyph: "◎",
    p2Glyph: "⩘",
    atmosphereInner: "rgba(255,0,180,0.14)",
    atmosphereOuter: "rgba(0,200,255,0.08)",
  },
};

/** Skin for an equipped ``board_style`` — null for default/unknown/removed ids. */
export function boardSkinFor(boardStyle: string | null | undefined): BoardSkin | null {
  if (!boardStyle || boardStyle === "default") return null;
  return SKINS[boardStyle] ?? null;
}
