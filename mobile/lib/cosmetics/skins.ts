/**
 * Lightweight board (grid) + piece skins for mobile.
 *
 * These are **scaled-down ports** of the web's animated grid skins
 * (``frontend/components/*Grid.tsx``). On the web each grid is a
 * per-frame animated <canvas>; on a phone we keep only the skin's
 * *colour identity* — a 2–3 stop board-background gradient + a tinted
 * grid line + the paired piece glyphs/colours. No per-frame animation,
 * so the board stays buttery on low-end devices while still reading as
 * the same skin family as the web build.
 *
 * Ownership is gated on ``purchased_items`` using the board's ``*_grid``
 * id, which the backend already prices (``store.py::_canonical_item_price``
 * → any ``*_grid`` = 1599 PC; ``space_grid``/``pixel_grid`` = 900 PC + 300 PS).
 * Equipping a grid auto-pairs its piece skin (mirrors the web bundle), and
 * the choice persists on-device via ``lib/skinPreference`` — exactly like
 * the theme preference, so there are **zero backend changes**.
 */

/** A board skin = the board surface colour identity. */
export interface BoardSkin {
  id: string;
  label: string;
  /** ``null`` ⇒ use the active theme's flat board colour. Else a gradient. */
  bgStops: readonly [string, string, ...string[]] | null;
  /** Grid-line / cell-border colour. ``null`` ⇒ theme line. */
  line: string | null;
  /** Cell fill painted over the gradient (kept translucent so the bg shows). */
  cell: string | null;
  /** Skin accent (winning line, highlights). ``null`` ⇒ theme accent. */
  accent: string | null;
}

/** A piece skin = the two player glyphs + their colours. */
export interface PieceSkin {
  id: string;
  /** ``""`` ⇒ fall back to the active theme's glyph. */
  p1Glyph: string;
  p2Glyph: string;
  /** ``null`` ⇒ fall back to the theme's piece colour. */
  p1: string | null;
  p2: string | null;
  /** Emoji glyphs carry their own colour and must not be tinted. */
  emoji?: boolean;
}

/** A bundle pairs a board with its piece skin (one tap equips both). */
export interface SkinBundle {
  id: string;
  label: string;
  /** Board skin id — also the ``*_grid`` purchase id (except ``default``). */
  boardId: string;
  pieceId: string;
  /** Free ⇒ no purchase needed. Else gated on ``purchased_items`` containing boardId. */
  free?: boolean;
  /** Store price (PC, PS) — mirrors backend ``_canonical_item_price``. */
  pricePc: number;
  pricePs: number;
}

