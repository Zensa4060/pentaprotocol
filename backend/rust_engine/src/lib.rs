mod board;
mod board6;
mod eval6_god;
mod eval6_hard;
mod eval_danger;
mod eval_hard;
mod patterns;
mod patterns6;
mod search;
mod search6_god;
mod search6_hard;
mod search_danger;
mod wins;
mod wins6;

use board::{rc, to_flat};
use board6::{rc6, to_flat6};
use patterns::PatternIndex;
use patterns6::PatternIndex6;
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
        let mut engine = search::HardSearch::new(6, 1.0);
        let result = engine.search(&mut flat, zhash, &self.pi, 1, 2, moves_played);
        Ok(result.map(rc))
    }
}

#[pyclass]
pub struct RustDangerBot7 {
    pi: PatternIndex,
}

#[pyclass]
pub struct RustNormalBot6 {
    pi6: PatternIndex6,
}

#[pymethods]
impl RustNormalBot6 {
    #[new]
    fn new(patterns: Vec<Vec<(i32, i32)>>) -> Self {
        RustNormalBot6 {
            pi6: PatternIndex6::build(&patterns),
        }
    }

    #[pyo3(signature = (board_2d, bot, human, moves_played))]
    fn choose(
        &self,
        board_2d: Vec<Vec<Option<String>>>,
        bot: &str,
        human: &str,
        moves_played: i32,
    ) -> PyResult<Option<(usize, usize)>> {
        let (mut flat, zhash) = to_flat6(&board_2d, bot, human);
        let mut engine = search6_hard::HardSearch6::new(3, 0.45);
        let result = engine.search(&mut flat, zhash, &self.pi6, 1, 2, moves_played);
        Ok(result.map(rc6))
    }
}

#[pyclass]
pub struct RustHardBot6 {
    pi6: PatternIndex6,
}

#[pymethods]
impl RustHardBot6 {
    #[new]
    fn new(patterns: Vec<Vec<(i32, i32)>>) -> Self {
        RustHardBot6 {
            pi6: PatternIndex6::build(&patterns),
        }
    }

    #[pyo3(signature = (board_2d, bot, human, moves_played))]
    fn choose(
        &self,
        board_2d: Vec<Vec<Option<String>>>,
        bot: &str,
        human: &str,
        moves_played: i32,
    ) -> PyResult<Option<(usize, usize)>> {
        let (mut flat, zhash) = to_flat6(&board_2d, bot, human);
        let mut engine = search6_hard::HardSearch6::new(5, 1.0);
        let result = engine.search(&mut flat, zhash, &self.pi6, 1, 2, moves_played);
        Ok(result.map(rc6))
    }
}

#[pyclass]
pub struct RustMachineGodBot6 {
    pi6: PatternIndex6,
}

#[pymethods]
impl RustMachineGodBot6 {
    #[new]
    fn new(patterns: Vec<Vec<(i32, i32)>>) -> Self {
        RustMachineGodBot6 {
            pi6: PatternIndex6::build(&patterns),
        }
    }

    #[pyo3(signature = (board_2d, bot, human, moves_played))]
    fn choose(
        &self,
        board_2d: Vec<Vec<Option<String>>>,
        bot: &str,
        human: &str,
        moves_played: i32,
    ) -> PyResult<Option<(usize, usize)>> {
        let (mut flat, zhash) = to_flat6(&board_2d, bot, human);
        let mut engine = search6_god::GodSearch6::new(8, 1.0);
        let result = engine.search(&mut flat, zhash, &self.pi6, 1, 2, moves_played);
        Ok(result.map(rc6))
    }
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
        // 7×7 ANAMOLY: 1.5s wall-clock cap (only mode above the global 1.0s bot limit)
        let (max_depth, budget_sec) = if moves_played < 10 {
            (10, 1.5)
        } else {
            (11, 1.5)
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
    m.add_class::<RustNormalBot6>()?;
    m.add_class::<RustHardBot6>()?;
    m.add_class::<RustMachineGodBot6>()?;
    Ok(())
}
