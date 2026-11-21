// Backtracking Kakuro solver with combination-table pruning. Enumerates
// solutions and stops as soon as `stopAt` are found — used both to play
// (grading isn't done here, see main.js) and to verify a freshly generated
// puzzle has exactly one solution.
//
// `puzzle.given` (optional) is a plain object cellIndex -> digit for cells
// whose value is fixed and shown to the player from the start (see
// generator.js for why these exist). Given cells are folded into the run
// totals up front and excluded from the free search.

const Solver = (() => {
  // Returns { solutions, capped }. `capped` is true if the node budget ran
  // out before the search finished — in that case `solutions` may be
  // incomplete and must not be treated as proof of (non-)uniqueness.
  function solve(puzzle, stopAt = 2, opts = {}) {
    const { rows, cols, layout, cellRow, cellCol, rowRuns, colRuns, given } = puzzle;
    const maxNodes = opts.maxNodes || 2000000;
    const total = rows * cols;

    const digit = new Int8Array(total);
    const rowUsed = new Int32Array(rowRuns.length);
    const rowFilled = new Int32Array(rowRuns.length);
    const rowSum = new Int32Array(rowRuns.length);
    const colUsed = new Int32Array(colRuns.length);
    const colFilled = new Int32Array(colRuns.length);
    const colSum = new Int32Array(colRuns.length);

    const cells = [];
    for (let k = 0; k < total; k++) {
      if (layout[k]) continue;
      const g = given?.[k];
      if (g) {
        const bit = 1 << (g - 1);
        const rr = cellRow[k], cr = cellCol[k];
        digit[k] = g;
        rowUsed[rr] |= bit; rowFilled[rr]++; rowSum[rr] += g;
        colUsed[cr] |= bit; colFilled[cr]++; colSum[cr] += g;
      } else {
        cells.push(k);
      }
    }

    const solutions = [];
    let nodes = 0;
    let capped = false;

    function backtrack(pos) {
      if (solutions.length >= stopAt || capped) return;
      if (++nodes > maxNodes) { capped = true; return; }
      if (pos >= cells.length) {
        solutions.push(digit.slice());
        return;
      }
      const k = cells[pos];
      const rr = cellRow[k], cr = cellCol[k];
      const rowRun = rowRuns[rr], colRun = colRuns[cr];

      const remLenRow = rowRun.cells.length - rowFilled[rr];
      const remSumRow = rowRun.sum - rowSum[rr];
      const remLenCol = colRun.cells.length - colFilled[cr];
      const remSumCol = colRun.sum - colSum[cr];

      const rowCand = Rules.comboDigits(remLenRow, remSumRow) & ~rowUsed[rr];
      const colCand = Rules.comboDigits(remLenCol, remSumCol) & ~colUsed[cr];
      let cand = rowCand & colCand;

      while (cand) {
        const bit = cand & -cand;
        cand ^= bit;
        const d = Math.log2(bit) + 1;

        digit[k] = d;
        rowUsed[rr] |= bit; rowFilled[rr]++; rowSum[rr] += d;
        colUsed[cr] |= bit; colFilled[cr]++; colSum[cr] += d;

        backtrack(pos + 1);

        digit[k] = 0;
        rowUsed[rr] &= ~bit; rowFilled[rr]--; rowSum[rr] -= d;
        colUsed[cr] &= ~bit; colFilled[cr]--; colSum[cr] -= d;

        if (solutions.length >= stopAt || capped) return;
      }
    }

    backtrack(0);
    return { solutions, capped };
  }

  return { solve };
})();
