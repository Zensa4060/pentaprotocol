use crate::board::{tables, make, unmake, Board, CELLS, CENTER_IDX, INF};
use crate::eval_danger::{eval_full_danger, evaluate};
use crate::patterns::PatternIndex;
use crate::wins::wins_at;
use std::collections::HashMap;
use std::time::Instant;

const MAX_DEPTH: usize = 16;
const QSEARCH_DEPTH: i32 = 4;

const TT_FLAG_EXACT: u8 = 0;
const TT_FLAG_LOWER: u8 = 1;
const TT_FLAG_UPPER: u8 = 2;

#[derive(Clone, Copy)]
struct TTEntry {
    depth: i32,
    value: i32,
    flag: u8,
    best_move: Option<u8>,
}

pub struct DangerSearch {
    tt: HashMap<(u64, u8), TTEntry>,
    history: [i32; CELLS],
    killers: [[Option<u8>; 2]; MAX_DEPTH + 8],
    start: Instant,
    budget: f64,
    max_depth: i32,
    nodes: u64,
}

impl DangerSearch {
    pub fn new(max_depth: i32, budget: f64) -> Self {
        DangerSearch {
            tt: HashMap::with_capacity(1 << 20),
            history: [0; CELLS],
            killers: [[None; 2]; MAX_DEPTH + 8],
            start: Instant::now(),
            budget,
            max_depth,
            nodes: 0,
        }
    }

    fn timed_out(&self) -> bool {
        self.nodes & 0x1FF == 0 && self.start.elapsed().as_secs_f64() >= self.budget
    }

    fn get_forcing(&self, board: &Board, me: u8, opp: u8, pi: &PatternIndex) -> Vec<usize> {
        let empties: Vec<usize> = (0..CELLS).filter(|&i| board[i] == 0).collect();
        let mut result = Vec::new();
        let mut board_copy = *board;

        for &mv in &empties {
            make(&mut board_copy, mv, me);
            if wins_at(&board_copy, mv, me, pi) {
                unmake(&mut board_copy, mv);
                result.push(mv);
                continue;
            }
            unmake(&mut board_copy, mv);

            make(&mut board_copy, mv, opp);
            if wins_at(&board_copy, mv, opp, pi) {
                unmake(&mut board_copy, mv);
                result.push(mv);
                continue;
            }
            unmake(&mut board_copy, mv);
        }
        result
    }

    fn quiescence(
        &mut self,
        board: &mut Board,
        zhash: u64,
        pi: &PatternIndex,
        me: u8,
        opp: u8,
        mut alpha: i32,
        beta: i32,
        qdepth: i32,
        moves_played: i32,
    ) -> i32 {
        self.nodes += 1;

        let stand = evaluate(board, me, opp, pi, moves_played);
        if stand >= beta {
            return stand;
        }
        if stand > alpha {
            alpha = stand;
        }
        if qdepth <= 0 || self.timed_out() {
            return stand;
        }

        let forcing = self.get_forcing(board, me, opp, pi);
        if forcing.is_empty() {
            return stand;
        }

        let t = tables();
        for mv in forcing {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make(board, mv, me);

            if wins_at(board, mv, me, pi) {
                unmake(board, mv);
                return INF - 1;
            }

            let val = -self.quiescence(board, z_new, pi, opp, me, -beta, -alpha, qdepth - 1, moves_played + 1);
            unmake(board, mv);

            if self.timed_out() {
                return 0;
            }
            if val >= beta {
                return val;
            }
            if val > alpha {
                alpha = val;
            }
        }
        alpha
    }

    fn order_moves(
        &self,
        empties: &[usize],
        zhash: u64,
        me: u8,
        ply: usize,
    ) -> Vec<usize> {
        let t = tables();
        let tt_best = self
            .tt
            .get(&(zhash, me))
            .and_then(|e| e.best_move)
            .map(|m| m as usize);

        let k0 = self.killers[ply][0].map(|m| m as usize);
        let k1 = self.killers[ply][1].map(|m| m as usize);

        let mut scored: Vec<(i32, usize)> = empties
            .iter()
            .map(|&mv| {
                let mut s: i32 = 0;
                if Some(mv) == tt_best {
                    s += 1_000_000;
                }
                if Some(mv) == k0 || Some(mv) == k1 {
                    s += 500_000;
                }
                s += self.history[mv] * 100;
                s += (4i32 - t.center_dist[mv] as i32).max(0) * 10;
                (-s, mv)
            })
            .collect();
        scored.sort_unstable();
        scored.into_iter().map(|(_, mv)| mv).collect()
    }

    fn negamax(
        &mut self,
        board: &mut Board,
        zhash: u64,
        pi: &PatternIndex,
        me: u8,
        opp: u8,
        depth: i32,
        mut alpha: i32,
        beta: i32,
        ply: usize,
        moves_played: i32,
    ) -> i32 {
        self.nodes += 1;
        if self.timed_out() {
            return 0;
        }

        let key = (zhash, me);
        if let Some(entry) = self.tt.get(&key) {
            if entry.depth >= depth {
                match entry.flag {
                    TT_FLAG_EXACT => return entry.value,
                    TT_FLAG_LOWER => {
                        if entry.value >= beta {
                            return entry.value;
                        }
                    }
                    TT_FLAG_UPPER => {
                        if entry.value <= alpha {
                            return entry.value;
                        }
                    }
                    _ => {}
                }
            }
        }

        if depth <= 0 {
            return self.quiescence(board, zhash, pi, me, opp, alpha, beta, QSEARCH_DEPTH, moves_played);
        }

        let empties: Vec<usize> = (0..CELLS).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return eval_full_danger(board, me, opp);
        }

