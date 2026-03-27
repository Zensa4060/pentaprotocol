use crate::board6::{idx6, CELLS6, DIRS4_6, GRID6};

pub struct PatternIndex6 {
    pub pat_cells: Vec<[usize; 6]>,
    pub cell_pats: Vec<Vec<u16>>,
    pub line_cells: Vec<[usize; 6]>,
    pub cell_lines: Vec<Vec<u16>>,
}

impl PatternIndex6 {
    pub fn build(patterns: &[Vec<(i32, i32)>]) -> Self {
        let mut pat_cells: Vec<[usize; 6]> = Vec::new();
        let mut cell_pats: Vec<Vec<u16>> = vec![Vec::new(); CELLS6];

        for pat in patterns {
            if pat.len() != 6 {
                continue;
            }
            let max_r = pat.iter().map(|&(dr, _)| dr).max().unwrap_or(0);
            let max_c = pat.iter().map(|&(_, dc)| dc).max().unwrap_or(0);
            for br in 0..=(GRID6 as i32 - 1 - max_r) {
                for bc in 0..=(GRID6 as i32 - 1 - max_c) {
                    let mut cells = [0usize; 6];
                    for (k, &(dr, dc)) in pat.iter().enumerate() {
                        cells[k] = idx6((br + dr) as usize, (bc + dc) as usize);
                    }
                    let pi = pat_cells.len() as u16;
                    pat_cells.push(cells);
                    for &ci in &cells {
                        cell_pats[ci].push(pi);
                    }
                }
            }
        }

        let mut line_cells: Vec<[usize; 6]> = Vec::new();
        let mut cell_lines: Vec<Vec<u16>> = vec![Vec::new(); CELLS6];
        for &(dr, dc) in &DIRS4_6 {
            for r in 0..GRID6 as i32 {
                for c in 0..GRID6 as i32 {
                    let er = r + 5 * dr;
                    let ec = c + 5 * dc;
                    if er < 0 || er >= GRID6 as i32 || ec < 0 || ec >= GRID6 as i32 {
                        continue;
                    }
                    let mut line = [0usize; 6];
                    for i in 0..6 {
                        line[i] = idx6((r + i as i32 * dr) as usize, (c + i as i32 * dc) as usize);
                    }
                    let li = line_cells.len() as u16;
                    line_cells.push(line);
                    for &ci in &line {
                        cell_lines[ci].push(li);
                    }
                }
            }
        }

        PatternIndex6 {
            pat_cells,
            cell_pats,
            line_cells,
            cell_lines,
        }
    }
}
