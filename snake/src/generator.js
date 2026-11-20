// Puzzle generator. Backtracking self-avoiding walk that respects the
// snake touch rule, retried until one produces a uniquely-solvable puzzle.

const Generator = (() => {
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Backtracking snake builder. Tries to reach `targetLen`; returns the
  // longest snake found before `timeMs` runs out.
  function buildSnake(size, noTouch, targetLen, timeMs) {
    const filled = new Uint8Array(size * size);
    const idx = (r, c) => r * size + c;
    const start = [Math.floor(Math.random() * size), Math.floor(Math.random() * size)];
    const path = [start];
    filled[idx(start[0], start[1])] = 1;
    const deadline = Date.now() + timeMs;
    let best = path.slice();

    function legalMoves(r, c, grandprev) {
      const out = [];
      for (const [dr, dc] of Rules.ORTHO) {
        const nr = r + dr, nc = c + dc;
        if (!Rules.inBounds(nr, nc, size)) continue;
        if (filled[idx(nr, nc)]) continue;
        if (noTouch) {
          let touches = false;
          for (const [ddr, ddc] of Rules.ORTHO) {
            const ar = nr + ddr, ac = nc + ddc;
            if (!Rules.inBounds(ar, ac, size)) continue;
            if (ar === r && ac === c) continue;
            if (filled[idx(ar, ac)]) { touches = true; break; }
          }
          if (touches) continue;
          for (const [ddr, ddc] of Rules.DIAG) {
            const ar = nr + ddr, ac = nc + ddc;
            if (!Rules.inBounds(ar, ac, size)) continue;
            if (grandprev && ar === grandprev[0] && ac === grandprev[1]) continue;
            if (filled[idx(ar, ac)]) { touches = true; break; }
          }
          if (touches) continue;
        }
        out.push([nr, nc]);
      }
      return shuffle(out);
    }

    function rec() {
      if (path.length > best.length) best = path.slice();
      if (path.length >= targetLen) return true;
      if (Date.now() > deadline) return false;
      const last = path[path.length - 1];
      const grandprev = path.length >= 2 ? path[path.length - 2] : null;
      const moves = legalMoves(last[0], last[1], grandprev);
      for (const m of moves) {
        path.push(m);
        filled[idx(m[0], m[1])] = 1;
        if (rec()) return true;
        path.pop();
        filled[idx(m[0], m[1])] = 0;
      }
      return false;
    }

    rec();
    return best;
  }

  function generate(size, noTouch = true, deadlineMs = 8000) {
    // Density tuned per board size: larger boards explode the solver's
    // search space, so we aim for thinner snakes there. Without the
    // no-touch rule the snake can fold tightly, so we cap density lower
    // to keep the solver's search space tractable.
    const density = noTouch
      ? (size <= 6 ? 0.55 : size <= 8 ? 0.5 : size <= 10 ? 0.42 : size <= 12 ? 0.34 : 0.26)
      : (size <= 6 ? 0.45 : size <= 8 ? 0.36 : size <= 10 ? 0.3 : size <= 12 ? 0.24 : 0.2);
    const targetLen = Math.floor(size * size * density);
    const minLen = Math.max(Math.floor(targetLen * 0.7), size + 2);
    const deadline = Date.now() + deadlineMs;
    const buildBudgetMs = Math.max(150, size * size);

    while (Date.now() < deadline) {
      const path = buildSnake(size, noTouch, targetLen, buildBudgetMs);
      if (path.length < minLen) continue;
      const head = path[0];
      const tail = path[path.length - 1];
      const { rows, cols } = Rules.computeClues(path, size);
      const puzzle = { size, head, tail, rowClues: rows, colClues: cols, noTouch };
      // A search cut off by the deadline proves nothing: try the next one.
      const sols = Solver.solve(puzzle, 2, { deadline });
      if (sols.length === 1 && !sols.capped) {
        puzzle.solution = path;
        return puzzle;
      }
    }
    return null;
  }

  return { generate };
})();