// ── Board skins (colour identity ported from web grids) ──────────────────────
export const BOARD_SKINS: Record<string, BoardSkin> = {
  default:        { id: "default",        label: "Standard",  bgStops: null,                               line: null,                      cell: null,                       accent: null },
  red_grid:       { id: "red_grid",       label: "Inferno",   bgStops: ["#0a0201", "#1a0503", "#070100"],  line: "rgba(140,20,0,0.42)",     cell: "rgba(255,80,0,0.05)",      accent: "#FF4400" },
  ice_grid:       { id: "ice_grid",       label: "Ice",       bgStops: ["#01040e", "#04122a", "#010512"],  line: "rgba(80,160,220,0.34)",   cell: "rgba(120,200,255,0.05)",   accent: "#7dd3fc" },
  glacier_grid:   { id: "glacier_grid",   label: "Glacier",   bgStops: ["#04101c", "#0a1f33", "#03101e"],  line: "rgba(125,211,252,0.32)",  cell: "rgba(165,243,252,0.05)",   accent: "#7dd3fc" },
  bloodmoon_grid: { id: "bloodmoon_grid", label: "Bloodmoon", bgStops: ["#0a0306", "#1c0407", "#070103"],  line: "rgba(220,38,38,0.38)",    cell: "rgba(220,38,38,0.06)",     accent: "#DC2626" },
  egypt_grid:     { id: "egypt_grid",     label: "Egypt",     bgStops: ["#1a1206", "#2a1d08", "#140d04"],  line: "rgba(251,191,36,0.32)",   cell: "rgba(251,191,36,0.06)",    accent: "#FBBF24" },
  synthwave_grid: { id: "synthwave_grid", label: "Synthwave", bgStops: ["#1a0633", "#2a0a40", "#10041f"],  line: "rgba(255,77,109,0.36)",   cell: "rgba(0,229,255,0.05)",     accent: "#FF4D6D" },
  matrix_grid:    { id: "matrix_grid",    label: "Matrix",    bgStops: ["#020a02", "#04140a", "#010601"],  line: "rgba(0,255,65,0.32)",     cell: "rgba(0,255,65,0.05)",      accent: "#00FF41" },
  arcane_grid:    { id: "arcane_grid",    label: "Arcane",    bgStops: ["#0a0518", "#160b2a", "#06030f"],  line: "rgba(192,132,252,0.34)",  cell: "rgba(192,132,252,0.06)",   accent: "#C084FC" },
  bio_grid:       { id: "bio_grid",       label: "Bio",       bgStops: ["#02100e", "#04201c", "#01100c"],  line: "rgba(0,255,208,0.32)",    cell: "rgba(0,255,208,0.05)",     accent: "#00FFD0" },
  forge_grid:     { id: "forge_grid",     label: "Forge",     bgStops: ["#140600", "#240a00", "#0e0400"],  line: "rgba(255,102,0,0.38)",    cell: "rgba(255,102,0,0.06)",     accent: "#FF6600" },
  void_grid:      { id: "void_grid",      label: "Void",      bgStops: ["#06030f", "#0e0820", "#04020a"],  line: "rgba(180,100,255,0.32)",  cell: "rgba(180,100,255,0.05)",   accent: "#B464FF" },
  tokyo_grid:     { id: "tokyo_grid",     label: "Tokyo",     bgStops: ["#0a0210", "#1a0418", "#06010a"],  line: "rgba(255,0,102,0.34)",    cell: "rgba(0,204,255,0.05)",     accent: "#FF0066" },
  space_grid:     { id: "space_grid",     label: "Space",     bgStops: ["#02040f", "#0a1228", "#010309"],  line: "rgba(0,221,255,0.30)",    cell: "rgba(0,221,255,0.05)",     accent: "#00DDFF" },
  pixel_grid:     { id: "pixel_grid",     label: "Pixel",     bgStops: ["#0e1209", "#1a2410", "#0a0e06"],  line: "rgba(255,221,0,0.30)",    cell: "rgba(255,221,0,0.05)",     accent: "#FFDD00" },
};

// ── Piece skins (glyph + colour identity ported from web) ────────────────────
// Tintable BMP symbols use the per-skin colours; emoji carry their own colour.
export const PIECE_SKINS: Record<string, PieceSkin> = {
  default:          { id: "default",          p1Glyph: "",   p2Glyph: "",   p1: null,      p2: null },
  flame_skull:      { id: "flame_skull",      p1Glyph: "🔥", p2Glyph: "💀", p1: null,      p2: null,      emoji: true },
  snowflake_shard:  { id: "snowflake_shard",  p1Glyph: "❄",  p2Glyph: "◆",  p1: "#C8EEFF", p2: "#64C8FF" },
  glacier_shard:    { id: "glacier_shard",    p1Glyph: "❆",  p2Glyph: "◈",  p1: "#A5F3FC", p2: "#93C5FD" },
  bloodmoon_sigils: { id: "bloodmoon_sigils", p1Glyph: "✠",  p2Glyph: "◉",  p1: "#DC2626", p2: "#7C3AED" },
  egypt_sigils:     { id: "egypt_sigils",     p1Glyph: "☥",  p2Glyph: "☀",  p1: "#FBBF24", p2: "#C084FC" },
  synthwave_sigils: { id: "synthwave_sigils", p1Glyph: "☀",  p2Glyph: "✦",  p1: "#FF4D6D", p2: "#00E5FF" },
  matrix_sigils:    { id: "matrix_sigils",    p1Glyph: "▦",  p2Glyph: "▨",  p1: "#00FF41", p2: "#4ADE80" },
  arcane_sigils:    { id: "arcane_sigils",    p1Glyph: "✴",  p2Glyph: "◈",  p1: "#C084FC", p2: "#FBBF24" },
  bio_sigils:       { id: "bio_sigils",       p1Glyph: "❀",  p2Glyph: "◉",  p1: "#00FFD0", p2: "#B464FF" },
  forge_sigils:     { id: "forge_sigils",     p1Glyph: "⚒",  p2Glyph: "⬢",  p1: "#FF6600", p2: "#FFCC00" },
  void_sigils:      { id: "void_sigils",      p1Glyph: "✷",  p2Glyph: "◎",  p1: "#B464FF", p2: "#40C0FF" },
  tokyo_sigils:     { id: "tokyo_sigils",     p1Glyph: "✶",  p2Glyph: "◆",  p1: "#FF0066", p2: "#00CCFF" },
  space_sigils:     { id: "space_sigils",     p1Glyph: "🚀", p2Glyph: "🛰", p1: null,      p2: null,      emoji: true },
  pixel_sigils:     { id: "pixel_sigils",     p1Glyph: "◉",  p2Glyph: "♥",  p1: "#FFDD00", p2: "#FF4455" },
};

