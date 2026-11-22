// Shared engine for number-path puzzles (Numbrix, Hidato).
// The numbers 1..N form a path where each next number is a neighbour.
// `diag` allows diagonal steps (Hidato). Exposes the global `NumberPath`.

const NumberPath = (() => {
  function neighbours(R, C, diag) {
    return Array.from({ length: R * C }, (_, k) => cellNeighbours(R, C, diag, k));
  }

  // Cells next to k (with `diag` also at a corner).
  function cellNeighbours(R, C, diag, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      const step = (dr || dc) && (diag || !dr || !dc);
      if (step && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
    }
    return out;
  }

  function dist(a, b, C, diag) {
    const dr = Math.abs(Math.floor(a / C) - Math.floor(b / C)), dc = Math.abs((a % C) - (b % C));
    return diag ? Math.max(dr, dc) : dr + dc;
  }

  // Random path over all cells. Builds a snake, then shuffles it with
  // "backbite" moves (Numbrix) or a random walk with restarts (Hidato).
  function randomPath(R, C, diag) {
    const N = R * C;
    const nb = neighbours(R, C, diag);
    let path = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) path.push(r * C + (r % 2 ? C - 1 - c : c));
    for (let it = 0; it < N * 40; it++) {
      if (Math.random() < 0.5) path.reverse();
      const end = path.at(-1);
      const at = new Map(path.map((k, i) => [k, i]));
      const opts = nb[end].filter((k) => at.get(k) !== path.length - 2);
      const k = opts[Math.floor(Math.random() * opts.length)];
      const i = at.get(k);
      // Backbite: link end to k, reverse the part after k.
      path = path.slice(0, i + 1).concat(path.slice(i + 1).reverse());
    }
    const val = new Int32Array(N);
    path.forEach((k, i) => { val[k] = i + 1; });
    return val;
  }

  // Counts solutions (up to stopAt) for givens (0 = empty).
  function solve(R, C, diag, given, stopAt = 2, maxNodes = 200000) {
    const N = R * C;
    const nb = neighbours(R, C, diag);
    const posOf = new Int32Array(N + 2).fill(-1);
    for (let k = 0; k < N; k++) if (given[k]) posOf[given[k]] = k;
    const nextGiven = new Int32Array(N + 2).fill(0);
    let ng = 0;
    for (let v = N; v >= 1; v--) { nextGiven[v] = ng; if (posOf[v] >= 0) ng = v; }
    const val = Int32Array.from(given);
    const solutions = [];
    let nodes = 0;

    function ok(cell, v) {
      const g = nextGiven[v];
      return !g || dist(cell, posOf[g], C, diag) <= g - v;
    }

    // True if a free cell next to the new head j has no link left.
    // Possible links: free cells, the new head, later givens.
    function leavesDeadCell(j, w) {
      const link = (y) => !val[y] || y === j || (val[y] > w && posOf[val[y]] === y);
      return nb[j].some((x) => !val[x] && !nb[x].some(link));
    }

    function rec(v, cell) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (v === N) { solutions.push(Int32Array.from(val)); return; }
      const w = v + 1;
      if (posOf[w] >= 0) {
        if (nb[cell].includes(posOf[w])) rec(w, posOf[w]);
        return;
      }
      for (const j of nb[cell]) {
        if (val[j] || !ok(j, w)) continue;
        // Do not leave a free neighbour with no way out.
        val[j] = w;
        if (!leavesDeadCell(j, w)) rec(w, j);
        val[j] = 0;
      }
    }

    if (posOf[1] >= 0) rec(1, posOf[1]);
    else {
      for (let k = 0; k < N && solutions.length < stopAt; k++) {
        if (val[k] || !ok(k, 1)) continue;
        val[k] = 1;
        rec(1, k);
        val[k] = 0;
      }
    }
    return { solutions, capped: nodes > maxNodes };
  }

  // Removes givens while the puzzle stays unique. Keeps 1 and N.
  function makePuzzle(R, C, diag, keepRate = 0) {
    const N = R * C;
    const sol = randomPath(R, C, diag);
    const given = Int32Array.from(sol);
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (sol[k] === 1 || sol[k] === N) continue;
      if (Math.random() < keepRate) continue;
      given[k] = 0;
      const res = solve(R, C, diag, given, 2, 30000);
      if (res.solutions.length !== 1 || res.capped) given[k] = sol[k];
    }
    return { R, C, diag, given, solution: sol };
  }

  // Hints: wrong numbers, then a number with only one free cell left
  // between its placed neighbours, then the next number of a chain.
  function hints(p, entries) {
    const { R, C, diag, given, solution } = p;
    const N = R * C;
    const wrong = [];
    for (let k = 0; k < N; k++) {
      if (entries[k] && !given[k] && entries[k] !== solution[k]) wrong.push({ cells: [k], v: 0, reason: 'This number is wrong.' });
    }
    if (wrong.length) return wrong;
    const val = Int32Array.from(entries, (v, k) => given[k] || v);
    const pos = new Int32Array(N + 2).fill(-1);
    for (let k = 0; k < N; k++) if (val[k]) pos[val[k]] = k;
    const out = onlyCellHints(neighbours(R, C, diag), val, pos, N);
    if (out.length) return out;
    // No single step: reveal the next number of a chain.
    for (let v = 1; v <= N; v++) {
      if (pos[v] >= 0 || (pos[v - 1] < 0 && pos[v + 1] < 0)) continue;
      return [{ cells: [solution.indexOf(v)], v, reason: `No single step is left. ${v} goes here.` }];
    }
    return [];
  }

  // Free cells next to every cell in `at`.
  function freeNear(nb, val, at, N) {
    return [...new Array(N).keys()].filter((k) => !val[k] && at.every((x) => nb[x].includes(k)));
  }

  // A number with only one free cell left next to its placed neighbours.
  function onlyCellHints(nb, val, pos, N) {
    const out = [];
    for (let v = 1; v <= N; v++) {
      if (pos[v] >= 0) continue;
      const a = pos[v - 1], b = pos[v + 1];
      if (a < 0 && b < 0) continue;
      const opts = freeNear(nb, val, [a, b].filter((x) => x >= 0), N);
      if (opts.length !== 1) continue;
      const near = a >= 0 ? v - 1 : v + 1;
      out.push({ cells: opts, v, reason: a >= 0 && b >= 0
        ? `${v} sits between ${v - 1} and ${v + 1}. Only one free cell touches both.`
        : `${v} must touch ${near}, and only one free cell does.` });
    }
    return out;
  }

  // Shared board renderer with digit inputs.
  function render(p, entries, opts = {}) {
    const { R, C, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const N = R * C;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 46), className: 'pz-board np-board', readonly,
      renderCell(k, el) {
        el.style.fontSize = `calc(var(--cell) * ${N >= 100 ? 0.34 : 0.42})`;
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        } else if (readonly) {
          el.textContent = entries[k] || '';
          el.classList.add('entry');
        } else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / C), c: k % C, value: entries[k], max: N,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  function isSolved(p, entries) {
    const val = Array.from(entries, (v, k) => p.given[k] || v);
    return val.every((v, k) => v === p.solution[k]);
  }

  return { neighbours, randomPath, solve, makePuzzle, hints, render, isSolved };
})();
