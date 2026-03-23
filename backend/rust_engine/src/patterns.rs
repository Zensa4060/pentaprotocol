use crate::board::{idx, CELLS, DIRS4, GRID};

pub struct PatternIndex {
    pub pat_cells: Vec<[usize; 7]>,
    pub cell_pats: Vec<Vec<u16>>,
    pub line_cells: Vec<[usize; 7]>,
    pub cell_lines: Vec<Vec<u16>>,
}

impl PatternIndex {
    pub fn build(patterns: &[Vec<(i32, i32)>]) -> Self {
        let mut pat_cells: Vec<[usize; 7]> = Vec::new();
        let mut cell_pats: Vec<Vec<u16>> = vec![Vec::new(); CELLS];

        for pat in patterns {
            let max_r = pat.iter().map(|&(dr, _)| dr).max().unwrap_or(0);
            let max_c = pat.iter().map(|&(_, dc)| dc).max().unwrap_or(0);
            for br in 0..=(GRID as i32 - 1 - max_r) {
                for bc in 0..=(GRID as i32 - 1 - max_c) {
                    let mut cells = [0usize; 7];
                    for (k, &(dr, dc)) in pat.iter().enumerate() {
                        cells[k] = idx((br + dr) as usize, (bc + dc) as usize);
                    }
                    let pi = pat_cells.len() as u16;
                    pat_cells.push(cells);
                    for &ci in &cells {
                        cell_pats[ci].push(pi);
                    }
                }
            }
        }

        let mut line_cells: Vec<[usize; 7]> = Vec::new();
        let mut cell_lines: Vec<Vec<u16>> = vec![Vec::new(); CELLS];

        for &(dr, dc) in &DIRS4 {
            for r in 0..GRID as i32 {
                for c in 0..GRID as i32 {
                    let er = r + 6 * dr;
                    let ec = c + 6 * dc;
                    if er < 0 || er >= GRID as i32 || ec < 0 || ec >= GRID as i32 {
                        continue;
                    }
                    let mut win = [0usize; 7];
                    for i in 0..7 {
                        win[i] = idx((r + i as i32 * dr) as usize, (c + i as i32 * dc) as usize);
                    }
                    let li = line_cells.len() as u16;
                    line_cells.push(win);
                    for &ci in &win {
                        cell_lines[ci].push(li);
                    }
                }
            }
        }

        PatternIndex {
            pat_cells,
            cell_pats,
            line_cells,
            cell_lines,
        }
    }
}