// ── Bundles (board + piece, one-tap equip) — mirrors web BOARD_BUNDLES ────────
const GRID = (id: string, label: string, boardId: string, pieceId: string, pricePc = 1599, pricePs = 0): SkinBundle => ({
  id, label, boardId, pieceId, pricePc, pricePs,
});

export const SKIN_BUNDLES: SkinBundle[] = [
  { id: "default", label: "Classic", boardId: "default", pieceId: "default", free: true, pricePc: 0, pricePs: 0 },
  GRID("inferno",   "Inferno",   "red_grid",       "flame_skull"),
  GRID("ice",       "Ice",       "ice_grid",       "snowflake_shard"),
  GRID("glacier",   "Glacier",   "glacier_grid",   "glacier_shard"),
  GRID("bloodmoon", "Bloodmoon", "bloodmoon_grid", "bloodmoon_sigils"),
  GRID("egypt",     "Egypt",     "egypt_grid",     "egypt_sigils"),
  GRID("synthwave", "Synthwave", "synthwave_grid", "synthwave_sigils"),
  GRID("matrix",    "Matrix",    "matrix_grid",    "matrix_sigils"),
  GRID("arcane",    "Arcane",    "arcane_grid",    "arcane_sigils"),
  GRID("bio",       "Bio",       "bio_grid",       "bio_sigils"),
  GRID("forge",     "Forge",     "forge_grid",     "forge_sigils"),
  GRID("void",      "Void",      "void_grid",      "void_sigils"),
  GRID("tokyo",     "Tokyo",     "tokyo_grid",     "tokyo_sigils"),
  GRID("space",     "Space",     "space_grid",     "space_sigils", 900, 300),
  GRID("pixel",     "Pixel",     "pixel_grid",     "pixel_sigils", 900, 300),
];

export const DEFAULT_BOARD_SKIN = "default";
export const DEFAULT_PIECE_SKIN = "default";

const BUNDLE_BY_ID = new Map(SKIN_BUNDLES.map((b) => [b.id, b]));
const BUNDLE_BY_BOARD = new Map(SKIN_BUNDLES.map((b) => [b.boardId, b]));

export function bundleById(id: string): SkinBundle | undefined {
  return BUNDLE_BY_ID.get(id);
}

/** Piece id paired with a board (mirrors web auto-pairing). */
export function pairedPieceForBoard(boardId: string): string {
  return BUNDLE_BY_BOARD.get(boardId)?.pieceId ?? DEFAULT_PIECE_SKIN;
}

/** Is a bundle owned? ``default`` is always free; others need the board's ``*_grid`` id. */
export function bundleOwned(bundle: SkinBundle, purchased: string[]): boolean {
  return !!bundle.free || purchased.includes(bundle.boardId);
}
