// Kakuro grid helpers and the digit-combination table. Exposes the global
// `Rules`.
//
// Grid layout: an R x C matrix of cells, each either "black" (a wall, and
// possibly a clue cell) or "white" (fillable with a digit 1-9). Row 0 and
// column 0 are always black; they hold the clue numbers for the run that
// starts immediately to their right / below, exactly like a normal Kakuro
// header. Interior black cells work the same way for the sub-runs that
// start after them.
//
// A "run" is a maximal horizontal or vertical strip of consecutive white
// cells. Every white cell belongs to exactly one row-run and one col-run.
// Runs must have length 2..9 (a run holds that many *distinct* digits
// 1-9, so it can't exceed 9 cells, and a length-1 run has no real
// constraint so we don't generate those).

const Rules = (() => {
  const idx = (r, c, cols) => r * cols + c;

  function inBounds(r, c, rows, cols) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  // --- combination table -------------------------------------------------
  // COMBO[`${length}-${sum}`] = bitmask (bit d-1 set) of every digit that
  // appears in at least one valid combo of `length` distinct digits from
  // 1-9 summing to `sum`.
  const COMBO = (() => {
    const table = {};
    for (let mask = 1; mask < 512; mask++) {
      let len = 0, sum = 0, digits = 0;
      for (let d = 1; d <= 9; d++) {
        if (mask & (1 << (d - 1))) { len++; sum += d; digits |= (1 << (d - 1)); }
      }
      const key = `${len}-${sum}`;
      table[key] = (table[key] || 0) | digits;
    }
    return table;
  })();

  function comboDigits(length, sum) {
    if (length < 1 || length > 9) return 0;
    return COMBO[`${length}-${sum}`] || 0;
  }

  function popcount(mask) {
    let n = 0;
    while (mask) { mask &= mask - 1; n++; }
    return n;
  }

  function digitsOfMask(mask) {
    const out = [];
    for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) out.push(d);
    return out;
  }

  // --- run detection -------------------------------------------------
  // `layout` is a flat Uint8Array(rows*cols), 1 = black, 0 = white.
  // Returns:
  //   cellRow[idx] / cellCol[idx]: index into rowRuns/colRuns (-1 if black)
  //   rowRuns / colRuns: [{ cells: [idx, ...] }]  (cells in run order)
  //   rowStartAt / colStartAt: Map("r,c" -> run) keyed by the coordinate of
  //     a run's first cell, used to attach clues to the black cell right
  //     before it. These are two separate maps — not one — because a
  //     single white cell is very often *both* the start of a row-run
  //     (black cell to its left) *and* a col-run (black cell above it),
  //     and a shared map would let the second overwrite the first.
  function computeRuns(layout, rows, cols) {
    const cellRow = new Int32Array(rows * cols).fill(-1);
    const cellCol = new Int32Array(rows * cols).fill(-1);
    const rowRuns = [];
    const colRuns = [];
    const rowStartAt = new Map();
    const colStartAt = new Map();

    for (let r = 0; r < rows; r++) {
      let run = null;
      for (let c = 0; c < cols; c++) {
        const k = idx(r, c, cols);
        if (layout[k]) { run = null; continue; }
        if (!run) {
          run = { cells: [] };
          rowRuns.push(run);
          rowStartAt.set(`${r},${c}`, run);
        }
        run.cells.push(k);
        cellRow[k] = rowRuns.length - 1;
      }
    }

    for (let c = 0; c < cols; c++) {
      let run = null;
      for (let r = 0; r < rows; r++) {
        const k = idx(r, c, cols);
        if (layout[k]) { run = null; continue; }
        if (!run) {
          run = { cells: [] };
          colRuns.push(run);
          colStartAt.set(`${r},${c}`, run);
        }
        run.cells.push(k);
        cellCol[k] = colRuns.length - 1;
      }
    }

    return { cellRow, cellCol, rowRuns, colRuns, rowStartAt, colStartAt };
  }

  // Clues attached to a black cell: the sum of the run starting right
  // after it (across) and/or below it (down), if any.
  function clueFor(r, c, rows, cols, rowStartAt, colStartAt) {
    return {
      across: rowStartAt.get(`${r},${c + 1}`) || null,
      down: colStartAt.get(`${r + 1},${c}`) || null,
    };
  }

  return { idx, inBounds, comboDigits, popcount, digitsOfMask, computeRuns, clueFor };
})();
