use std::sync::OnceLock;

pub const GRID6: usize = 6;
pub const CELLS6: usize = GRID6 * GRID6;
pub const CENTER6: usize = 2;
pub const INF6: i32 = 1_000_000_000;

pub const DIRS4_6: [(i32, i32); 4] = [(0, 1), (1, 0), (1, 1), (1, -1)];
pub const ALL_DIRS_6: [(i32, i32); 8] = [
    (0, 1),
    (1, 0),
    (1, 1),
    (1, -1),
    (0, -1),
    (-1, 0),
    (-1, -1),
    (-1, 1),
];

pub type Board6 = [u8; CELLS6];

#[inline(always)]
pub fn rc6(idx: usize) -> (usize, usize) {
    (idx / GRID6, idx % GRID6)
}

#[inline(always)]
pub fn idx6(r: usize, c: usize) -> usize {
    r * GRID6 + c
}

#[inline(always)]
pub fn make6(board: &mut Board6, i: usize, player: u8) {
    board[i] = player;
}

#[inline(always)]
pub fn unmake6(board: &mut Board6, i: usize) {
    board[i] = 0;
}

static TABLES6: OnceLock<TablesOwned6> = OnceLock::new();

pub struct TablesOwned6 {
    pub neighbors: Vec<Vec<usize>>,
    pub center_dist: [u8; CELLS6],
    pub zobrist: [[u64; 3]; CELLS6],
}

pub struct EvalContext6 {
    pub seen_l: [bool; 1024],
    pub seen_p: [bool; 1024],
    pub vis: [bool; CELLS6],
}

impl Default for EvalContext6 {
    fn default() -> Self {
        EvalContext6 {
            seen_l: [false; 1024],
            seen_p: [false; 1024],
            vis: [false; CELLS6],
        }
    }
}

impl TablesOwned6 {
    fn build() -> Self {
        let mut neighbors = vec![Vec::new(); CELLS6];
        for i in 0..CELLS6 {
            let (r, c) = rc6(i);
            for &(dr, dc) in &ALL_DIRS_6 {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                if nr >= 0 && nr < GRID6 as i32 && nc >= 0 && nc < GRID6 as i32 {
                    neighbors[i].push(idx6(nr as usize, nc as usize));
                }
            }
        }

        let mut center_dist = [0u8; CELLS6];
        for i in 0..CELLS6 {
            let (r, c) = rc6(i);
            center_dist[i] =
                ((r as i32 - CENTER6 as i32).unsigned_abs() + (c as i32 - CENTER6 as i32).unsigned_abs()) as u8;
        }

        let mut zobrist = [[0u64; 3]; CELLS6];
        let mut state: u64 = 0xDEADBEEF;
        for cell in zobrist.iter_mut() {
            for slot in cell.iter_mut() {
                state ^= state << 13;
                state ^= state >> 7;
                state ^= state << 17;
                *slot = state;
            }
        }

        TablesOwned6 {
            neighbors,
            center_dist,
            zobrist,
        }
    }
}

pub fn tables6() -> &'static TablesOwned6 {
    TABLES6.get_or_init(TablesOwned6::build)
}

pub fn to_flat6(board_2d: &[Vec<Option<String>>], bot: &str, human: &str) -> (Board6, u64) {
    let t = tables6();
    let mut flat = [0u8; CELLS6];
    let mut zhash: u64 = 0;
    for r in 0..GRID6 {
        for c in 0..GRID6 {
            if let Some(ref v) = board_2d[r][c] {
                let p: u8 = if v == bot { 1 } else if v == human { 2 } else { 0 };
                if p > 0 {
                    let i = idx6(r, c);
                    flat[i] = p;
                    zhash ^= t.zobrist[i][p as usize];
                }
            }
        }
    }
    (flat, zhash)
}
