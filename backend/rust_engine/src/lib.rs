mod board;
mod eval_danger;
mod eval_hard;
mod patterns;
mod search;
mod search_danger;
mod wins;

use board::{rc, to_flat};
use patterns::PatternIndex;
use pyo3::prelude::*;

#[pyclass]
pub struct RustHardBot7 {
    pi: PatternIndex,
}

#[pymethods]
impl RustHardBot7 {
    #[new]
    fn new(patterns: Vec<Vec<(i32, i32)>>) -> Self {
        let pi = PatternIndex::build(&patterns);
        RustHardBot7 { pi }
    }

    #[pyo3(signature = (board_2d, bot, human, _difficulty, moves_played, _c3_blocked))]
    fn choose(
        &self,
        board_2d: Vec<Vec<Option<String>>>,
        bot: &str,
        human: &str,
        _difficulty: &str,
        moves_played: i32,
        _c3_blocked: bool,
    ) -> PyResult<Option<(usize, usize)>> {
        let (mut flat, zhash) = to_flat(&board_2d, bot, human);
        let mut engine = search::HardSearch::new(6, 2.5);
        let result = engine.search(&mut flat, zhash, &self.pi, 1, 2, moves_played);
        Ok(result.map(rc))
    }
}

#[pyclass]
pub struct RustDangerBot7 {
    pi: PatternIndex,
}

#[pymethods]
impl RustDangerBot7 {
    #[new]
    fn new(patterns: Vec<Vec<(i32, i32)>>) -> Self {
        let pi = PatternIndex::build(&patterns);
        RustDangerBot7 { pi }
    }

    #[pyo3(signature = (board_2d, bot, human, moves_played, c3_blocked))]
    fn choose(
        &self,
        board_2d: Vec<Vec<Option<String>>>,
        bot: &str,
        human: &str,
        moves_played: i32,
        c3_blocked: bool,
    ) -> PyResult<Option<(usize, usize)>> {
        let (mut flat, zhash) = to_flat(&board_2d, bot, human);
        // Phase-1 strength bump with bounded latency:
        // - early game: keep baseline latency budget
        // - mid game onward: allow slightly deeper/longer search
        let (max_depth, budget_sec) = if moves_played < 10 {
            (10, 5.0)
        } else {
            (11, 6.0)
        };
        let mut engine = search_danger::DangerSearch::new(max_depth, budget_sec);
        let result = engine.search(&mut flat, zhash, &self.pi, 1, 2, moves_played, c3_blocked);
        Ok(result.map(rc))
    }
}

#[pymodule]
fn penta_engine(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<RustHardBot7>()?;
    m.add_class::<RustDangerBot7>()?;
    Ok(())
}
