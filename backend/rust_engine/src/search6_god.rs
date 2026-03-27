use crate::board6::{tables6, make6, unmake6, Board6, CELLS6, INF6, EvalContext6};
use crate::eval6_god::{eval_full_god6, evaluate6};
use crate::patterns6::PatternIndex6;
use crate::wins6::wins_at6;
use std::time::Instant;

const MAX_DEPTH6: usize = 14;
const QSEARCH_DEPTH6: i32 = 3;

const TT_FLAG_EXACT: u8 = 0;
const TT_FLAG_LOWER: u8 = 1;
const TT_FLAG_UPPER: u8 = 2;

#[derive(Clone, Copy, Default)]
struct TTEntry6 {
    zhash: u64,
    depth: i32,
    value: i32,
    flag: u8,
    best_move: Option<u8>,
}

const TT_SIZE6: usize = 1 << 19;

pub struct GodSearch6 {
    tt: Vec<TTEntry6>,
    history: [i32; CELLS6],
    killers: [[Option<u8>; 2]; MAX_DEPTH6 + 8],
    start: Instant,
    budget: f64,
    max_depth: i32,
    nodes: u64,
    ctx: EvalContext6,
}

impl GodSearch6 {
    pub fn new(max_depth: i32, budget: f64) -> Self {
        GodSearch6 {
            tt: vec![TTEntry6::default(); TT_SIZE6],
            history: [0; CELLS6],
            killers: [[None; 2]; MAX_DEPTH6 + 8],
            start: Instant::now(),
            budget,
            max_depth,
            nodes: 0,
            ctx: EvalContext6::default(),
        }
    }

    fn timed_out(&self) -> bool {
        self.nodes & 0x1FF == 0 && self.start.elapsed().as_secs_f64() >= self.budget
    }

    fn get_forcing(&self, board: &Board6, me: u8, opp: u8, pi: &PatternIndex6) -> Vec<usize> {
        let empties: Vec<usize> = (0..CELLS6).filter(|&i| board[i] == 0).collect();
        let mut result = Vec::new();
        let mut copy = *board;
        for &mv in &empties {
            make6(&mut copy, mv, me);
            if wins_at6(&copy, mv, me, pi) {
                unmake6(&mut copy, mv);
                result.push(mv);
                continue;
            }
            unmake6(&mut copy, mv);

            make6(&mut copy, mv, opp);
            if wins_at6(&copy, mv, opp, pi) {
                unmake6(&mut copy, mv);
                result.push(mv);
                continue;
            }
            unmake6(&mut copy, mv);
        }
        result
    }

