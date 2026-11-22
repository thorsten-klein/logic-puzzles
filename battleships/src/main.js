// Battleships. Find the fleet from row and column counts and a few
// revealed cells. Ships are straight and never touch, not even at a
// corner. Built on the shared Binary game page.

(() => {
  const { YES, NO } = Binary;

  function fleetFor(n) {
    if (n <= 6) return [3, 2, 2, 1, 1, 1];
    if (n <= 8) return [4, 3, 2, 2, 1, 1, 1];
    return [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  }

  // Ship runs: straight runs of YES cells. A run is closed when no
  // ship cell can be added (water or border at every free end).
  function runs(R, C, s) {
    const out = [];
    const seen = new Uint8Array(R * C);
    const water = (r, c) => r < 0 || c < 0 || r >= R || c >= C || s[r * C + c] === NO;
    for (let k = 0; k < R * C; k++) {
      if (s[k] !== YES || seen[k]) continue;
      const r = Math.floor(k / C), c = k % C;
      const horiz = c + 1 < C && s[k + 1] === YES;
      const vert = r + 1 < R && s[k + C] === YES;
      let len = 0;
      while (horiz ? (c + len < C && s[k + len] === YES) : (r + len < R && s[k + len * C] === YES)) {
        seen[horiz ? k + len : k + len * C] = 1;
        len++;
      }
      let closed;
      if (horiz) closed = water(r, c - 1) && water(r, c + len);
      else if (vert) closed = water(r - 1, c) && water(r + len, c);
      else closed = water(r, c - 1) && water(r, c + 1) && water(r - 1, c) && water(r + 1, c);
      out.push({ len, closed });
    }
    return out;
  }

  function model(p) {
    const { R, C, rows, cols, given, fleet } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      if (given[k]) cons.push({ cells: [k], min: given[k] === YES ? 1 : 0, max: given[k] === YES ? 1 : 0 });
    }
    const name = (w, i, n) => {
      if (n === 0) return `${w} ${i + 1} has no ship cells`;
      return `${w} ${i + 1} has ${n} ship ${n === 1 ? 'cell' : 'cells'}`;
    };
    for (let i = 0; i < R; i++) {
      const cells = Array.from({ length: C }, (_, j) => i * C + j);
      cons.push({ cells, min: rows[i], max: rows[i], area: cells,
        why: (v) => (v === YES ? `${name('Row', i, rows[i])}. They must fill the open cells.` : `${name('Row', i, rows[i])}. The rest is water.`) });
    }
    for (let i = 0; i < C; i++) {
      const cells = Array.from({ length: R }, (_, j) => j * C + i);
      cons.push({ cells, min: cols[i], max: cols[i], area: cells,
        why: (v) => (v === YES ? `${name('Column', i, cols[i])}. They must fill the open cells.` : `${name('Column', i, cols[i])}. The rest is water.`) });
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      const why = () => 'Ships may not touch at a corner. This cell is water.';
      cons.push({ cells: [k, k + C + 1], min: 0, max: 1, why }, { cells: [k + 1, k + C], min: 0, max: 1, why });
    }
    const maxLen = Math.max(...fleet);
    function check(s, done) {
      const list = runs(R, C, s);
      const left = new Map();
      for (const L of fleet) left.set(L, (left.get(L) || 0) + 1);
      for (const run of list) {
        if (run.len > maxLen) return false;
        if (run.closed || done) {
          const L = run.len;
          if (!left.get(L)) return false;
          left.set(L, left.get(L) - 1);
        }
      }
      return !done || [...left.values()].every((x) => x === 0);
    }
    return { N: R * C, cons, check };
  }

  function placeFleet(n, fleet) {
    const ship = new Uint8Array(n * n);
    const free = (cells) => cells.every((k) => {
      const r = Math.floor(k / n), c = k % n;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < n && nc < n && ship[nr * n + nc]) return false;
      }
      return true;
    });
    for (const L of fleet) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? n : n - L + 1));
        const c = Math.floor(Math.random() * (horiz ? n - L + 1 : n));
        const cells = Array.from({ length: L }, (_, i) => (horiz ? r * n + c + i : (r + i) * n + c));
        if (free(cells)) { cells.forEach((k) => { ship[k] = 1; }); placed = true; }
      }
      if (!placed) return null;
    }
    return ship;
  }

  function generate(n) {
    const fleet = fleetFor(n);
    let ship = null;
    while (!ship) ship = placeFleet(n, fleet);
    const sol = Uint8Array.from(ship, (x) => (x ? YES : NO));
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) { a += ship[i * n + j]; b += ship[j * n + i]; }
      rows.push(a); cols.push(b);
    }
    const p = { R: n, C: n, rows, cols, fleet, given: new Uint8Array(n * n) };
    // Reveal cells where another answer differs, until unique.
    for (let guard = 0; guard < n * n; guard++) {
      const res = Binary.solve(model(p), 2, 20000);
      if (res.solutions.length === 1 && !res.capped) break;
      const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
      const diff = [...sol.keys()].filter((k) => !p.given[k] && (other?.[k] !== sol[k]));
      const k = diff[Math.floor(Math.random() * diff.length)];
      p.given[k] = sol[k];
    }
    // Drop reveals that are not needed.
    for (const k of PuzzleShell.shuffle([...sol.keys()])) {
      if (!p.given[k]) continue;
      p.given[k] = 0;
      const res = Binary.solve(model(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) p.given[k] = sol[k];
    }
    p.solution = sol;
    return p;
  }

  const shipCount = (s, cells) => cells.filter((k) => s[k] === YES).length;

  Binary.startGame({
    id: 'battleships',
    name: 'Battleships',
    rules: 'Find the hidden fleet (listed under the grid). Ships are straight lines of cells and never touch each other, ' +
      'not even at a corner. The numbers tell how many ship cells are in each row and column. Some cells are revealed.',
    controls: 'Click a cell to mark a ship part, click again to mark water. Right click cycles the other way.',
    size: { min: 6, max: 10, def: 8 },
    solvedText: 'Fleet found — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, r: p.rows.join(','), c: p.cols.join(','), g: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 4 || n > 15) throw new Error('Invalid board size');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      if (rows.length !== n || cols.length !== n || [...rows, ...cols].some((x) => !(x >= 0 && x <= n))) throw new Error('Invalid counts');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[012]+$/.test(d.g)) throw new Error('Invalid reveals');
      return { R: n, C: n, rows, cols, fleet: fleetFor(n), given: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => p.given[k],
    top: (p, s) => p.cols.map((v, c) => [v, shipCount(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, shipCount(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'ship part', noNoun: 'water cell',
    className: 'bs-board', yesClass: 'ship', noClass: 'water',
    below: (p) => 'Fleet: ' + p.fleet.map((L) => '■'.repeat(L)).join('  '),
  });

})();
