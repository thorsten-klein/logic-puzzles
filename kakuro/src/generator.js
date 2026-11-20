// Puzzle generator. Builds a random black/white layout in a healthy
// white-cell range, fills it with a valid random digit assignment
// (distinct digits per run), derives the clue sums from that assignment,
// then verifies uniqueness with the solver.
//
// Sum clues alone are almost never enough to pin a unique solution for a
// randomly built grid — most runs admit more than one digit combination,
// and swaps between them cancel out, so a random fill is ambiguous
// essentially every time. Rather than mangling the layout to force
// uniqueness (which, empirically, spirals into walling off most of the
// grid), we resolve ambiguity the way computer-generated Kakuro
// traditionally does: reveal a handful of cells as "givens" — fixed,
// pre-filled digits shown from the start. Each reveal is picked from
// where two found solutions actually disagree, so it directly breaks
// that ambiguity; a handful of reveals is normally enough.

const Generator = (() => {
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Fix up runs that are too short (length 1) or too long (>9) by
  // flipping individual white cells to black, re-scanning until stable.
  // Mutates `layout` in place. Each round turns one white cell black, so
  // this always ends.
  function stabilizeLayout(layout, rows, cols) {
    for (;;) {
      const { rowRuns, colRuns } = Rules.computeRuns(layout, rows, cols);
      let changed = false;

      for (const run of rowRuns) {
        if (run.cells.length === 1) { layout[run.cells[0]] = 1; changed = true; break; }
        if (run.cells.length > 9) { layout[run.cells[9]] = 1; changed = true; break; }
      }
      if (changed) continue;

      for (const run of colRuns) {
        if (run.cells.length === 1) { layout[run.cells[0]] = 1; changed = true; break; }
        if (run.cells.length > 9) { layout[run.cells[9]] = 1; changed = true; break; }
      }
      if (!changed) return;
    }
  }

  // All white cells must form a single orthogonally-connected region — an
  // isolated pocket of white cells (reachable only diagonally, or fully
  // walled off) can't be reached by any run and would be unfillable/unclued.
  function isWhiteConnected(layout, rows, cols) {
    const total = rows * cols;
    let start = -1, whiteCount = 0;
    for (let k = 0; k < total; k++) {
      if (!layout[k]) { whiteCount++; if (start === -1) start = k; }
    }
    if (whiteCount === 0) return false;

    const seen = new Uint8Array(total);
    seen[start] = 1;
    const stack = [start];
    let visited = 0;
    while (stack.length) {
      const k = stack.pop();
      visited++;
      const r = Math.floor(k / cols), c = k % cols;
      const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (!Rules.inBounds(nr, nc, rows, cols)) continue;
        const nk = Rules.idx(nr, nc, cols);
        if (layout[nk] || seen[nk]) continue;
        seen[nk] = 1;
        stack.push(nk);
      }
    }
    return visited === whiteCount;
  }

  function buildLayout(size, density, whiteMin, whiteMax) {
    const rows = size + 1, cols = size + 1;
    const total = rows * cols;
    const layout = new Uint8Array(total);
    for (let c = 0; c < cols; c++) layout[Rules.idx(0, c, cols)] = 1;
    for (let r = 0; r < rows; r++) layout[Rules.idx(r, 0, cols)] = 1;
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        if (Math.random() < density) layout[Rules.idx(r, c, cols)] = 1;
      }
    }
    stabilizeLayout(layout, rows, cols);
    const black = layout.reduce((s, v) => s + v, 0);
    const white = (total - black) / total;
    if (white < whiteMin || white > whiteMax) return null;
    if (!isWhiteConnected(layout, rows, cols)) return null;
    return { rows, cols, layout };
  }

  // --- digit fill: random assignment obeying per-run distinctness -------
  // No sum target here; we just need *a* valid Latin-style fill so we can
  // read off the clue sums afterwards. This is a single fail-fast pass
  // (no backtracking): if some cell paints itself into a corner we abort
  // the whole attempt immediately rather than searching for a way out —
  // real backtracking here can blow up badly on some layouts, while a
  // fresh randomized pass is O(cells) and near-certain to succeed within
  // a handful of retries in practice.
  function fillSolution(rows, cols, layout, cellRow, cellCol, rowRuns, colRuns) {
    const total = rows * cols;
    const cells = [];
    for (let k = 0; k < total; k++) if (!layout[k]) cells.push(k);

    const digit = new Int8Array(total);
    const rowUsed = new Int32Array(rowRuns.length);
    const colUsed = new Int32Array(colRuns.length);

    for (const k of shuffled(cells)) {
      const rr = cellRow[k], cr = cellCol[k];
      const domain = (~(rowUsed[rr] | colUsed[cr])) & 0x1ff;
      if (!domain) return null;
      const bits = Rules.digitsOfMask(domain);
      const d = bits[Math.floor(Math.random() * bits.length)];
      const bit = 1 << (d - 1);
      digit[k] = d;
      rowUsed[rr] |= bit; colUsed[cr] |= bit;
    }
    return digit;
  }

  function buildClues(layout, rows, cols, rowStartAt, colStartAt) {
    const clues = {};
    for (let k = 0; k < rows * cols; k++) {
      if (!layout[k]) continue;
      const r = Math.floor(k / cols), c = k % cols;
      const { across, down } = Rules.clueFor(r, c, rows, cols, rowStartAt, colStartAt);
      if (across || down) clues[k] = { across: across ? across.sum : null, down: down ? down.sum : null };
    }
    return clues;
  }

  // Given a layout + a valid full solution, try to reach uniqueness by
  // revealing cells as givens where two solutions disagree. Returns the
  // given-set (possibly empty) on success, or null if it didn't converge
  // within the reveal/time budget.
  function repairWithGivens(size, rows, cols, layout, solved, deadline) {
    const { cellRow, cellCol, rowRuns, colRuns } = Rules.computeRuns(layout, rows, cols);
    for (const run of rowRuns) run.sum = run.cells.reduce((s, k) => s + solved[k], 0);
    for (const run of colRuns) run.sum = run.cells.reduce((s, k) => s + solved[k], 0);

    const given = {};
    const maxReveals = Math.max(3, Math.floor((rows * cols) * 0.3));

    for (let iter = 0; iter < 80 && Date.now() < deadline; iter++) {
      const puzzle = { size, rows, cols, layout, cellRow, cellCol, rowRuns, colRuns, given };
      const { solutions: sols, capped } = Solver.solve(puzzle, 2, { maxNodes: 300000 });
      if (capped) return null;
      if (sols.length === 1) return given;
      if (sols.length === 0) return null; // shouldn't happen — ground truth always fits

      const other = sols.find((s) => s.some((d, i) => d !== solved[i]));
      if (!other) return null;
      let diffIdx = -1;
      for (let k = 0; k < other.length; k++) {
        if (!layout[k] && !given[k] && other[k] !== solved[k]) { diffIdx = k; break; }
      }
      if (diffIdx === -1) return null;

      given[diffIdx] = solved[diffIdx];
      if (Object.keys(given).length > maxReveals) return null;
    }
    return null;
  }

  // At most 45% black cells: every cell that is not white counts, the
  // clue row and column too.
  const MAX_BLACK = 0.45;

  function generate(size, deadlineMs = 6000) {
    const density = 0.16;
    const deadline = Date.now() + deadlineMs;
    // Keep searching for a while even after the first hit — fewer givens
    // makes for a better puzzle — but don't chase perfection forever.
    // Bigger boards with few black cells need more givens.
    const goodEnoughGivens = Math.max(5, 2 * size - 6);
    let best = null;

    while (Date.now() < deadline) {
      const built = buildLayout(size, density, 1 - MAX_BLACK, 0.95);
      if (!built) continue;
      const { rows, cols, layout } = built;

      let solved = null;
      {
        const { cellRow, cellCol, rowRuns, colRuns } = Rules.computeRuns(layout, rows, cols);
        for (let attempt = 0; attempt < 200 && Date.now() < deadline; attempt++) {
          solved = fillSolution(rows, cols, layout, cellRow, cellCol, rowRuns, colRuns);
          if (solved) break;
        }
      }
      if (!solved) continue;

      const given = repairWithGivens(size, rows, cols, layout, solved, deadline);
      if (!given) continue;

      const { rowStartAt, colStartAt, cellRow, cellCol, rowRuns, colRuns } = Rules.computeRuns(layout, rows, cols);
      for (const run of rowRuns) run.sum = run.cells.reduce((s, k) => s + solved[k], 0);
      for (const run of colRuns) run.sum = run.cells.reduce((s, k) => s + solved[k], 0);

      const candidate = {
        size, rows, cols, layout, cellRow, cellCol, rowRuns, colRuns,
        clues: buildClues(layout, rows, cols, rowStartAt, colStartAt),
        given,
        solution: solved,
      };
      if (!best || Object.keys(given).length < Object.keys(best.given).length) best = candidate;
      if (Object.keys(given).length <= goodEnoughGivens) break;
    }
    return best;
  }

  return { generate };
})();
