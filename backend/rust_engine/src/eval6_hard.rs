use crate::board6::{tables6, Board6, CELLS6, EvalContext6};
use crate::patterns6::PatternIndex6;
use std::collections::VecDeque;

pub fn eval_heuristic6(
    board: &Board6,
    me: u8,
    opp: u8,
    pi: &PatternIndex6,
    moves_played: i32,
    ctx: &mut EvalContext6,
) -> i32 {
    let mut score: i32 = 0;
    score += line_score6(board, me, opp, pi, ctx);
    score += pattern_score6(board, me, opp, pi, ctx);
    score += connectivity_score6(board, me, opp, moves_played);
    score += center_score6(board, me, opp);
    score
}

fn line_score6(board: &Board6, me: u8, opp: u8, pi: &PatternIndex6, ctx: &mut EvalContext6) -> i32 {
    let mut score: i32 = 0;
    ctx.seen_l.iter_mut().for_each(|x| *x = false);
    for i in 0..CELLS6 {
        if board[i] == 0 {
            continue;
        }
        for &li in &pi.cell_lines[i] {
            let li = li as usize;
            if li >= 1024 || ctx.seen_l[li] {
                continue;
            }
            ctx.seen_l[li] = true;
            let line = &pi.line_cells[li];
            let mut mine = 0i32;
            let mut theirs = 0i32;
            for &ci in line {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                let m4 = mine * mine * mine * mine;
                score += m4 * 24;
            } else if theirs > 0 && mine == 0 {
                let t4 = theirs * theirs * theirs * theirs;
                score -= t4 * 34;
            }
        }
    }
    score
}

fn pattern_score6(board: &Board6, me: u8, opp: u8, pi: &PatternIndex6, ctx: &mut EvalContext6) -> i32 {
    let mut score: i32 = 0;
    ctx.seen_p.iter_mut().for_each(|x| *x = false);
    for i in 0..CELLS6 {
        if board[i] == 0 {
            continue;
        }
        for &pat_idx in &pi.cell_pats[i] {
            let pat_idx = pat_idx as usize;
            if pat_idx >= 1024 || ctx.seen_p[pat_idx] {
                continue;
            }
            ctx.seen_p[pat_idx] = true;
            let cells = &pi.pat_cells[pat_idx];
            let mut mine = 0i32;
            let mut theirs = 0i32;
            for &ci in cells {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                let m4 = mine * mine * mine * mine;
                score += m4 * 44;
            } else if theirs > 0 && mine == 0 {
                let t4 = theirs * theirs * theirs * theirs;
                score -= t4 * 62;
            }
        }
    }
    score
}

pub fn largest_connected6(board: &Board6, player: u8) -> i32 {
    let t = tables6();
    let mut visited = [false; CELLS6];
    let mut best = 0i32;
    let mut q = VecDeque::new();
    for i in 0..CELLS6 {
        if board[i] != player || visited[i] {
            continue;
        }
        let mut size = 0i32;
        q.push_back(i);
        visited[i] = true;
        while let Some(ci) = q.pop_front() {
            size += 1;
            for &ni in &t.neighbors[ci] {
                if board[ni] == player && !visited[ni] {
                    visited[ni] = true;
                    q.push_back(ni);
                }
            }
        }
        if size > best {
            best = size;
        }
    }
    best
}

fn connectivity_score6(board: &Board6, me: u8, opp: u8, moves_played: i32) -> i32 {
    let weight = 4.0 + (moves_played as f64 / 36.0) * 14.0;
    let my_conn = largest_connected6(board, me);
    let op_conn = largest_connected6(board, opp);
    ((my_conn - op_conn) as f64 * weight) as i32
}

fn center_score6(board: &Board6, me: u8, opp: u8) -> i32 {
    let t = tables6();
    let mut score = 0i32;
    for i in 0..CELLS6 {
        let dist = t.center_dist[i] as i32;
        let bonus = (5 - dist).max(0) * 2;
        if board[i] == me {
            score += bonus;
        } else if board[i] == opp {
            score -= bonus;
        }
    }
    score
}

pub fn eval_full_hard6(board: &Board6, me: u8, opp: u8) -> i32 {
    let my_conn = largest_connected6(board, me);
    let opp_conn = largest_connected6(board, opp);
    let my_has15 = my_conn >= 15;
    let opp_has15 = opp_conn >= 15;
    if my_has15 && !opp_has15 {
        800_000
    } else if opp_has15 && !my_has15 {
        -800_000
    } else {
        (my_conn - opp_conn) * 500
    }
}
