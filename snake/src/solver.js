// Backtracking solver: given the public clues (size, head, tail, row/col
// counts), enumerate snake paths and stop as soon as a second solution is
// found. Used both to play and to verify uniqueness during generation.

const Solver = (() => {
  function solve(puzzle, stopAt = 2, opts = {}) {
    const { size, head, tail, rowClues, colClues } = puzzle;
    const noTouch = puzzle.noTouch !== false;
    const total = rowClues.reduce((a, b) => a + b, 0);

    // Optional player-provided constraints. mustInclude is the set of
    // cell indices (r*size+c) that the final path is required to pass
    // through; mustExclude is the set of cell indices the path must
    // avoid. Endpoints are implicitly required; we drop them from the
    // include set if present so the prune count is correct.
    const mustInclude = opts.mustInclude ? new Set(opts.mustInclude) : null;
    const mustExclude = opts.mustExclude ? new Set(opts.mustExclude) : null;
    if (mustInclude) {
      mustInclude.delete(head[0] * size + head[1]);
      mustInclude.delete(tail[0] * size + tail[1]);
    }

    const filled = new Uint8Array(size * size);
    const rowCount = new Int32Array(size);
    const colCount = new Int32Array(size);
    const path = [];
    const solutions = [];

    const idx = (r, c) => r * size + c;

    function push(r, c) {
      path.push([r, c]);
      filled[idx(r, c)] = 1;
      rowCount[r]++;
      colCount[c]++;
    }

    function pop() {
      const [r, c] = path.pop();
      filled[idx(r, c)] = 0;
      rowCount[r]--;
      colCount[c]--;
    }

    // With the classic no-touch rule, adding (nr, nc) is illegal when:
    //   * any 4-neighbour other than `prev` (which becomes consecutive)
    //     is already a snake cell, OR
    //   * any diagonal neighbour other than `grandprev` (path[L-2], the
    //     other end of the just-formed bend) is already a snake cell.
    // Allowing the diagonal contact with `grandprev` is what makes 90°
    // turns possible at all. When noTouch is off the snake is just a
    // self-avoiding path and these checks are skipped.
    function wouldTouch(nr, nc, prev, grandprev) {
      if (!noTouch) return false;
      for (const [dr, dc] of Rules.ORTHO) {
        const ar = nr + dr, ac = nc + dc;
        if (!Rules.inBounds(ar, ac, size)) continue;
        if (ar === prev[0] && ac === prev[1]) continue;
        if (filled[idx(ar, ac)]) return true;
      }
      for (const [dr, dc] of Rules.DIAG) {
        const ar = nr + dr, ac = nc + dc;
        if (!Rules.inBounds(ar, ac, size)) continue;
        if (grandprev && ar === grandprev[0] && ac === grandprev[1]) continue;
        if (filled[idx(ar, ac)]) return true;
      }
      return false;
    }

    // Quick consistency checks on the constraints themselves.
    if (mustInclude && mustExclude) {
      for (const k of mustInclude) if (mustExclude.has(k)) return [];
    }
    if (mustExclude) {
      const hKey = head[0] * size + head[1];
      const tKey = tail[0] * size + tail[1];
      if (mustExclude.has(hKey) || mustExclude.has(tKey)) return [];
    }

    push(head[0], head[1]);
    if (rowCount[head[0]] > rowClues[head[0]] || colCount[head[1]] > colClues[head[1]]) {
      return [];
    }

    function unvisitedRequired() {
      if (!mustInclude) return 0;
      let n = 0;
      for (const k of mustInclude) if (!filled[k]) n++;
      return n;
    }

    // opts.deadline (a Date.now() time): give up after it, and mark the
    // result as capped (not a full search).
    let nodes = 0, capped = false;
    function backtrack() {
      if (solutions.length >= stopAt || capped) return;
      if (opts.deadline && (++nodes & 1023) === 0 && Date.now() > opts.deadline) { capped = true; return; }

      // Prune: not enough remaining moves to visit every required cell.
      if (mustInclude && unvisitedRequired() > total - path.length) return;

      const last = path.at(-1);

      if (last[0] === tail[0] && last[1] === tail[1]) {
        if (path.length !== total) return;
        for (let i = 0; i < size; i++) {
          if (rowCount[i] !== rowClues[i]) return;
          if (colCount[i] !== colClues[i]) return;
        }
        if (mustInclude && unvisitedRequired() > 0) return;
        solutions.push(path.map(([r, c]) => [r, c]));
        return;
      }

      if (path.length >= total) return;

      const grandprev = path.length >= 2 ? path.at(-2) : null;
      for (const [dr, dc] of Rules.ORTHO) {
        const nr = last[0] + dr, nc = last[1] + dc;
        if (!Rules.inBounds(nr, nc, size)) continue;
        if (filled[idx(nr, nc)]) continue;
        if (mustExclude && mustExclude.has(nr * size + nc)) continue;
        if (rowCount[nr] >= rowClues[nr]) continue;
        if (colCount[nc] >= colClues[nc]) continue;
        if (nr === tail[0] && nc === tail[1] && path.length + 1 !== total) continue;
        if (wouldTouch(nr, nc, last, grandprev)) continue;

        push(nr, nc);
        backtrack();
        pop();
        if (solutions.length >= stopAt || capped) return;
      }
    }

    backtrack();
    solutions.capped = capped;
    return solutions;
  }

  return { solve };
})();
