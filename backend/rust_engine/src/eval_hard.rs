use crate::board::{tables, Board, CELLS, EvalContext};
use crate::patterns::PatternIndex;
use std::collections::VecDeque;

/// Hard-mode evaluation: port of Bot7Engine._eval_heuristic from bot7.py.
/// Weights: line n^4*25/35, pattern n^4*45/65, connectivity largest*weight, center (4-d)*3.

pub fn eval_heuristic(
    board: &Board,
    me: u8,
    opp: u8,
    pi: &PatternIndex,
    moves_played: i32,
    ctx: &mut EvalContext,
) -> i32 {
    let mut score: i32 = 0;
    score += line_score(board, me, opp, pi, ctx);
    score += pattern_score(board, me, opp, pi, ctx);
    score += connectivity_score(board, me, opp, moves_played);
    score += center_score(board, me, opp);
    score
}

fn line_score(board: &Board, me: u8, opp: u8, pi: &PatternIndex, ctx: &mut EvalContext) -> i32 {
    let mut score: i32 = 0;
    ctx.seen_l.iter_mut().for_each(|x| *x = false);
    for i in 0..CELLS {
        if board[i] == 0 {
            continue;
        }
        for &li in &pi.cell_lines[i] {
            let li = li as usize;
            if li >= 1024 || ctx.seen_l[li] {
                continue;
            }
            ctx.seen_l[li] = true;
            let win = &pi.line_cells[li];
            let mut mine = 0i32;
            let mut theirs = 0i32;
            for &ci in win {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                let m4 = mine * mine * mine * mine;
                score += m4 * 25;
            } else if theirs > 0 && mine == 0 {
                let t4 = theirs * theirs * theirs * theirs;
                score -= t4 * 35;
            }
        }
    }
    score
}

fn pattern_score(board: &Board, me: u8, opp: u8, pi: &PatternIndex, ctx: &mut EvalContext) -> i32 {
    let mut score: i32 = 0;
    ctx.seen_p.iter_mut().for_each(|x| *x = false);
    for i in 0..CELLS {
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
                score += m4 * 45;
            } else if theirs > 0 && mine == 0 {
                let t4 = theirs * theirs * theirs * theirs;
                score -= t4 * 65;
            }
        }
    }
    score
}

pub fn largest_connected(board: &Board, player: u8) -> i32 {
    let t = tables();
    let mut visited = [false; CELLS];
    let mut best = 0i32;
    let mut q = VecDeque::new();
    for i in 0..CELLS {
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

fn connectivity_score(board: &Board, me: u8, opp: u8, moves_played: i32) -> i32 {
    let weight = 3.0 + (moves_played as f64 / 49.0) * 12.0;
    let my_conn = largest_connected(board, me);
    let op_conn = largest_connected(board, opp);
    ((my_conn - op_conn) as f64 * weight) as i32
}

fn center_score(board: &Board, me: u8, opp: u8) -> i32 {
    let t = tables();
    let mut score = 0i32;
    for i in 0..CELLS {
        let dist = t.center_dist[i] as i32;
        let bonus = (4 - dist).max(0) * 3;
        if board[i] == me {
            score += bonus;
        } else if board[i] == opp {
            score -= bonus;
        }
    }
    score
}

pub fn eval_full_hard(board: &Board, me: u8, opp: u8) -> i32 {
    let my_conn = largest_connected(board, me);
    let opp_conn = largest_connected(board, opp);
    let my_has20 = my_conn >= 20;
    let opp_has20 = opp_conn >= 20;
    if my_has20 && !opp_has20 {
        800_000
    } else if opp_has20 && !my_has20 {
        -800_000
    } else {
        (my_conn - opp_conn) * 500
    }
}
