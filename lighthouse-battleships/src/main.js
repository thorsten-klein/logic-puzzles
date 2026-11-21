// Lighthouse Battleships. Find the fleet. Ships are straight lines of
// cells and never touch each other, not even at a corner. A lighthouse
// (a number) tells how many ship cells lie in its row and its column
// together. Ships never touch a lighthouse, not even at a corner. Some
// cells may be revealed. Built on the shared Binary game page.
// p.light: 0 none, v + 1 lighthouse with number v.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function fleetFor(n) {
    if (n <= 6) return [3, 2, 1, 1];
    if (n <= 8) return [3, 2, 2, 1, 1];
    return [4, 3, 2, 2, 1, 1];
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
    const { R, C, light, given, fleet } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      if (given[k]) cons.push({ cells: [k], min: given[k] === YES ? 1 : 0, max: given[k] === YES ? 1 : 0 });
    }
    for (let k = 0; k < R * C; k++) {
      if (!light[k]) continue;
      const r = Math.floor(k / C), c = k % C, v = light[k] - 1;
      const near = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if (a >= 0 && b >= 0 && a < R && b < C) near.push(a * C + b);
      }
      cons.push({ cells: near, min: 0, max: 0, why: () => 'Ships never touch a lighthouse.' });
      const line = [];
      for (let i = 0; i < C; i++) if (i !== c) line.push(r * C + i);
      for (let i = 0; i < R; i++) if (i !== r) line.push(i * C + c);
      cons.push({ cells: line, min: v, max: v, area: line, why: (x) => (x === YES ? `This lighthouse sees ${v} ship cells; they must fill the open cells.` : `This lighthouse already sees its ${v} ship cells. The rest is water.`) });
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
    // Lighthouses on water cells away from all ships.
    const light = new Uint8Array(n * n);
    const nearShip = (k) => { const r = Math.floor(k / n), c = k % n; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const a = r + dr, b = c + dc; if (a >= 0 && b >= 0 && a < n && b < n && ship[a * n + b]) return true; } return false; };
    const spots = PuzzleShell.shuffle([...new Array(n * n).keys()].filter((k) => !nearShip(k)));
    for (const k of spots.slice(0, Math.round(n * n / 4))) {
      const r = Math.floor(k / n), c = k % n;
      let v = 0;
      for (let i = 0; i < n; i++) { if (i !== c) v += ship[r * n + i]; if (i !== r) v += ship[i * n + c]; }
      light[k] = v + 1;
    }
    if (light.filter(Boolean).length < 3) return generate(n);
    const p = { R: n, C: n, light, fleet, given: new Uint8Array(n * n) };
    // Reveal cells where another answer differs, until unique.
    for (let guard = 0; guard < n * n; guard++) {
      const res = Binary.solve(model(p), 2, 20000);
      if (res.solutions.length === 1 && !res.capped) break;
      const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
      const diff = [...sol.keys()].filter((k) => !p.given[k] && !light[k] && (!other || other[k] !== sol[k]));
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


  Binary.startGame({
    id: 'lighthouse-battleships',
    name: 'Lighthouse Battleships',
    rules: 'Find the hidden fleet (listed under the grid). Ships are straight lines of cells and never touch each other, ' +
      'not even at a corner. A lighthouse (orange circle with a number) tells how many ship cells lie in its row and its ' +
      'column together. Ships never touch a lighthouse, not even at a corner. Some cells may be revealed.',
    controls: 'Click a cell to mark a ship part, click again to mark water. Right click cycles the other way.',
    size: { min: 6, max: 10, def: 8 },
    solvedText: 'The lighthouses guided you home — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, l: Array.from(p.light).join(','), g: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 4 || n > 15) throw new Error('Invalid board size');
      const light = Uint8Array.from(String(d.l).split(','), Number);
      if (light.length !== n * n) throw new Error('Invalid lighthouses');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[012]+$/.test(d.g)) throw new Error('Invalid reveals');
      return { R: n, C: n, light, fleet: fleetFor(n), given: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => (p.light[k] ? NO : p.given[k]),
    draw(p, k, el) { if (p.light[k]) { el.classList.add('lh'); el.textContent = p.light[k] - 1; } },
    noun: 'ship part', noNoun: 'water cell',
    className: 'bs-board', yesClass: 'ship', noClass: 'water',
    below: (p) => 'Fleet: ' + p.fleet.map((L) => '■'.repeat(L)).join('  '),
  });

})();