        let moves = self.order_moves(&empties, zhash, me, ply);

        let t = tables();
        let mut best_val = -INF;
        let mut best_mv: Option<u8> = None;
        let mut flag = TT_FLAG_UPPER;

        for &mv in moves.iter() {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make(board, mv, me);

            if wins_at(board, mv, me, pi) {
                unmake(board, mv);
                let val = INF - 1;
                self.tt.insert(
                    key,
                    TTEntry { depth, value: val, flag: TT_FLAG_EXACT, best_move: Some(mv as u8) },
                );
                return val;
            }

            let val = -self.negamax(
                board, z_new, pi, opp, me, depth - 1, -beta, -alpha, ply + 1, moves_played + 1,
            );
            unmake(board, mv);

            if self.timed_out() {
                return 0;
            }

            if val > best_val {
                best_val = val;
                best_mv = Some(mv as u8);
            }
            if val > alpha {
                alpha = val;
                flag = TT_FLAG_EXACT;
                self.history[mv] += depth * depth;
            }
            if alpha >= beta {
                flag = TT_FLAG_LOWER;
                self.history[mv] += depth * depth;
                // Store killer
                if ply < MAX_DEPTH + 8 {
                    let k = &mut self.killers[ply];
                    if k[0] != Some(mv as u8) {
                        k[1] = k[0];
                        k[0] = Some(mv as u8);
                    }
                }
                break;
            }
        }

        self.tt.insert(key, TTEntry { depth, value: best_val, flag, best_move: best_mv });
        best_val
    }

    fn opening_move(&self, board: &Board, moves_played: i32, c3_blocked: bool) -> Option<usize> {
        if moves_played > 2 {
            return None;
        }
        if moves_played == 0 {
            if !c3_blocked && board[CENTER_IDX] == 0 {
                return Some(CENTER_IDX);
            }
        }
        // Pick best available near-center cell
        let t = tables();
        let center_area: Vec<usize> = {
            let mut cs: Vec<(u8, usize)> = (0..CELLS)
                .filter(|&i| board[i] == 0)
                .map(|i| (t.center_dist[i], i))
                .collect();
            cs.sort_unstable();
            cs.into_iter().map(|(_, i)| i).collect()
        };
        center_area.into_iter().next()
    }

    fn count_threat_cells(&self, board: &Board, player: u8, pi: &PatternIndex) -> usize {
        let mut count = 0;
        let mut board_copy = *board;
        for i in 0..CELLS {
            if board_copy[i] != 0 {
                continue;
            }
            make(&mut board_copy, i, player);
            if wins_at(&board_copy, i, player, pi) {
                count += 1;
            }
            unmake(&mut board_copy, i);
        }
        count
    }

    pub fn search(
        &mut self,
        board: &mut Board,
        zhash: u64,
        pi: &PatternIndex,
        me: u8,
        opp: u8,
        moves_played: i32,
        c3_blocked: bool,
    ) -> Option<usize> {
        self.start = Instant::now();
        self.tt.clear();
        self.history = [0; CELLS];
        self.killers = [[None; 2]; MAX_DEPTH + 8];
        self.nodes = 0;

        // Opening book
        if let Some(mv) = self.opening_move(board, moves_played, c3_blocked) {
            return Some(mv);
        }

        let empties: Vec<usize> = (0..CELLS).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return None;
        }

        let t = tables();

        // Immediate win check
        for &mv in &empties {
            make(board, mv, me);
            if wins_at(board, mv, me, pi) {
                unmake(board, mv);
                return Some(mv);
            }
            unmake(board, mv);
        }

        // Immediate block check
        for &mv in &empties {
            make(board, mv, opp);
            if wins_at(board, mv, opp, pi) {
                unmake(board, mv);
                return Some(mv);
            }
            unmake(board, mv);
        }

        // Fork detection: if opponent has >=2 winning cells, pick best block as starting point
        let mut best_move = empties[0];
        let opp_threats = self.count_threat_cells(board, opp, pi);
        if opp_threats >= 2 {
            let mut best_score = -INF;
            for &mv in &empties {
                make(board, mv, me);
                let remaining = self.count_threat_cells(board, opp, pi);
                let sc = -(remaining as i32) * 10000 + evaluate(board, me, opp, pi, moves_played);
                if sc > best_score {
                    best_score = sc;
                    best_move = mv;
                }
                unmake(board, mv);
            }
        }

        for depth in 1..=self.max_depth {
            if self.start.elapsed().as_secs_f64() >= self.budget {
                break;
            }

            let moves = self.order_moves(&empties, zhash, me, 0);

            let mut current_best = moves[0];
            let mut current_val = -INF;

            for &mv in &moves {
                let z_new = zhash ^ t.zobrist[mv][me as usize];
                make(board, mv, me);

                if wins_at(board, mv, me, pi) {
                    unmake(board, mv);
                    return Some(mv);
                }

                let val = -self.negamax(
                    board, z_new, pi, opp, me, depth - 1, -INF, -current_val.max(-INF + 1), 1, moves_played + 1,
                );
                unmake(board, mv);

                if self.timed_out() {
                    break;
                }

                if val > current_val {
                    current_val = val;
                    current_best = mv;
                }
            }

            if !self.timed_out() {
                best_move = current_best;
            }
        }

        Some(best_move)
    }
}
