use crate::board::{tables, make, unmake, Board, CELLS, INF, EvalContext};
use crate::eval_hard::{eval_full_hard, eval_heuristic};
use crate::patterns::PatternIndex;
use crate::wins::wins_at;
use std::time::Instant;

const TT_FLAG_EXACT: u8 = 0;
const TT_FLAG_LOWER: u8 = 1;
const TT_FLAG_UPPER: u8 = 2;

#[derive(Clone, Copy, Default)]
struct TTEntry {
    zhash: u64,
    depth: i32,
    value: i32,
    flag: u8,
}

const TT_SIZE: usize = 1 << 19; // ~512k entries for Hard mode

pub struct HardSearch {
    tt: Vec<TTEntry>,
    history: [i32; CELLS],
    start: Instant,
    budget: f64,
    max_depth: i32,
    nodes: u64,
    ctx: EvalContext,
}

impl HardSearch {
    pub fn new(max_depth: i32, budget: f64) -> Self {
        HardSearch {
            tt: vec![TTEntry::default(); TT_SIZE],
            history: [0; CELLS],
            start: Instant::now(),
            budget,
            max_depth,
            nodes: 0,
            ctx: EvalContext::default(),
        }
    }

    fn timed_out(&self) -> bool {
        self.nodes & 0x3FF == 0 && self.start.elapsed().as_secs_f64() >= self.budget
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
        moves_played: i32,
    ) -> i32 {
        self.nodes += 1;
        if self.timed_out() {
            return 0;
        }

        let tt_idx = (zhash as usize) & (TT_SIZE - 1);
        {
            let entry = &self.tt[tt_idx];
            if entry.zhash == zhash {
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
        }

        if depth <= 0 {
            return eval_heuristic(board, me, opp, pi, moves_played, &mut self.ctx);
        }

        let t = tables();
        let empties: Vec<usize> = (0..CELLS).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return eval_full_hard(board, me, opp);
        }

        let mut moves: Vec<(i32, usize)> = empties
            .iter()
            .map(|&i| (-self.history[i], i))
            .collect();
        moves.sort_unstable();

        let mut best_val = -INF;
        let mut flag = TT_FLAG_UPPER;

        for &(_, mv) in &moves {
            let z_new = zhash ^ t.zobrist[mv][me as usize];
            make(board, mv, me);

            if wins_at(board, mv, me, pi) {
                unmake(board, mv);
                let val = INF - 1;
                self.tt[tt_idx] = TTEntry { zhash, depth, value: val, flag: TT_FLAG_EXACT };
                return val;
            }

            let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -beta, -alpha, moves_played + 1);
            unmake(board, mv);

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

        self.tt[tt_idx] = TTEntry { zhash, depth, value: best_val, flag };
        best_val
    }

    pub fn search(
        &mut self,
        board: &mut Board,
        zhash: u64,
        pi: &PatternIndex,
        me: u8,
        opp: u8,
        moves_played: i32,
    ) -> Option<usize> {
        self.start = Instant::now();
        // Do NOT clear TT, just history/nodes
        self.history = [0; CELLS];
        self.nodes = 0;

        let t = tables();
        let empties: Vec<usize> = (0..CELLS).filter(|&i| board[i] == 0).collect();
        if empties.is_empty() {
            return None;
        }

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

        let mut best_move = empties[0];

        for depth in 1..=self.max_depth {
            if self.start.elapsed().as_secs_f64() >= self.budget {
                break;
            }

            let mut current_best = empties[0];
            let mut current_val = -INF;

            let mut moves: Vec<(i32, usize)> = empties
                .iter()
                .map(|&i| (-self.history[i], i))
                .collect();
            moves.sort_unstable();

            for &(_, mv) in &moves {
                let z_new = zhash ^ t.zobrist[mv][me as usize];
                make(board, mv, me);

                if wins_at(board, mv, me, pi) {
                    unmake(board, mv);
                    return Some(mv);
                }

                let val = -self.negamax(board, z_new, pi, opp, me, depth - 1, -INF, -current_val.max(-INF + 1), moves_played + 1);
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
