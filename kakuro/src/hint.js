// Step-by-step deduction finder. Given the puzzle and the player's current
// digit entries, finds every cell that is currently forced by two classic
// Kakuro techniques:
//   - naked single: only one digit is possible for the cell at all
//   - hidden single: a run has an empty cell that is the only place left
//     for one of the digits the run still needs
// Exposes the global `Hint`.

const Hint = (() => {
  function runState(run, filled) {
    let usedMask = 0, sum = 0, filledCount = 0;
    for (const k of run.cells) {
      const d = filled.get(k);
      if (d) { usedMask |= (1 << (d - 1)); sum += d; filledCount++; }
    }
    return { usedMask, sum, filledCount };
  }

  function candidatesFor(puzzle, filled, k) {
    const rr = puzzle.cellRow[k], cr = puzzle.cellCol[k];
    const rowRun = puzzle.rowRuns[rr], colRun = puzzle.colRuns[cr];
    const rs = runState(rowRun, filled);
    const cs = runState(colRun, filled);
    const remLenRow = rowRun.cells.length - rs.filledCount;
    const remSumRow = rowRun.sum - rs.sum;
    const remLenCol = colRun.cells.length - cs.filledCount;
    const remSumCol = colRun.sum - cs.sum;
    const rowCand = Rules.comboDigits(remLenRow, remSumRow) & ~rs.usedMask;
    const colCand = Rules.comboDigits(remLenCol, remSumCol) & ~cs.usedMask;
    return rowCand & colCand;
  }

  function findAll(puzzle, filled) {
    const hints = [];
    const emptyCells = [];
    for (let k = 0; k < puzzle.rows * puzzle.cols; k++) {
      if (puzzle.layout[k] || filled.has(k)) continue;
      emptyCells.push(k);
    }

    // Naked singles.
    const candCache = new Map();
    for (const k of emptyCells) {
      const cand = candidatesFor(puzzle, filled, k);
      candCache.set(k, cand);
      if (Rules.popcount(cand) === 1) {
        const d = Rules.digitsOfMask(cand)[0];
        hints.push(makeHint(puzzle, k, d,
          `This cell has only one possible digit left: ${d}.`));
      }
    }

    // Hidden singles: for each run, a digit the run surely still needs
    // that fits in exactly one of the run's still-empty cells.
    for (const run of [...puzzle.rowRuns, ...puzzle.colRuns]) {
      const emptyInRun = run.cells.filter((k) => !puzzle.layout[k] && !filled.has(k));
      if (emptyInRun.length < 2) continue; // naked single already covers 0/1
      const st = runState(run, filled);
      const needed = neededDigits(emptyInRun.length, run.sum - st.sum, st.usedMask);
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1);
        if (!(needed & bit)) continue;
        const owners = emptyInRun.filter((k) => candCache.get(k) & bit);
        if (owners.length === 1) {
          const k = owners[0];
          if (hints.some((h) => h.idx === k)) continue;
          hints.push(makeHint(puzzle, k, d,
            `Digit ${d} has only one possible cell left in this run.`));
        }
      }
    }

    return hints;
  }

  // Digits in every set of `len` different unused digits that add up to
  // `sum` (bit d-1 for digit d). 0 if there is no such set.
  function neededDigits(len, sum, usedMask) {
    let all = 0x1ff, found = false;
    for (let m = 0; m < 512; m++) {
      if (m & usedMask) continue;
      let n = 0, t = 0;
      for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) { n++; t += d; }
      if (n === len && t === sum) { all &= m; found = true; }
    }
    return found ? all : 0;
  }

  function makeHint(puzzle, k, digit, reason) {
    const r = Math.floor(k / puzzle.cols), c = k % puzzle.cols;
    return { idx: k, r, c, action: 'fill', digit, reason };
  }

  return { findAll };
})();
