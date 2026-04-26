/**
 * Structured content for the first-run tutorial walkthrough.
 *
 * The screen renderer in TutorialScreen.tsx reads this list and produces
 * visuals procedurally (grids drawn from PATTERN_METADATA, mock cards for
 * screen walkthroughs, simple illustrated boards for draws / 10-paths).
 *
 * Phase 1 is static visuals — bot-vs-bot animations and interactive
 * practice boards are stacked on top in later phases without changing this
 * content schema.
 */

export type StonePlacement = {
  /** Row (0-indexed from top). */
  r: number;
  /** Column (0-indexed from left). */
  c: number;
  /** Slot — used for colour + caption. */
  p: "P1" | "P2";
  /** Optional caption like "WIN" / "1" / "A". */
  label?: string;
  /** Optional soft highlight ring (used for "play here"). */
  hint?: boolean;
};

export interface BoardIllustration {
  size: 5 | 6 | 7;
  stones: StonePlacement[];
  /** Optional line of cells drawn with a win-line stroke (start/end coords). */
  winLine?: { from: [number, number]; to: [number, number] };
  /** Optional ordered path of cells for full-board connection wins. */
  path?: Array<[number, number]>;
  caption?: string;
}

export interface PatternGalleryStep {
  kind: "pattern-gallery";
  id: string;
  title: string;
  body: string;
  /** Which metadata dictionary to pull patterns from. */
  size: 5 | 6 | 7;
}

export interface BoardStep {
  kind: "board";
  id: string;
  title: string;
  body: string;
  board: BoardIllustration;
}

export interface DemoMove {
  r: number;
  c: number;
  p: "P1" | "P2";
}

/**
 * Scripted bot-vs-bot animated game. Moves are played out in order; the
 * renderer reveals one stone at a time until all moves are on the board,
 * then optionally draws a `winLine` or highlights a connected `path` and
 * shows an outcome banner.
 *
 * `specialCell` models the 6×6 Timebreaker trap: if a move lands on the
 * flagged cell the placed stone is drawn in the trap-owner's colour
 * regardless of which side "played" it.
 */
export interface DemoGameStep {
  kind: "demo-game";
  id: string;
  title: string;
  body: string;
  size: 5 | 6 | 7;
  moves: DemoMove[];
  /** Final decisive line drawn after the last move. */
  winLine?: { from: [number, number]; to: [number, number] };
  /** Final connected-region highlight (drawn beneath the stones). */
  path?: Array<[number, number]>;
  /** Cells that compose a winning pattern — ringed on completion. */
  patternHighlight?: Array<[number, number]>;
  /** Timebreaker-style trap cell. Opponent plays on it → stone is `owner`'s. */
  specialCell?: { r: number; c: number; owner: "P1" | "P2" };
  /** Banner drawn at the end of the sequence. */
  outcome?: "P1_WIN" | "P2_WIN" | "DRAW";
  caption?: string;
  /** Autoplay delay between moves in ms (default 750). */
  moveDelayMs?: number;
  /** Pause on the final frame before the demo loops (default 2400). */
  loopPauseMs?: number;
}

export interface ScreenMockStep {
  kind: "screen-mock";
  id: string;
  title: string;
  body: string;
  /** Which screen's mock to render (matches a key in TutorialScreen mocks). */
  screenKey: ScreenMockKey;
  /** Callouts to overlay on the mock (positions are percentage coords). */
  callouts: Array<{
    label: string;
    desc: string;
    /** Top-left % coords inside the mock card. */
    x: number;
    y: number;
  }>;
  /**
   * Optional screen-capture media. When `videoUrl` is set the renderer plays
   * it muted+looped in place of the procedural SVG mock; when `imageUrl` is
   * set the renderer draws a still image instead. Callouts still overlay
   * both. Populate these incrementally as real captures are recorded — any
   * step without a URL keeps the SVG fallback and still works.
   */
  videoUrl?: string;
  imageUrl?: string;
}

/**
 * Guided 5×5 practice board. The user plays P1; an internal script defines
 * the exact sequence of alternating moves. After each correct click the
 * next P2 move auto-plays, then the next P1 target is highlighted for the
 * user. Wrong clicks flash a hint without advancing.
 *
 * `goal` only affects labelling / success banner copy — the board logic is
 * identical either way and is driven entirely by the scripted `moves`.
 */
export interface InteractiveStep {
  kind: "interactive";
  id: string;
  title: string;
  body: string;
  size: 5;
  goal: "win" | "draw";
  /** Scripted alternating moves. Even indices are P1 (the user); odd are P2. */
  moves: DemoMove[];
  /** Final decisive line to draw on completion (wins only). */
  winLine?: { from: [number, number]; to: [number, number] };
  /** Final connected-region highlight to draw on completion. */
  path?: Array<[number, number]>;
  /** Pattern cells to ring on completion. */
  patternHighlight?: Array<[number, number]>;
  /** Message shown in the success banner when the user finishes. */
  successLabel: string;
  caption?: string;
}

export interface MessageStep {
  kind: "message";
  id: string;
  title: string;
  body: string;
  /** Optional bullet list rendered beneath the body. */
  bullets?: string[];
}

/**
 * Special-round multi-panel illustration. Each variant renders a purpose-
 * built diagram row beneath the title/body so we can depict the mechanic
 * visually instead of leaning on bullet text. Variants are hand-drawn
 * inside TutorialScreen.tsx — they don't use the generic board code.
 */
export interface BreakerDiagramStep {
  kind: "breaker-diagram";
  id: string;
  title: string;
  body: string;
  variant: "rulebreaker" | "mindbreaker" | "limitbreaker";
  bullets?: string[];
}

/**
 * Rank ladder illustration — shows ROOKIE → CHRONICLE stacked bottom to
 * top with increasing glow per tier. Used to replace the plain text
 * "ROOKIE → SKILLED → ELITE → …" bullet.
 */
export interface RankLadderStep {
  kind: "rank-ladder";
  id: string;
  title: string;
  body: string;
  bullets?: string[];
}

