use crate::board6::{tables6, make6, unmake6, Board6, CELLS6, INF6, EvalContext6};
use crate::eval6_hard::{eval_full_hard6, eval_heuristic6};
use crate::patterns6::PatternIndex6;
use crate::wins6::wins_at6;
use std::time::Instant;

const TT_FLAG_EXACT: u8 = 0;
const TT_FLAG_LOWER: u8 = 1;
const TT_FLAG_UPPER: u8 = 2;

#[derive(Clone, Copy, Default)]
struct TTEntry6 {
    zhash: u64,
    depth: i32,
    value: i32,
    flag: u8,
}

const TT_SIZE6: usize = 1 << 18;

pub struct HardSearch6 {
    tt: Vec<TTEntry6>,
    history: [i32; CELLS6],
    start: Instant,
    budget: f64,
    max_depth: i32,
    nodes: u64,
    ctx: EvalContext6,
}

impl HardSearch6 {
    pub fn new(max_depth: i32, budget: f64) -> Self {
        HardSearch6 {
            tt: vec![TTEntry6::default(); TT_SIZE6],
            history: [0; CELLS6],
            start: Instant::now(),
            budget,
            max_depth,
            nodes: 0,
            ctx: EvalContext6::default(),
        }
    }

    fn timed_out(&self) -> bool {
        self.nodes & 0x3FF == 0 && self.start.elapsed().as_secs_f64() >= self.budget
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
            return eval_heuristic6(board, me, opp, pi, moves_played, &mut self.ctx);
        }

        let t = tables6();
        let empties: Vec<usize> = (0..CELLS6).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return eval_full_hard6(board, me, opp);
        }

        let mut moves: Vec<(i32, usize)> = empties.iter().map(|&i| (-self.history[i], i)).collect();
        moves.sort_unstable();

        let mut best_val = -INF6;
        let mut flag = TT_FLAG_UPPER;
        for &(_, mv) in &moves {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make6(board, mv, me);

            if wins_at6(board, mv, me, pi) {
                unmake6(board, mv);
                let val = INF6 - 1;
                self.tt[tt_idx] = TTEntry6 { zhash, depth, value: val, flag: TT_FLAG_EXACT };
                return val;
            }

            let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -beta, -alpha, moves_played + 1);
            unmake6(board, mv);

            if self.timed_out() {
                return 0;
            }
            if val > best_val {
                best_val = val;
            }
            if val > alpha {
                alpha = val;
                flag = TT_FLAG_EXACT;
                self.history[mv] += depth * depth;
            }
            if alpha >= beta {
                flag = TT_FLAG_LOWER;
                self.history[mv] += depth * depth;
                break;
            }
        }

        self.tt[tt_idx] = TTEntry6 { zhash, depth, value: best_val, flag };
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
        self.nodes = 0;

        let t = tables6();
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

        let mut best_move = empties[0];
        for depth in 1..=self.max_depth {
            if self.start.elapsed().as_secs_f64() >= self.budget {
                break;
            }
            let mut current_best = best_move;
            let mut current_val = -INF6;

            let mut moves: Vec<(i32, usize)> = empties.iter().map(|&i| (-self.history[i], i)).collect();
            moves.sort_unstable();
            for &(_, mv) in &moves {
                let z_new = zhash ^ t.zobrist[mv][me as usize];
                make6(board, mv, me);
                if wins_at6(board, mv, me, pi) {
                    unmake6(board, mv);
                    return Some(mv);
                }
                let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -INF6, -current_val.max(-INF6 + 1), moves_played + 1);
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