    fn quiescence(
        &mut self,
        board: &mut Board6,
        zhash: u64,
        pi: &PatternIndex6,
        me: u8,
        opp: u8,
        mut alpha: i32,
        beta: i32,
        qdepth: i32,
        moves_played: i32,
    ) -> i32 {
        self.nodes += 1;
        let stand = evaluate6(board, me, opp, pi, moves_played, &mut self.ctx);
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

        let t = tables6();
        for mv in forcing {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make6(board, mv, me);
            if wins_at6(board, mv, me, pi) {
                unmake6(board, mv);
                return INF6 - 1;
            }
            let val = -self.quiescence(board, z_new, pi, opp, me, -beta, -alpha, qdepth - 1, moves_played + 1);
            unmake6(board, mv);
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

    fn order_moves(&self, empties: &[usize], zhash: u64, ply: usize) -> Vec<usize> {
        let t = tables6();
        let tt_best = {
            let entry = &self.tt[(zhash as usize) & (TT_SIZE6 - 1)];
            if entry.zhash == zhash { entry.best_move.map(|m| m as usize) } else { None }
        };
        let k0 = self.killers[ply][0].map(|m| m as usize);
        let k1 = self.killers[ply][1].map(|m| m as usize);

        let mut scored: Vec<(i32, usize)> = empties.iter().map(|&mv| {
            let mut s: i32 = 0;
            if Some(mv) == tt_best { s += 1_000_000; }
            if Some(mv) == k0 || Some(mv) == k1 { s += 450_000; }
            s += self.history[mv] * 100;
            s += (5i32 - t.center_dist[mv] as i32).max(0) * 10;
            (-s, mv)
        }).collect();
        scored.sort_unstable();
        scored.into_iter().map(|(_, mv)| mv).collect()
    }

    fn negamax(
        &mut self,
        board: &mut Board6,
        zhash: u64,
        pi: &PatternIndex6,
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

        let tt_idx = (zhash as usize) & (TT_SIZE6 - 1);
        {
            let entry = &self.tt[tt_idx];
            if entry.zhash == zhash && entry.depth >= depth {
                match entry.flag {
                    TT_FLAG_EXACT => return entry.value,
                    TT_FLAG_LOWER => if entry.value >= beta { return entry.value; },
                    TT_FLAG_UPPER => if entry.value <= alpha { return entry.value; },
                    _ => {}
                }
            }
        }

        if depth <= 0 {
            return self.quiescence(board, zhash, pi, me, opp, alpha, beta, QSEARCH_DEPTH6, moves_played);
        }

        let empties: Vec<usize> = (0..CELLS6).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return eval_full_god6(board, me, opp, &mut self.ctx);
        }

        let moves = self.order_moves(&empties, zhash, ply);
        let t = tables6();
        let mut best_val = -INF6;
        let mut best_mv: Option<u8> = None;
        let mut flag = TT_FLAG_UPPER;

        for &mv in &moves {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make6(board, mv, me);

            if wins_at6(board, mv, me, pi) {
                unmake6(board, mv);
                let val = INF6 - 1;
                self.tt[tt_idx] = TTEntry6 { zhash, depth, value: val, flag: TT_FLAG_EXACT, best_move: Some(mv as u8) };
                return val;
            }

            let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -beta, -alpha, ply + 1, moves_played + 1);
            unmake6(board, mv);

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
                if ply < MAX_DEPTH6 + 8 {
                    let k = &mut self.killers[ply];
                    if k[0] != Some(mv as u8) {
                        k[1] = k[0];
                        k[0] = Some(mv as u8);
                    }
                }
                break;
            }
        }

        self.tt[tt_idx] = TTEntry6 { zhash, depth, value: best_val, flag, best_move: best_mv };
        best_val
    }

    pub fn search(
        &mut self,
        board: &mut Board6,
        zhash: u64,
        pi: &PatternIndex6,
        me: u8,
        opp: u8,
        moves_played: i32,
    ) -> Option<usize> {
        self.start = Instant::now();
        self.history = [0; CELLS6];
        self.killers = [[None; 2]; MAX_DEPTH6 + 8];
        self.nodes = 0;

        let empties: Vec<usize> = (0..CELLS6).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return None;
        }

        for &mv in &empties {
            make6(board, mv, me);
            if wins_at6(board, mv, me, pi) {
                unmake6(board, mv);
                return Some(mv);
            }
            unmake6(board, mv);
        }
        for &mv in &empties {
            make6(board, mv, opp);
            if wins_at6(board, mv, opp, pi) {
                unmake6(board, mv);
                return Some(mv);
            }
            unmake6(board, mv);
        }

        let t = tables6();
        let mut best_move = empties[0];
        for depth in 1..=self.max_depth {
            if self.start.elapsed().as_secs_f64() >= self.budget {
                break;
            }
            let moves = self.order_moves(&empties, zhash, 0);
            let mut current_best = moves[0];
            let mut current_val = -INF6;
            for &mv in &moves {
                let z_new = zhash ^ t.zobrist[mv][me as usize];
                make6(board, mv, me);
                if wins_at6(board, mv, me, pi) {
                    unmake6(board, mv);
                    return Some(mv);
                }
                let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -INF6, -current_val.max(-INF6 + 1), 1, moves_played + 1);
                unmake6(board, mv);
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