/**
 * Visual comparison of the centre rule's presence across the three board
 * sizes. Renders three labelled mini-boards side-by-side with a tick or a
 * cross so the player can see at a glance that only odd-sized boards have a
 * true centre cell.
 */
export interface CentreCompareStep {
  kind: "centre-compare";
  id: string;
  title: string;
  body: string;
  bullets?: string[];
  boards: Array<{
    size: 5 | 6 | 7;
    /** true → centre rule applies (show tick + glowing centre cell). */
    supported: boolean;
    /** Heading above each mini-board. */
    label: string;
    /** One-line note shown below the mini-board. */
    note?: string;
  }>;
}

/** Optional Syros-voiced epigraph (ancient observer; not tutorial helper copy). */
export type WithSyrosQuote = { syrosQuote?: string };

export type TutorialStep =
  | (MessageStep & WithSyrosQuote)
  | (PatternGalleryStep & WithSyrosQuote)
  | (BoardStep & WithSyrosQuote)
  | (DemoGameStep & WithSyrosQuote)
  | (InteractiveStep & WithSyrosQuote)
  | (ScreenMockStep & WithSyrosQuote)
  | (BreakerDiagramStep & WithSyrosQuote)
  | (RankLadderStep & WithSyrosQuote)
  | (CentreCompareStep & WithSyrosQuote);

/**
 * Interleave two player-specific cell lists into a P1-first alternating
 * move sequence. The shorter list runs out before the longer one; all
 * remaining cells of the longer list are appended in order afterwards.
 */
function interleaveMoves(
  p1Cells: Array<[number, number]>,
  p2Cells: Array<[number, number]>,
): DemoMove[] {
  const moves: DemoMove[] = [];
  const n = Math.max(p1Cells.length, p2Cells.length);
  for (let i = 0; i < n; i++) {
    if (i < p1Cells.length) moves.push({ r: p1Cells[i][0], c: p1Cells[i][1], p: "P1" });
    if (i < p2Cells.length) moves.push({ r: p2Cells[i][0], c: p2Cells[i][1], p: "P2" });
  }
  return moves;
}

export type ScreenMockKey =
  | "home"
  | "training"
  | "bots"
  | "unranked"
  | "ranked"
  | "store"
  | "collection"
  | "friends"
  | "career"
  | "profile";

/**
 * Section headers drive the table-of-contents rail in the overlay; each
 * section contains 1..N steps. Step IDs are unique across the whole list.
 */
export interface TutorialSection {
  id: string;
  title: string;
  steps: TutorialStep[];
}

