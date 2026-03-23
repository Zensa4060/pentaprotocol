pub const GRID: usize = 7;
pub const CELLS: usize = GRID * GRID;
pub const CENTER: usize = 3;
pub const CENTER_IDX: usize = CENTER * GRID + CENTER;
pub const INF: i32 = 1_000_000_000;

pub const DIRS4: [(i32, i32); 4] = [(0, 1), (1, 0), (1, 1), (1, -1)];
pub const ALL_DIRS: [(i32, i32); 8] = [
    (0, 1),
    (1, 0),
    (1, 1),
    (1, -1),
    (0, -1),
    (-1, 0),
    (-1, -1),
    (-1, 1),
];

pub type Board = [u8; CELLS];

#[inline(always)]
pub fn rc(idx: usize) -> (usize, usize) {
    (idx / GRID, idx % GRID)
}

#[inline(always)]
pub fn idx(r: usize, c: usize) -> usize {
    r * GRID + c
}

#[inline(always)]
pub fn make(board: &mut Board, i: usize, player: u8) {
    board[i] = player;
}

#[inline(always)]
pub fn unmake(board: &mut Board, i: usize) {
    board[i] = 0;
}

use std::sync::OnceLock;

static TABLES: OnceLock<TablesOwned> = OnceLock::new();

pub struct TablesOwned {
    pub neighbors: Vec<Vec<usize>>,
    pub center_dist: [u8; CELLS],
    pub zobrist: [[u64; 3]; CELLS],
}

impl TablesOwned {
    fn build() -> Self {
        let mut neighbors = vec![Vec::new(); CELLS];
        for i in 0..CELLS {
            let (r, c) = rc(i);
            for &(dr, dc) in &ALL_DIRS {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                if nr >= 0 && nr < GRID as i32 && nc >= 0 && nc < GRID as i32 {
                    neighbors[i].push(idx(nr as usize, nc as usize));
                }
            }
        }

        let mut center_dist = [0u8; CELLS];
        for i in 0..CELLS {
            let (r, c) = rc(i);
            center_dist[i] =
                ((r as i32 - CENTER as i32).unsigned_abs() + (c as i32 - CENTER as i32).unsigned_abs()) as u8;
        }

        // Zobrist: same seed as Python (0xDEADBEEF) using a simple xorshift64
        let mut zobrist = [[0u64; 3]; CELLS];
        let mut state: u64 = 0xDEADBEEF;
        for cell in zobrist.iter_mut() {
            for slot in cell.iter_mut() {
                // xorshift64
                state ^= state << 13;
                state ^= state >> 7;
                state ^= state << 17;
                *slot = state;
            }
        }

        TablesOwned {
            neighbors,
            center_dist,
            zobrist,
        }
    }
}

pub fn tables() -> &'static TablesOwned {
    TABLES.get_or_init(TablesOwned::build)
}

pub fn to_flat(board_2d: &[Vec<Option<String>>], bot: &str, human: &str) -> (Board, u64) {
    let t = tables();
    let mut flat = [0u8; CELLS];
    let mut zhash: u64 = 0;
    for r in 0..GRID {
        for c in 0..GRID {
            if let Some(ref v) = board_2d[r][c] {
                let p: u8 = if v == bot { 1 } else if v == human { 2 } else { 0 };
                if p > 0 {
                    let i = idx(r, c);
                    flat[i] = p;
                    zhash ^= t.zobrist[i][p as usize];
                }
            }
        }
    }
    (flat, zhash)
}

