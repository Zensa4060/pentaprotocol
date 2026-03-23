use crate::board::{rc, Board, ALL_DIRS, GRID};
use crate::patterns::PatternIndex;

pub fn line_win(board: &Board, i: usize, player: u8) -> bool {
    let (r, c) = rc(i);
    for &(dr, dc) in &ALL_DIRS {
        let mut cnt: i32 = 1;
        for sign in [1i32, -1i32] {
            let mut rr = r as i32 + sign * dr;
            let mut cc = c as i32 + sign * dc;
            while rr >= 0
                && rr < GRID as i32
                && cc >= 0
                && cc < GRID as i32
                && board[(rr as usize) * GRID + cc as usize] == player
            {
                cnt += 1;
                rr += sign * dr;
                cc += sign * dc;
            }
        }
        if cnt >= 7 {
            return true;
        }
    }
    false
}

pub fn pattern_win_at(board: &Board, i: usize, player: u8, pi: &PatternIndex) -> bool {
    for &pat_idx in &pi.cell_pats[i] {
        let cells = &pi.pat_cells[pat_idx as usize];
        if cells.iter().all(|&ci| board[ci] == player) {
            return true;
        }
    }
    false
}

#[inline]
pub fn wins_at(board: &Board, i: usize, player: u8, pi: &PatternIndex) -> bool {
    line_win(board, i, player) || pattern_win_at(board, i, player, pi)
}