/* ── Content ─────────────────────────────────────────────────────────────── */

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: "intro",
    title: "Welcome",
    steps: [
      {
        kind: "message",
        id: "intro-1",
        title: "Welcome to PentaProtocol",
        body:
          "PentaProtocol is a three-board strategy ladder. You play best-of-nine matches across 5×5, 6×6 and 7×7, with special \"breaker\" games at fixed rounds that change the rules. This walkthrough covers the board, how you win, the special rounds, how points work, and every screen in the app.",
        bullets: [
          "You can replay it any time from Training → Tutorial.",
        ],
        syrosQuote:
          "I have recorded every match played here. This sequence defines how outcomes are measured.",
      },
    ],
  },
  {
    id: "board-basics",
    title: "How the Board Works",
    steps: [
      {
        kind: "message",
        id: "board-1",
        title: "Three board sizes, one match",
        body:
          "A full ranked match runs across three legs: 5×5 (games 1–3), 6×6 (games 4–6) and 7×7 (games 7–9). If the match is tied 4–4 after nine games, a tenth \"Limitbreaker\" game decides the match.",
        bullets: [
          "Each leg has one \"breaker\" game with special rules.",
          "Game 3 = Rulebreaker · Game 6 = Timebreaker · Game 9 = Mindbreaker · Game 10 = Limitbreaker.",
        ],
        syrosQuote:
          "Board size changes the pressure, not the standard of play. The result still comes from execution under fixed rules.",
      },
      {
        kind: "demo-game",
        id: "demo-5x5-line",
        title: "5×5 · Straight line",
        body:
          "On 5×5 you can win by placing five stones in a straight line — row, column, or full diagonal. Watch P1 (dark) build a row while P2 plays elsewhere.",
        size: 5,
        moveDelayMs: 375,
        moves: [
          { r: 2, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
          { r: 2, c: 1, p: "P1" }, { r: 4, c: 4, p: "P2" },
          { r: 2, c: 2, p: "P1" }, { r: 0, c: 4, p: "P2" },
          { r: 2, c: 3, p: "P1" }, { r: 4, c: 0, p: "P2" },
          { r: 2, c: 4, p: "P1" },
        ],
        winLine: { from: [2, 0], to: [2, 4] },
        outcome: "P1_WIN",
        caption: "Five in a row across the middle — P1 wins.",
        syrosQuote:
          "A five-stone line is a completed condition, not an opinion. Most line wins are decided several turns before the final placement.",
      },
    ],
  },
  {
    id: "patterns",
    title: "Special Win Patterns",
    steps: [
      {
        kind: "message",
        id: "patterns-intro",
        title: "Patterns, not just lines",
        body:
          "Besides lines, each board size recognises a fixed catalogue of geometric patterns. Matching any selected pattern with your own stones instantly wins that game. The shapes are the same regardless of theme — only the visuals change.",
        syrosQuote:
          "Pattern play is pre-commitment under uncertainty. Once the shape closes, the game ends immediately.",
      },
      {
        kind: "pattern-gallery",
        id: "patterns-5",
        title: "5×5 patterns",
        body:
          "On 5×5 you pick five of these six patterns before every leg. The ones you pick are the ones the server will accept as a win condition against you.",
        size: 5,
        syrosQuote:
          "On 5x5, pattern selection changes both attack options and liabilities. I have seen players lose from choices made before move one.",
      },
      {
        kind: "demo-game",
        id: "demo-5x5-v",
        title: "5×5 · V-shape pattern win",
        body:
          "Pattern wins don't need a straight line — matching the geometry alone wins the game. Here P1 completes the V-SHAPE pattern.",
        size: 5,
        moveDelayMs: 375,
        moves: [
          { r: 0, c: 0, p: "P1" }, { r: 4, c: 0, p: "P2" },
          { r: 1, c: 1, p: "P1" }, { r: 3, c: 0, p: "P2" },
          { r: 2, c: 2, p: "P1" }, { r: 4, c: 3, p: "P2" },
          { r: 1, c: 3, p: "P1" }, { r: 3, c: 4, p: "P2" },
          { r: 0, c: 4, p: "P1" },
        ],
        patternHighlight: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
        outcome: "P1_WIN",
        caption: "V-SHAPE completed — P1 wins on a pattern match.",
        syrosQuote:
          "A pattern win has the same authority as a line win. Opponents often recognize the threat one turn too late.",
      },
      {
        kind: "demo-game",
        id: "demo-centre-rule",
        title: "5×5 · Centre rule (C3)",
        body:
          "On 5×5, opening on the centre tile (C3) grants your opponent two consecutive extra turns. Watch it play out — P1 opens on the centre, then P2 plays twice in a row before normal alternation resumes.",
        size: 5,
        moves: [
          { r: 2, c: 2, p: "P1" },
          { r: 0, c: 0, p: "P2" },
          { r: 4, c: 4, p: "P2" },
          { r: 1, c: 1, p: "P1" },
          { r: 3, c: 3, p: "P2" },
          { r: 1, c: 3, p: "P1" },
          { r: 3, c: 1, p: "P2" },
        ],
        caption:
          "Move 1 (P1) lands on C3 → P2 earns 2 extra turns (moves 2 & 3). From move 4 the turn order is normal again.",
        syrosQuote:
          "The centre opening on 5x5 triggers a defined penalty. The extra turns are a direct consequence, not a tactical guess.",
      },
      {
        kind: "centre-compare",
        id: "centre-compare-boards",
        title: "Centre rule by board size",
        body:
          "The centre rule only applies to boards that actually have a single centre cell. Odd sizes do, even sizes don't.",
        bullets: [
          "5×5 — C3 is the true centre. Centre rule applies.",
          "6×6 — there is no single centre tile (the middle is a 2×2 block). Centre rule does NOT apply — open anywhere safely on game\u00a01.",
          "7×7 — D4 is the true centre. Centre rule applies, and the extra-turn token stays in play for the whole leg.",
        ],
        boards: [
          { size: 5, supported: true, label: "5×5", note: "Centre = C3" },
          { size: 6, supported: false, label: "6×6", note: "No single centre" },
          { size: 7, supported: true, label: "7×7", note: "Centre = D4" },
        ],
        syrosQuote:
          "Only odd boards contain a single centre cell. Rule scope follows board geometry, not player preference.",
      },
      {
        kind: "pattern-gallery",
        id: "patterns-6",
        title: "6×6 patterns",
        body:
          "On 6×6 all seven patterns are always live — no picking phase. The line length for a straight-line win is also increased to six.",
        size: 6,
        syrosQuote:
          "On 6x6, all listed patterns remain active throughout the leg. Line completion requires six aligned stones.",
      },
      {
        kind: "pattern-gallery",
        id: "patterns-7",
        title: "7×7 patterns",
        body:
          "On 7×7 all eight structural patterns are always live. Straight-line wins require seven in a row. 7×7 also carries the \"extra-turn\" token from the centre rule.",
        size: 7,
        syrosQuote:
          "On 7x7, pattern pressure and centre consequences both persist. Errors expand because the board holds more unresolved threats.",
      },
    ],
  },
  {
    id: "full-board",
    title: "Draws & Full-Board Wins",
    steps: [
      {
        kind: "message",
        id: "fb-1",
        title: "What happens if nobody wins mid-game?",
        body:
          "If the board fills without any line or pattern being completed, the engine resolves the game by looking for each player's longest connected chain. Two of your stones are connected when they share an edge OR a corner — any of the 8 neighbouring cells counts, so diagonals link up chains too.",
        bullets: [
          "5×5 · needs a chain of 10 connected cells — winner takes the game.",
          "6×6 · needs a chain of 15 connected cells — winner takes the game.",
          "7×7 · needs a chain of 20 connected cells — winner takes the game.",
          "If neither player hits the threshold, the game is a DRAW.",
        ],
        syrosQuote:
          "A full board does not automatically resolve as a draw. Connected-path thresholds determine whether either side converts the position.",
      },
      {
        kind: "demo-game",
        id: "demo-5x5-path",
        title: "5×5 · 10-point connection",
        body:
          "A full 5×5 game that ends with no line or pattern completed. P2's stones form an 11-cell chain linked through diagonals and edges — the engine finds a path of more than 10 and awards the game to P2 on the connection rule.",
        size: 5,
        moveDelayMs: 75,
        moves: interleaveMoves(
          /* P1 (13 cells) — scattered so no 5-in-line, no L / V / T / ZZ-5 / DIAGONAL
             emerges mid-game; board fills and resolution falls to the chain rule. */
          [
            [0, 0], [0, 1], [0, 3], [1, 2], [2, 0], [2, 1], [2, 3], [2, 4],
            [3, 3], [3, 4], [4, 0], [4, 2], [4, 4],
          ],
          /* P2 (12 cells) — winning chain, all 8-neighbour connected. */
          [
            [0, 2], [0, 4], [1, 0], [1, 1], [1, 3], [1, 4], [2, 2],
            [3, 0], [3, 1], [3, 2], [4, 1], [4, 3],
          ],
        ),
        /* 11-cell diagonal-rich path through P2's stones — more than the
           10-cell threshold so the engine awards the game to P2. */
        path: [
          [0, 4], [1, 4], [1, 3], [0, 2], [1, 1], [2, 2], [3, 1], [3, 0], [4, 1], [3, 2], [4, 3],
        ],
        outcome: "P2_WIN",
        caption: "P2's 11-cell chain — diagonals and edges both count. Threshold met, P2 wins.",
        syrosQuote:
          "This 5x5 finish is decided by connectivity count. Diagonal and edge adjacency both contribute to the final chain.",
      },
      {
        kind: "interactive",
        id: "practice-5x5-win",
        title: "Your turn · Play to win",
        body:
          "You are P1 (dark stones). Tap the highlighted square to place a stone. P2 will reply automatically. Your goal is to complete a straight line of five — the target cells are hinted one at a time.",
        size: 5,
        goal: "win",
        moves: [
          { r: 2, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
          { r: 2, c: 1, p: "P1" }, { r: 0, c: 4, p: "P2" },
          { r: 2, c: 2, p: "P1" }, { r: 4, c: 0, p: "P2" },
          { r: 2, c: 3, p: "P1" }, { r: 4, c: 4, p: "P2" },
          { r: 2, c: 4, p: "P1" },
        ],
        winLine: { from: [2, 0], to: [2, 4] },
        successLabel: "Nicely done — you built a 5-in-a-row.",
        caption: "Follow the hint ring to complete your middle row.",
        syrosQuote:
          "Execution under turn order is the only requirement here. Correct placements produce a deterministic line finish.",
      },
      {
        kind: "demo-game",
        id: "demo-5x5-draw-both-reach",
        title: "5×5 · Draw (both hit threshold)",
        body:
          "Draw case 1 — BOTH players finish with a 10+ connected chain. The engine runs the chain search for each player; both succeed, so the game is declared a DRAW (neither side gets priority).",
        size: 5,
        moveDelayMs: 75,
        moves: interleaveMoves(
          /* P1 plays the X stones from the reference game (12 cells). */
          [
            [2, 2], [0, 2], [0, 3], [0, 4], [1, 1], [2, 1], [2, 4],
            [3, 0], [3, 2], [3, 3], [4, 1], [4, 3],
          ],
          /* P2 plays the Y stones (13 cells — P2 makes the closing move). */
          [
            [0, 0], [0, 1], [1, 0], [1, 2], [1, 3], [1, 4], [2, 0],
            [2, 3], [3, 1], [3, 4], [4, 0], [4, 2], [4, 4],
          ],
        ),
        /* Highlight P1's 12-cell chain so viewers can see one valid 10+
           region; P2's chain is equally long, which is why it ties. */
        path: [
          [0, 4], [0, 3], [0, 2], [1, 1], [2, 2], [2, 1],
          [3, 0], [4, 1], [3, 2], [4, 3], [3, 3], [2, 4],
        ],
        outcome: "DRAW",
        caption: "P1 has a 12-cell chain (shown). P2 also has a 12-cell chain through Y. Both ≥ 10 → DRAW.",
        syrosQuote:
          "Both sides can satisfy the full-board threshold in the same game. In that case, no side is awarded the win.",
      },
      {
        kind: "demo-game",
        id: "demo-5x5-draw-neither-reaches",
        title: "5×5 · Draw (nobody hits threshold)",
        body:
          "Draw case 2 — NEITHER player finishes with a 10-cell chain. Stones are too fragmented across the board, so no simple 8-way path of length 10 exists for either side. The engine declares DRAW.",
        size: 5,
        moveDelayMs: 75,
        moves: interleaveMoves(
          /* P1 plays the X stones (12 cells). */
          [
            [2, 2], [0, 1], [0, 3], [1, 0], [1, 3], [1, 4], [2, 0],
            [2, 1], [3, 3], [3, 4], [4, 1], [4, 2],
          ],
          /* P2 plays the Y stones (13 cells — P2 makes the closing move). */
          [
            [0, 0], [0, 2], [0, 4], [1, 1], [1, 2], [2, 3], [2, 4],
            [3, 0], [3, 1], [3, 2], [4, 0], [4, 3], [4, 4],
          ],
        ),
        outcome: "DRAW",
        caption: "Longest chain is 9 (P2) and 8 (P1). Neither hits 10 → DRAW.",
        syrosQuote:
          "If neither player reaches the threshold chain, the engine returns a draw. Fragmented structure is the common cause.",
      },
      {
        kind: "demo-game",
        id: "demo-6x6-line",
        title: "6×6 · Six in a row",
        body:
          "Straight-line wins on 6×6 need six consecutive stones. P1 builds a full middle row while P2 plays corners.",
        size: 6,
        moveDelayMs: 375,
        moves: [
          { r: 3, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
          { r: 3, c: 1, p: "P1" }, { r: 5, c: 5, p: "P2" },
          { r: 3, c: 2, p: "P1" }, { r: 0, c: 5, p: "P2" },
          { r: 3, c: 3, p: "P1" }, { r: 5, c: 0, p: "P2" },
          { r: 3, c: 4, p: "P1" }, { r: 1, c: 2, p: "P2" },
          { r: 3, c: 5, p: "P1" },
        ],
        winLine: { from: [3, 0], to: [3, 5] },
        outcome: "P1_WIN",
        caption: "Six in a row — P1 wins on 6×6.",
        syrosQuote:
          "Six in a row is mandatory on 6x6 line resolution. Partial files carry no value at game end.",
      },
      {
        kind: "board",
        id: "fb-6x6-path",
        title: "6×6 · 15-path example",
        body:
          "On 6×6 the threshold moves to 15. Any chain of that length counts, and diagonals keep a chain alive (8-way connection). Pattern wins on 6×6 still take priority over path resolution if triggered mid-game. This board is a real full fill: no six-in-a-line and no structural pattern wins for either side.",
        board: {
          size: 6,
          /* Occupancy from a real game — no line/pattern wins; path search finds
             both players can build a 15-cell chain → DRAW. Highlight: one valid
             P1 15-chain (king-adjacent). */
          stones: [
            { r: 0, c: 0, p: "P1" },
            { r: 0, c: 1, p: "P1" },
            { r: 0, c: 2, p: "P1" },
            { r: 0, c: 3, p: "P2" },
            { r: 0, c: 4, p: "P1" },
            { r: 0, c: 5, p: "P2" },
            { r: 1, c: 0, p: "P2" },
            { r: 1, c: 1, p: "P2" },
            { r: 1, c: 2, p: "P1" },
            { r: 1, c: 3, p: "P2" },
            { r: 1, c: 4, p: "P2" },
            { r: 1, c: 5, p: "P1" },
            { r: 2, c: 0, p: "P1" },
            { r: 2, c: 1, p: "P2" },
            { r: 2, c: 2, p: "P2" },
            { r: 2, c: 3, p: "P1" },
            { r: 2, c: 4, p: "P2" },
            { r: 2, c: 5, p: "P2" },
            { r: 3, c: 0, p: "P2" },
            { r: 3, c: 1, p: "P2" },
            { r: 3, c: 2, p: "P1" },
            { r: 3, c: 3, p: "P2" },
            { r: 3, c: 4, p: "P1" },
            { r: 3, c: 5, p: "P1" },
            { r: 4, c: 0, p: "P1" },
            { r: 4, c: 1, p: "P1" },
            { r: 4, c: 2, p: "P2" },
            { r: 4, c: 3, p: "P1" },
            { r: 4, c: 4, p: "P2" },
            { r: 4, c: 5, p: "P1" },
            { r: 5, c: 0, p: "P1" },
            { r: 5, c: 1, p: "P2" },
            { r: 5, c: 2, p: "P2" },
            { r: 5, c: 3, p: "P1" },
            { r: 5, c: 4, p: "P1" },
            { r: 5, c: 5, p: "P1" },
          ],
          path: [
            [0, 0], [0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [4, 3], [3, 2], [4, 1], [4, 0],
          ],
          caption:
            "Both players reach a 15-cell chain with no pattern wins — full-board path resolution is a DRAW. One valid P1 15-chain is highlighted.",
        },
        syrosQuote:
          "The 6x6 threshold is fifteen connected cells after full fill. Loose spacing reduces conversion probability in late turns.",
      },
      {
        kind: "demo-game",
        id: "demo-6x6-draw-full",
        title: "6×6 · Draw (full board)",
        body:
          "Bots replay a real full 6×6 fill from your reference: no six-in-a-line and no structural pattern wins. When the last cell fills, path resolution looks for a 15-cell king-connected chain — here neither side reaches 15, so the game is a DRAW.",
        size: 6,
        /* 650% faster than default tutorial demo pacing (6.5× speed). */
        moveDelayMs: 100,
        loopPauseMs: 480,
        moves: interleaveMoves(
          [
            [0, 1], [0, 3], [0, 4], [1, 0], [1, 2], [1, 3], [2, 2], [2, 5], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 0], [4, 3], [5, 0], [5, 2], [5, 4],
          ],
          [
            [0, 0], [0, 2], [0, 5], [1, 1], [1, 4], [1, 5], [2, 0], [2, 1], [2, 3], [2, 4], [3, 0], [4, 1], [4, 2], [4, 4], [4, 5], [5, 1], [5, 3], [5, 5],
          ],
        ),
        outcome: "DRAW",
        caption:
          "Full board with no pattern wins — longest chains stay below 15, so the engine declares DRAW.",
        syrosQuote:
          "This replay reaches a full board without pattern conversion. With both chains under fifteen, the result is a draw.",
      },
      {
        kind: "demo-game",
        id: "demo-7x7-line",
        title: "7×7 · Seven in a row",
        body:
          "On 7×7 straight-line wins need seven consecutive stones. Note P1 avoids the centre on move 1 — playing centre first on 7×7 grants the opponent two extra turns.",
        size: 7,
        moveDelayMs: 300,
        moves: [
          { r: 3, c: 0, p: "P1" }, { r: 0, c: 0, p: "P2" },
          { r: 3, c: 1, p: "P1" }, { r: 6, c: 6, p: "P2" },
          { r: 3, c: 2, p: "P1" }, { r: 0, c: 6, p: "P2" },
          { r: 3, c: 3, p: "P1" }, { r: 6, c: 0, p: "P2" },
          { r: 3, c: 4, p: "P1" }, { r: 1, c: 1, p: "P2" },
          { r: 3, c: 5, p: "P1" }, { r: 5, c: 5, p: "P2" },
          { r: 3, c: 6, p: "P1" },
        ],
        winLine: { from: [3, 0], to: [3, 6] },
        outcome: "P1_WIN",
        caption: "Seven in a row across 7×7 — P1 wins.",
        syrosQuote:
          "On 7x7, line completion requires seven aligned stones. Centre-rule penalties still apply when the opening move triggers them.",
      },
      {
        kind: "board",
        id: "fb-7x7-path",
        title: "7×7 · 20-path example",
        body:
          "On 7×7 the threshold moves to 20. Large boards favour players who keep their stones adjacent rather than spreading thin across patterns. This layout is taken from a real full-board game: no seven-in-a-line and no structural pattern wins — only path resolution decides.",
        board: {
          size: 7,
          /* Same cell occupancy as the uploaded reference (screenshot X/Y);
             P1/P2 are assigned so the long-chain side matches P1 in-engine. */
          stones: [
            { r: 0, c: 0, p: "P2" },
            { r: 0, c: 1, p: "P1" },
            { r: 0, c: 2, p: "P2" },
            { r: 0, c: 3, p: "P1" },
            { r: 0, c: 4, p: "P2" },
            { r: 0, c: 5, p: "P1" },
            { r: 0, c: 6, p: "P2" },
            { r: 1, c: 0, p: "P1" },
            { r: 1, c: 1, p: "P1" },
            { r: 1, c: 2, p: "P2" },
            { r: 1, c: 3, p: "P2" },
            { r: 1, c: 4, p: "P1" },
            { r: 1, c: 5, p: "P1" },
            { r: 1, c: 6, p: "P2" },
            { r: 2, c: 0, p: "P2" },
            { r: 2, c: 1, p: "P1" },
            { r: 2, c: 2, p: "P1" },
            { r: 2, c: 3, p: "P1" },
            { r: 2, c: 4, p: "P1" },
            { r: 2, c: 5, p: "P2" },
            { r: 2, c: 6, p: "P2" },
            { r: 3, c: 0, p: "P1" },
            { r: 3, c: 1, p: "P2" },
            { r: 3, c: 2, p: "P2" },
            { r: 3, c: 3, p: "P2" },
            { r: 3, c: 4, p: "P2" },
            { r: 3, c: 5, p: "P1" },
            { r: 3, c: 6, p: "P1" },
            { r: 4, c: 0, p: "P1" },
            { r: 4, c: 1, p: "P2" },
            { r: 4, c: 2, p: "P1" },
            { r: 4, c: 3, p: "P2" },
            { r: 4, c: 4, p: "P2" },
            { r: 4, c: 5, p: "P1" },
            { r: 4, c: 6, p: "P1" },
            { r: 5, c: 0, p: "P1" },
            { r: 5, c: 1, p: "P1" },
            { r: 5, c: 2, p: "P1" },
            { r: 5, c: 3, p: "P2" },
            { r: 5, c: 4, p: "P2" },
            { r: 5, c: 5, p: "P2" },
            { r: 5, c: 6, p: "P2" },
            { r: 6, c: 0, p: "P2" },
            { r: 6, c: 1, p: "P2" },
            { r: 6, c: 2, p: "P2" },
            { r: 6, c: 3, p: "P1" },
            { r: 6, c: 4, p: "P1" },
            { r: 6, c: 5, p: "P1" },
            { r: 6, c: 6, p: "P2" },
          ],
          path: [
            [0, 3], [1, 4], [0, 5], [1, 5], [2, 4], [2, 3], [2, 2], [1, 1], [0, 1], [1, 0], [2, 1], [3, 0], [4, 0], [5, 0], [5, 1], [4, 2], [5, 2], [6, 3], [6, 4], [6, 5],
          ],
          caption:
            "P1 completes a 20-cell king-connected chain with no pattern wins — path resolution awards the game to P1.",
        },
        syrosQuote:
          "The 7x7 full-board threshold is twenty connected cells. Reaching it overrides stalemate assumptions immediately.",
      },
      {
        kind: "demo-game",
        id: "demo-7x7-draw-full",
        title: "7×7 · Draw (full board)",
        body:
          "Bots replay a real full 7×7 fill from your reference: no seven-in-a-line and no structural pattern wins. After the last stone, path resolution needs a 20-cell chain — here neither player reaches 20, so the game is a DRAW.",
        size: 7,
        /* 650% faster than default tutorial demo pacing (6.5× speed). */
        moveDelayMs: 100,
        loopPauseMs: 480,
        moves: interleaveMoves(
          [
            [0, 2], [0, 3], [0, 4], [0, 6], [1, 0], [1, 2], [2, 0], [2, 2], [2, 4], [2, 5], [3, 2], [3, 3], [3, 5], [3, 6], [4, 0], [4, 1], [4, 2], [4, 4], [4, 5], [5, 1], [5, 2], [6, 1], [6, 3], [6, 5], [6, 6],
          ],
          [
            [0, 0], [0, 1], [0, 5], [1, 1], [1, 3], [1, 4], [1, 5], [1, 6], [2, 1], [2, 3], [2, 6], [3, 0], [3, 1], [3, 4], [4, 3], [4, 6], [5, 0], [5, 3], [5, 4], [5, 5], [5, 6], [6, 0], [6, 2], [6, 4],
          ],
        ),
        outcome: "DRAW",
        caption:
          "Full board with no pattern wins — neither side builds a 20-cell chain, so the engine declares DRAW.",
        syrosQuote:
          "A full 7x7 board can still end drawn. If both chains remain below twenty, no winner is assigned.",
      },
    ],
  },
  {
    id: "specials",
    title: "Special Rounds",
    steps: [
      {
        kind: "breaker-diagram",
        id: "rulebreaker",
        title: "Rulebreaker · Game 3 (5×5)",
        body:
          "Before game 3 on the 5×5 leg a coin toss runs. The toss winner picks one of two modifiers for that game only. Both options change the play pressure without changing the underlying win conditions.",
        variant: "rulebreaker",
        bullets: [
          "Option A — Center block: the centre cell (row 2, column 2) is locked; neither player can place there for the whole game.",
          "Option B — Force first turn: the chooser picks which player plays first instead of it being random.",
          "The loser of the toss picks the remaining modifier.",
        ],
        syrosQuote:
          "Rulebreaker modifies control variables, not core victory definitions. Coin outcome determines which constraints apply in game three.",
      },
      {
        kind: "message",
        id: "timebreaker",
        title: "Timebreaker · Game 6 (6×6)",
        body:
          "Before game 6 on the 6×6 leg a coin toss picks a toss winner. They choose between two pressure mechanics. Game 6 still follows normal 6×6 patterns and path resolution.",
        bullets: [
          "Option A — Reduced clock: one player's match clock is cut from the normal 3:00 all the way down to 1:00 for this game.",
          "Option B — Special cell: the chooser secretly marks one cell on the board; any stone that lands on it counts as theirs.",
        ],
        syrosQuote:
          "Timebreaker introduces asymmetric pressure through clock or cell control. Both options alter decision windows immediately.",
      },
      {
        kind: "demo-game",
        id: "demo-timebreaker-trap",
        title: "Timebreaker · special-cell trap",
        body:
          "P1 picks option B and marks (2,2) as their trap. The trap is hidden from P2 in a real game; we draw it with a dashed ring here so you can follow. When P2 plays on the trap cell, the placed stone counts as P1's. (Note: if option A had been chosen instead, one player's clock would drop from 3:00 to 1:00 — no trap on the board.)",
        size: 6,
        moves: [
          { r: 0, c: 0, p: "P1" },
          { r: 2, c: 2, p: "P2" },
          { r: 1, c: 1, p: "P1" },
          { r: 4, c: 4, p: "P2" },
        ],
        specialCell: { r: 2, c: 2, owner: "P1" },
        caption: "P2 plays (2,2) — because it's P1's trap, the stone is P1's.",
        syrosQuote:
          "The marked trap cell follows declared ownership rules. Placement input does not override that assignment.",
      },
      {
        kind: "breaker-diagram",
        id: "mindbreaker",
        title: "Mindbreaker · Game 9 (7×7)",
        body:
          "Before game 9 on the 7×7 leg the toss winner reshapes the pattern pool for that game — forcing the opponent to play against an unfamiliar structural rule-set. Line-win and path-win conditions still apply on top.",
        variant: "mindbreaker",
        bullets: [
          "Option A — Pick two extra patterns: mid-game the chooser adds two bonus win patterns only they can complete.",
          "Option B — Ban a pattern: one normally-valid pattern is removed; if the opponent completes it, nothing happens.",
        ],
        syrosQuote:
          "Mindbreaker changes available pattern logic for one side. Recognition errors increase when expected shapes are removed or added.",
      },
      {
        kind: "breaker-diagram",
        id: "limitbreaker",
        title: "Limitbreaker · Game 10",
        body:
          "Only played when the nine-game match is tied 4–4. Limitbreaker uses a single board size — the other two are crossed off — plus a forced-first-turn coin toss. Winning a Limitbreaker closes the match; the loser gets no split-point.",
        variant: "limitbreaker",
        bullets: [
          "Only one of 5×5 / 6×6 / 7×7 is played; the other two legs are locked out.",
          "Toss winner chooses which player plays first on the surviving board.",
        ],
        syrosQuote:
          "Limitbreaker is a single-game resolution at 4-4. First-turn control and board selection decide the final leverage.",
      },
    ],
  },
  {
    id: "points",
    title: "Points & Progression",
    steps: [
      {
        kind: "message",
        id: "points-1",
        title: "How a match awards points",
        body:
          "Each game inside a match contributes a game-point. First to 5 game-points wins the match (you need at least one win to clinch, so the match can also end 5–4 after Limitbreaker).",
        bullets: [
          "Win a game → 1 game-point.",
          "Draw → 0 game-points to both players.",
          "Lose → 0 game-points.",
          "Match winner takes the elo / ranked points delta for the leg.",
        ],
        syrosQuote:
          "Match scoring is discrete and non-cumulative beyond game points. Draws do not move the scoreline.",
      },
      {
        kind: "rank-ladder",
        id: "points-2",
        title: "Ranked, elo and placements",
        body:
          "Ranked matches move your elo using a standard K-factor system. New accounts play a short set of placement matches before the visible rank settles — your hidden MMR is still adjusting during placements. XP is awarded separately for missions and bot defeats and drives your account level, which is cosmetic only.",
        bullets: [
          "Placements — the first few ranked matches use a wider swing.",
          "Ranks climb from the bottom — each tier glows brighter than the last.",
          "Unranked, training, bot and custom games never touch your rank.",
        ],
        syrosQuote:
          "Ranked rating reflects match outcomes under the ladder rules. XP progression is cosmetic and independent of ranked standing.",
      },
    ],
  },
  {
    id: "screens",
    title: "App Walkthrough",
    steps: [
      {
        kind: "screen-mock",
        id: "screen-home",
        title: "Home",
        body:
          "Landing page after sign-in. Quick access to every major flow, plus the legal documents pinned to the footer.",
        screenKey: "home",
        callouts: [
          { label: "Play", desc: "Enter matchmaking (unranked or ranked).", x: 50, y: 22 },
          { label: "Training", desc: "Practice any board size offline vs. a dummy.", x: 20, y: 60 },
          { label: "Bots", desc: "Challenge named AI opponents for XP and rewards.", x: 80, y: 60 },
          { label: "Terms & Conditions", desc: "The rules you agreed to — opens in a new tab.", x: 18, y: 88 },
          { label: "Privacy Policy", desc: "What data we store and how we use it.", x: 50, y: 88 },
          { label: "Refund Policy", desc: "Store / cosmetic purchase refund rules.", x: 82, y: 88 },
        ],
        syrosQuote:
          "Home screen actions map directly to distinct game flows. Incorrect entry choice produces predictable friction later.",
      },
      {
        kind: "screen-mock",
        id: "screen-training",
        title: "Training",
        body:
          "Two modes under Training: the Tutorial (this walkthrough — replay any time) and Singleplayer, an offline, no-stakes match so you can practise patterns and moves without affecting your rank.",
        screenKey: "training",
        callouts: [
          { label: "Tutorial", desc: "Re-opens this full walkthrough from the top.", x: 30, y: 45 },
          { label: "Singleplayer", desc: "Pick a board size and play offline practice matches.", x: 70, y: 45 },
          { label: "No stakes", desc: "No elo, no mission contribution, no bot rewards.", x: 50, y: 82 },
        ],
        syrosQuote:
          "Training isolates mechanics from ranking consequences. Repetition here improves precision without rating loss.",
      },
      {
        kind: "screen-mock",
        id: "screen-bots",
        title: "Bots",
        body:
          "Nine named AI opponents across three tiers. Defeating each tier's boss unlocks one-time rewards (a banner, a coin-toss skin, a board skin).",
        screenKey: "bots",
        callouts: [
          { label: "Tier 1 — Baltazar / Salazar / JR", desc: "5×5 ladder. JR is the tier boss.", x: 20, y: 38 },
          { label: "Tier 2 — Valdorin / Eldorin / HIM", desc: "6×6 ladder. HIM is the tier boss.", x: 50, y: 38 },
          { label: "Tier 3 — Seraphina / Regina / HER", desc: "7×7 ladder. HER is the tier boss.", x: 80, y: 38 },
          { label: "Rewards", desc: "Tier-boss wins queue a claimable reward on this screen.", x: 50, y: 82 },
        ],
        syrosQuote:
          "Bot ladders are structured progression tests with fixed rewards. Cosmetic unlocks do not change board strength.",
      },
      {
        kind: "screen-mock",
        id: "screen-unranked",
        title: "Unranked queue",
        body:
          "Matchmaking with other players where nothing touches your elo. Good for trying new pattern picks or warming up.",
        screenKey: "unranked",
        callouts: [
          { label: "Queue", desc: "Finds a live opponent; cancel any time.", x: 50, y: 35 },
          { label: "Cancel", desc: "Leaves the queue instantly and returns here.", x: 50, y: 70 },
        ],
        syrosQuote:
          "Unranked queue preserves match structure without rating impact. It is the standard environment for low-risk pattern testing.",
      },
      {
        kind: "screen-mock",
        id: "screen-ranked",
        title: "Ranked queue",
        body:
          "Full best-of-nine match against a ranked opponent. Your elo, ranked rating and placement count update after the match resolves.",
        screenKey: "ranked",
        callouts: [
          { label: "Rank badge", desc: "Your current rank and ranked rating.", x: 25, y: 25 },
          { label: "Queue", desc: "Starts a full BO9 with Rulebreaker / Timebreaker / Mindbreaker baked in.", x: 50, y: 55 },
          { label: "Placement note", desc: "Visible when you still have placement matches remaining.", x: 50, y: 82 },
        ],
        syrosQuote:
          "Ranked queue applies full competitive accounting after resolution. Variance remains, but rating movement is rule-bound.",
      },
      {
        kind: "screen-mock",
        id: "screen-store",
        title: "Store",
        body:
          "Buy cosmetic theme packs, grid skins, banners and coin-toss skins. Some items are Shards-priced, others Protocredits; purchased items show up in your Collection.",
        screenKey: "store",
        callouts: [
          { label: "Categories", desc: "Themes, grids, banners, coin tosses — switch with the tabs up top.", x: 50, y: 20 },
          { label: "Item card", desc: "Shows name, preview, price and unlock requirement.", x: 30, y: 55 },
          { label: "Currency", desc: "Shards and Protocredits are shown in the top-right.", x: 85, y: 18 },
        ],
        syrosQuote:
          "Store inventory changes presentation only. Purchase state has no effect on legal move outcomes.",
      },
      {
        kind: "screen-mock",
        id: "screen-collection",
        title: "Collection",
        body:
          "Everything you own: themes, grids, banners, coin tosses, badges. Equip from here; equipped cosmetics are reflected in-game and on your profile.",
        screenKey: "collection",
        callouts: [
          { label: "Category rail", desc: "Themes · Grids · Banners · Coins · Badges.", x: 15, y: 40 },
          { label: "Item state", desc: "\"Equipped\" / \"Owned\" / \"Locked\" badge on each card.", x: 55, y: 55 },
        ],
        syrosQuote:
          "Collection controls equipped cosmetics across surfaces. Ownership status does not alter game-state evaluation.",
      },
      {
        kind: "screen-mock",
        id: "screen-friends",
        title: "Friends",
        body:
          "Add friends by friend-code, see who is online, send direct challenges and messages. Blocking a user hides them from queue, friend search and DMs.",
        screenKey: "friends",
        callouts: [
          { label: "Friend code", desc: "Your own code for others to add you with.", x: 50, y: 22 },
          { label: "Online rail", desc: "Friends who are online right now.", x: 25, y: 60 },
          { label: "DMs", desc: "Direct messages with friends — blocked users disappear here.", x: 75, y: 60 },
        ],
        syrosQuote:
          "Friends tools control communication and direct challenge access. Block state enforces immediate interaction limits.",
      },
      {
        kind: "screen-mock",
        id: "screen-career",
        title: "Career",
        body:
          "Your match history, elo curve and recent results. Each row shows opponent, board, result and the elo delta that match produced.",
        screenKey: "career",
        callouts: [
          { label: "Elo curve", desc: "Your recent ranked trajectory.", x: 50, y: 25 },
          { label: "Match row", desc: "Tap a row for the full game-by-game breakdown.", x: 50, y: 62 },
        ],
        syrosQuote:
          "Career history exposes outcome patterns over time. Repeated errors are visible long before rank collapse.",
      },
      {
        kind: "screen-mock",
        id: "screen-profile",
        title: "Profile",
        body:
          "Your avatar, bio, equipped cosmetics, 2FA / Google link status and account settings all live here.",
        screenKey: "profile",
        callouts: [
          { label: "Avatar + bio", desc: "Uploaded photo is used across the app wherever your avatar appears.", x: 25, y: 28 },
          { label: "Security", desc: "2FA, password, Google link, delete account.", x: 75, y: 35 },
        ],
        syrosQuote:
          "Profile settings govern identity, security, and account controls. These settings persist independently of match context.",
      },
    ],
  },
  {
    id: "done",
    title: "You're ready",
    steps: [
      {
        kind: "message",
        id: "done-1",
        title: "That's everything.",
        body:
          "You know the boards, the win conditions, the four special rounds and every major screen. Head to the Play lobby when you want a real match, or warm up in Training or against Bots first.",
        bullets: [
          "Need a refresher? Training → Tutorial.",
          "Good luck out there.",
        ],
        syrosQuote:
          "This tutorial defines the operating rules and interfaces. I have seen the same mistakes repeated when players skip these constraints.",
      },
    ],
  },
];

/** Flat, ordered list of steps (with section reference) — used for paging. */
export interface FlatTutorialStep {
  step: TutorialStep;
  sectionIndex: number;
  sectionTitle: string;
  stepIndex: number;
}

export function flattenTutorial(): FlatTutorialStep[] {
  const out: FlatTutorialStep[] = [];
  TUTORIAL_SECTIONS.forEach((sec, si) => {
    sec.steps.forEach((st, i) => {
      out.push({ step: st, sectionIndex: si, sectionTitle: sec.title, stepIndex: i });
    });
  });
  return out;
}
