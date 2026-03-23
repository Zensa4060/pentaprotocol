use crate::board::{tables, Board, CELLS};
use crate::patterns::PatternIndex;
use std::collections::VecDeque;

/// Threat-level score tables (index = count of friendly stones in a window).
const THREAT_MY: [i32; 8] = [0, 2, 30, 300, 2500, 15000, 100_000, 1_000_000];
const THREAT_OPP: [i32; 8] = [0, 3, 45, 450, 3800, 22000, 150_000, 1_000_000];
const PATH_DFS_BUDGET: i32 = 4000;

pub fn evaluate(
    board: &Board,
    me: u8,
    opp: u8,
    pi: &PatternIndex,
    moves_played: i32,
) -> i32 {
    let mut score: i32 = 0;

    // 1. Line windows
    let mut seen_l = vec![false; pi.line_cells.len()];
    for i in 0..CELLS {
        if board[i] == 0 {
            continue;
        }
        for &li in &pi.cell_lines[i] {
            let li = li as usize;
            if seen_l[li] {
                continue;
            }
            seen_l[li] = true;
            let win = &pi.line_cells[li];
            let mut mine = 0usize;
            let mut theirs = 0usize;
            for &ci in win {
                let v = board[ci];
                if v == me {
                    mine += 1;
                } else if v == opp {
                    theirs += 1;
                }
            }
            if mine > 0 && theirs == 0 {
                score += THREAT_MY[mine];
            } else if theirs > 0 && mine == 0 {
                score -= THREAT_OPP[theirs];
            }
        }
    }

    // 2. Pattern placements
    let mut seen_p = vec![false; pi.pat_cells.len()];
    for i in 0..CELLS {
        if board[i] == 0 {
            continue;
        }
        for &pat_idx in &pi.cell_pats[i] {
            let pat_idx = pat_idx as usize;
            if seen_p[pat_idx] {
                continue;
            }
            seen_p[pat_idx] = true;
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
                score += THREAT_MY[mine];
            } else if theirs > 0 && mine == 0 {
                score -= THREAT_OPP[theirs];
            }
        }
    }

    // 3. Connectivity
    score += connectivity_eval(board, me, opp, moves_played);

    // 4. Centre control
    let t = tables();
    for i in 0..CELLS {
        let b = (4i32 - t.center_dist[i] as i32).max(0) << 2;
        if board[i] == me {
            score += b;
        } else if board[i] == opp {
            score -= b;
        }
    }

    // 5. Late-game path planning
    if moves_played >= 35 {
        let my_p = path_estimate(board, me) as i32;
        let opp_p = path_estimate(board, opp) as i32;
        let pw = 25.0 + (moves_played - 35) as f64 * 8.0;
        score += ((my_p - opp_p) as f64 * pw) as i32;
    }

    score
}

// ── connectivity ──

fn components(board: &Board, player: u8) -> Vec<Vec<usize>> {
    let t = tables();
    let mut vis = [false; CELLS];
    let mut comps = Vec::new();
    let mut q = VecDeque::new();
    for i in 0..CELLS {
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

fn bridge_bonus(board: &Board, player: u8, comps: &[Vec<usize>]) -> i32 {
    if comps.len() < 2 {
        return 0;
    }
    let t = tables();
    let mut cid = [0u16; CELLS];
    for (ci, comp) in comps.iter().enumerate() {
        let id = (ci + 1) as u16;
        for &idx in comp {
            cid[idx] = id;
        }
    }
    let mut bonus = 0i32;
    for i in 0..CELLS {
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
            bonus += 12;
        }
    }
    bonus
}

fn connectivity_eval(board: &Board, me: u8, opp: u8, mp: i32) -> i32 {
    let my_c = components(board, me);
    let opp_c = components(board, opp);

    let my_big = my_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    let opp_big = opp_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);

    let my_frag = (my_c.len() as i32 - 1).max(0) * 18;
    let opp_frag = (opp_c.len() as i32 - 1).max(0) * 18;

    let my_br = bridge_bonus(board, me, &my_c);
    let opp_br = bridge_bonus(board, opp, &opp_c);

    let w = 3.0 + (mp as f64 / 49.0) * 20.0;
    (((my_big - my_frag + my_br) - (opp_big - opp_frag + opp_br)) as f64 * w) as i32
}

// ── endgame path estimation ──

pub fn path_estimate(board: &Board, player: u8) -> usize {
    let comps = components(board, player);
    if comps.is_empty() {
        return 0;
    }
    let largest = comps.iter().max_by_key(|c| c.len()).unwrap();
    let sz = largest.len();
    if sz < 10 {
        return sz;
    }

    let t = tables();
    let mut best: usize = 0;
    let mut budget = PATH_DFS_BUDGET;

    fn dfs(
        board: &Board,
        player: u8,
        idx: usize,
        length: usize,
        best: &mut usize,
        budget: &mut i32,
        vis: &mut [bool; CELLS],
        neighbors: &[Vec<usize>],
    ) {
        *budget -= 1;
        if length > *best {
            *best = length;
        }
        if *best >= 20 || *budget <= 0 {
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
    starts.sort_by_key(|&x| {
        t.neighbors[x]
            .iter()
            .filter(|&&ni| board[ni] == player)
            .count()
    });

    for &s in starts.iter().take(6) {
        if budget <= 0 || best >= 20 {
            break;
        }
        let mut vis = [false; CELLS];
        vis[s] = true;
        dfs(
            board,
            player,
            s,
            1,
            &mut best,
            &mut budget,
            &mut vis,
            &t.neighbors,
        );
    }
    best
}

pub fn eval_full_danger(board: &Board, me: u8, opp: u8) -> i32 {
    let my_ok = path_estimate(board, me) >= 20;
    let opp_ok = path_estimate(board, opp) >= 20;
    if my_ok && !opp_ok {
        return 800_000;
    }
    if opp_ok && !my_ok {
        return -800_000;
    }
    let my_c = components(board, me);
    let opp_c = components(board, opp);
    let my_big = my_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    let opp_big = opp_c.iter().map(|c| c.len() as i32).max().unwrap_or(0);
    (my_big - opp_big) * 500
}
