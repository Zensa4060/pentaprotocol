use crate::board6::{tables6, Board6, CELLS6, EvalContext6};
use crate::patterns6::PatternIndex6;
use std::collections::VecDeque;

const THREAT_MY6: [i32; 7] = [0, 3, 35, 380, 3200, 28_000, 1_000_000];
const THREAT_OPP6: [i32; 7] = [0, 4, 50, 520, 4300, 36_000, 1_000_000];
const PATH_DFS_BUDGET6: i32 = 2600;
const TARGET_CHAIN6: usize = 15;

pub fn evaluate6(
    board: &Board6,
    me: u8,
    opp: u8,
    pi: &PatternIndex6,
    moves_played: i32,
    ctx: &mut EvalContext6,
) -> i32 {
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
            let mut mine = 0usize;
            let mut theirs = 0usize;
            for &ci in line {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                score += THREAT_MY6[mine];
            } else if theirs > 0 && mine == 0 {
                score -= THREAT_OPP6[theirs];
            }
        }
    }

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
            let mut mine = 0usize;
            let mut theirs = 0usize;
            for &ci in cells {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                score += THREAT_MY6[mine];
            } else if theirs > 0 && mine == 0 {
                score -= THREAT_OPP6[theirs];
            }
        }
    }

    score += connectivity_eval6(board, me, opp, moves_played, ctx);

    let t = tables6();
    for i in 0..CELLS6 {
        let b = (5i32 - t.center_dist[i] as i32).max(0) * 3;
        if board[i] == me {
            score += b;
        } else if board[i] == opp {
            score -= b;
        }
    }

    if moves_played >= 24 {
        let my_p = path_estimate6(board, me, ctx) as i32;
        let opp_p = path_estimate6(board, opp, ctx) as i32;
        let pw = 22.0 + (moves_played - 24) as f64 * 7.0;
        score += ((my_p - opp_p) as f64 * pw) as i32;
    }
    score
}

fn components6(board: &Board6, player: u8, vis: &mut [bool; CELLS6]) -> Vec<Vec<usize>> {
    let t = tables6();
    vis.iter_mut().for_each(|x| *x = false);
    let mut comps = Vec::with_capacity(8);
    let mut q = VecDeque::with_capacity(CELLS6);
    for i in 0..CELLS6 {
        if board[i] != player || vis[i] {
            continue;
        }
        let mut comp = Vec::new();
        q.push_back(i);
        vis[i] = true;
        while let Some(ci) = q.pop_front() {
            comp.push(ci);
            for &ni in &t.neighbors[ci] {
                if board[ni] == player && !vis[ni] {
                    vis[ni] = true;
                    q.push_back(ni);
                }
            }
        }
        comps.push(comp);
    }
    comps
}

fn bridge_bonus6(board: &Board6, player: u8, comps: &[Vec<usize>]) -> i32 {
    if comps.len() < 2 {
        return 0;
    }
    let t = tables6();
    let mut cid = [0u16; CELLS6];
    for (ci, comp) in comps.iter().enumerate() {
        let id = (ci + 1) as u16;
        for &idx in comp {
            cid[idx] = id;
        }
    }
    let mut bonus = 0i32;
    for i in 0..CELLS6 {
        if board[i] != 0 {
            continue;
        }
        let mut first_comp: u16 = 0;
        let mut found_bridge = false;
        for &ni in &t.neighbors[i] {
            if board[ni] == player {
                let c = cid[ni];
                if first_comp == 0 {
                    first_comp = c;
                } else if c != first_comp {
                    found_bridge = true;
                    break;
                }
            }
        }
        if found_bridge {
            bonus += 10;
        }
    }
    bonus
}

fn connectivity_eval6(board: &Board6, me: u8, opp: u8, mp: i32, ctx: &mut EvalContext6) -> i32 {
    let my_c = components6(board, me, &mut ctx.vis);
    let opp_c = components6(board, opp, &mut ctx.vis);

    let my_big = my_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    let opp_big = opp_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    let my_frag = (my_c.len() as i32 - 1).max(0) * 16;
    let opp_frag = (opp_c.len() as i32 - 1).max(0) * 16;
    let my_br = bridge_bonus6(board, me, &my_c);
    let opp_br = bridge_bonus6(board, opp, &opp_c);

    let w = 4.0 + (mp as f64 / 36.0) * 20.0;
    (((my_big - my_frag + my_br) - (opp_big - opp_frag + opp_br)) as f64 * w) as i32
}

pub fn path_estimate6(board: &Board6, player: u8, ctx: &mut EvalContext6) -> usize {
    let comps = components6(board, player, &mut ctx.vis);
    if comps.is_empty() {
        return 0;
    }
    let largest = comps.iter().max_by_key(|c| c.len()).unwrap();
    let sz = largest.len();
    if sz < 8 {
        return sz;
    }

    let t = tables6();
    let mut best: usize = 0;
    let mut budget = PATH_DFS_BUDGET6;

    fn dfs(
        board: &Board6,
        player: u8,
        idx: usize,
        length: usize,
        best: &mut usize,
        budget: &mut i32,
        vis: &mut [bool; CELLS6],
        neighbors: &[Vec<usize>],
    ) {
        *budget -= 1;
        if length > *best {
            *best = length;
        }
        if *best >= TARGET_CHAIN6 || *budget <= 0 {
            return;
        }
        for &ni in &neighbors[idx] {
            if board[ni] == player && !vis[ni] {
                vis[ni] = true;
                dfs(board, player, ni, length + 1, best, budget, vis, neighbors);
                vis[ni] = false;
            }
        }
    }

    let mut starts = largest.clone();
    starts.sort_by_key(|&x| t.neighbors[x].iter().filter(|&&ni| board[ni] == player).count());
    for &s in starts.iter().take(6) {
        if budget <= 0 || best >= TARGET_CHAIN6 {
            break;
        }
        let mut local_vis = [false; CELLS6];
        local_vis[s] = true;
        dfs(board, player, s, 1, &mut best, &mut budget, &mut local_vis, &t.neighbors);
    }
    best
}

pub fn eval_full_god6(board: &Board6, me: u8, opp: u8, ctx: &mut EvalContext6) -> i32 {
    let my_ok = path_estimate6(board, me, ctx) >= TARGET_CHAIN6;
    let opp_ok = path_estimate6(board, opp, ctx) >= TARGET_CHAIN6;
    if my_ok && !opp_ok {
        return 800_000;
    }
    if opp_ok && !my_ok {
        return -800_000;
    }
    let my_c = components6(board, me, &mut ctx.vis);
    let opp_c = components6(board, opp, &mut ctx.vis);
    let my_big = my_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    let opp_big = opp_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    (my_big - opp_big) * 500
}
