// Minesweeper Battleships. Find the fleet. Ships are straight and never
// touch each other, not even at a corner. A number counts the ship parts
// in the eight cells around it; numbered cells hold no ship.
// Built on the shared Binary game page (YES = ship part).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

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
    const { R, C, clues, fleet } = p;
    const cons = [];
    const around = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
      }
      return out;
    };
    for (let k = 0; k < R * C; k++) {
      const v = clues[k];
      if (v < 0) continue;
      cons.push({ cells: [k], min: 0, max: 0 });
      cons.push({ cells: around(k), min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs a ship part in every open cell around it.` : `This ${v} already has its ${v} ship part${v === 1 ? '' : 's'} around it. The other cells are water.`) });
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      const why = () => 'Ships may not touch at a corner. This cell is water.';
      cons.push({ cells: [k, k + C + 1], min: 0, max: 1, why });
      cons.push({ cells: [k + 1, k + C], min: 0, max: 1, why });
    }
    const maxLen = Math.max(...fleet);
    function check(s, done) {
      const list = runs(R, C, s);
      const left = new Map();
      for (const L of fleet) left.set(L, (left.get(L) || 0) + 1);
      for (const run of list) {
        if (run.len > maxLen) return false;
        if (run.closed || done) {
          if (!left.get(run.len)) return false;
          left.set(run.len, left.get(run.len) - 1);
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
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const ship = placeFleet(n, fleet);
      if (!ship) continue;
      const R = n, C = n;
      const p = { R, C, fleet, clues: new Int8Array(n * n).fill(-1) };
      for (let k = 0; k < n * n; k++) {
        if (ship[k] || !(Math.random() < 0.5)) continue;
        p.clues[k] = 0;
      }
      const tmp = model(p);
      for (const con of tmp.cons) if (con.at !== undefined && con.cells.length > 1) p.clues[con.at] = con.cells.filter((j) => ship[j]).length;
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = Uint8Array.from(ship, (x) => (x ? YES : NO));
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'minesweeper-battleships',
    name: 'Minesweeper Battleships',
    rules: 'Find the hidden fleet (listed under the grid). Ships are straight lines of cells and never touch each other, ' +
      'not even at a corner. A number tells how many ship parts are in the eight cells around it. Numbered cells hold no ship.',
    controls: 'Click a cell to mark a ship part, click again to mark water. Right click cycles the other way.',
    size: { min: 6, max: 10, def: 8 },
    solvedText: 'Fleet found — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 4 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid clues');
      return { R: n, C: n, fleet: fleetFor(n), clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] >= 0) el.textContent = p.clues[k]; },
    noun: 'ship part', noNoun: 'water cell',
    className: 'bs-board msb-board', yesClass: 'ship', noClass: 'water',
    below: (p) => 'Fleet: ' + p.fleet.map((L) => '■'.repeat(L)).join('  '),
  });
})();
