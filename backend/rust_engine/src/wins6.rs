use crate::board6::{rc6, Board6, ALL_DIRS_6, GRID6};
use crate::patterns6::PatternIndex6;

pub fn line_win6(board: &Board6, i: usize, player: u8) -> bool {
    let (r, c) = rc6(i);
    for &(dr, dc) in &ALL_DIRS_6 {
        let mut cnt: i32 = 1;
        for sign in [1i32, -1i32] {
            let mut rr = r as i32 + sign * dr;
            let mut cc = c as i32 + sign * dc;
            while rr >= 0
                && rr < GRID6 as i32
                && cc >= 0
                && cc < GRID6 as i32
                && board[(rr as usize) * GRID6 + cc as usize] == player
            {
                cnt += 1;
                rr += sign * dr;
                cc += sign * dc;
            }
        }
        if cnt >= 6 {
            return true;
        }
    }
    false
}

pub fn pattern_win_at6(board: &Board6, i: usize, player: u8, pi: &PatternIndex6) -> bool {
    for &pat_idx in &pi.cell_pats[i] {
        let cells = &pi.pat_cells[pat_idx as usize];
        if cells.iter().all(|&ci| board[ci] == player) {
            return true;
        }
    }
    false
}

#[inline]
pub fn wins_at6(board: &Board6, i: usize, player: u8, pi: &PatternIndex6) -> bool {
    line_win6(board, i, player) || pattern_win_at6(board, i, player, pi)
}
