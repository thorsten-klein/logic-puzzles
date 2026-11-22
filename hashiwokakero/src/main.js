// Hashiwokakero (Bridges). Join the islands with bridges. Each island's
// number is its count of bridges. At most two bridges join two islands,
// bridges run straight, never cross, and all islands end up connected.

(() => {
  // --- puzzle model ---
  // p = { R, C, isl: [{ k, n }] }. Pairs are islands that see each
  // other along a row or column: { a, b, cells } (cells between them).
  function prepare(p) {
    const { R, C, isl } = p;
    const at = new Map(isl.map((x, i) => [x.k, i]));
    p.pairs = [];
    isl.forEach((x, i) => {
      const r = Math.floor(x.k / C), c = x.k % C;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const cells = [];
        let nr = r + dr, nc = c + dc;
        while (nr < R && nc < C && !at.has(nr * C + nc)) { cells.push(nr * C + nc); nr += dr; nc += dc; }
        if (nr < R && nc < C) p.pairs.push({ a: i, b: at.get(nr * C + nc), cells, horiz: dr === 0 });
      }
    });
    p.of = isl.map(() => []);
    p.pairs.forEach((q, j) => { p.of[q.a].push(j); p.of[q.b].push(j); });
    // Pairs that would cross.
    p.cross = p.pairs.map(() => []);
    p.pairs.forEach((q, i) => p.pairs.forEach((o, j) => {
      if (i < j && q.horiz !== o.horiz && q.cells.some((k) => o.cells.includes(k))) { p.cross[i].push(j); p.cross[j].push(i); }
    }));
    return p;
  }

  // Domain per pair: lo[j]..hi[j] bridges (0..2).
  function connected(p, hi) {
    const seen = new Uint8Array(p.isl.length);
    const stack = [0];
    seen[0] = 1;
    while (stack.length) {
      const i = stack.pop();
      for (const j of p.of[i]) {
        if (!hi[j]) continue;
        const o = p.pairs[j].a === i ? p.pairs[j].b : p.pairs[j].a;
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    return seen.every(Boolean);
  }

  function checkCrossingBridges(p, lo, hi, log) {
    for (const [j, crossings] of p.cross.entries()) {
      if (!lo[j]) continue;
      for (const o of crossings) {
        if (lo[o]) return -1;
        if (hi[o]) {
          hi[o] = 0;
          if (log) log.push({ pairs: [o], reason: 'Bridges may not cross. A bridge already runs across here.' });
          return 1;
        }
      }
    }
    return 0;
  }

  function checkClosedPairs(p, lo, hi, log) {
    if (p.isl.length <= 2) return 0;
    for (const [j, pair] of p.pairs.entries()) {
      const na = p.isl[pair.a].n, nb = p.isl[pair.b].n;
      if (na === nb && na <= 2 && hi[j] >= na) {
        hi[j] = na - 1;
        if (lo[j] > hi[j]) return -1;
        if (log) log.push({ pairs: [j], reason: `Two ${na}s joined by ${PuzzleShell.plural(na, 'bridge')} would form a closed group. So they can not be joined that way.` });
        return 1;
      }
    }
    return 0;
  }

  function checkCrossings(p, lo, hi, log) {
    const res = checkCrossingBridges(p, lo, hi, log);
    return res !== 0 ? res : checkClosedPairs(p, lo, hi, log);
  }

  // One round of forced moves. Returns false on contradiction, else the
  // number of changes. `log` gets { pairs, reason } for hints.
  function step(p, lo, hi, log) {
    const N = p.isl.length;
    for (let i = 0; i < N; i++) {
      const need = p.isl[i].n, js = p.of[i];
      const sumLo = js.reduce((a, j) => a + lo[j], 0), sumHi = js.reduce((a, j) => a + hi[j], 0);
      if (sumLo > need || sumHi < need) return -1;
      const changed = [];
      for (const j of js) {
        const minJ = Math.max(lo[j], need - (sumHi - hi[j]));
        const maxJ = Math.min(hi[j], need - (sumLo - lo[j]));
        if (minJ > maxJ) return -1;
        if (minJ !== lo[j] || maxJ !== hi[j]) { lo[j] = minJ; hi[j] = maxJ; changed.push(j); }
      }
      if (changed.length) {
        if (log) {
          let reason = `This ${need} can only reach its number if these bridges are built.`;
          if (sumHi === need) reason = `This ${need} needs every bridge it can still get.`;
          else if (sumLo === need) reason = `This ${need} already has all its bridges.`;
          log.push({ pairs: changed, island: i, reason });
        }
        return changed.length;
      }
    }
    const crossRes = checkCrossings(p, lo, hi, log);
    if (crossRes !== 0) return crossRes;
    if (!connected(p, hi)) return -1;
    return 0;
  }

  function settle(p, lo, hi) {
    for (;;) {
      const r = step(p, lo, hi);
      if (r < 0) return false;
      if (r === 0) return true;
    }
  }

  function solve(p, stopAt = 2, maxNodes = 20000) {
    const solutions = [];
    let nodes = 0;
    (function rec(lo, hi) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!settle(p, lo, hi)) return;
      const j = lo.findIndex((v, i) => v !== hi[i]);
      if (j < 0) {
        if (connected(p, lo)) solutions.push(Int8Array.from(lo));
        return;
      }
      for (let v = hi[j]; v >= lo[j]; v--) {
        const l2 = Int8Array.from(lo), h2 = Int8Array.from(hi);
        l2[j] = v; h2[j] = v;
        rec(l2, h2);
      }
    })(new Int8Array(p.pairs.length), new Int8Array(p.pairs.length).fill(2));
    return { solutions, capped: nodes > maxNodes };
  }

  // --- generator ---
  function generate(n) {
    const R = n, C = n;
    for (let t = 0; t < 200; t++) {
      const grid = new Int32Array(R * C).fill(-1); // island index, -2 = bridge
      const isl = [];
      const bridges = [];
      const add = (k) => { grid[k] = isl.length; isl.push({ k, n: 0 }); };
      add(Math.floor(Math.random() * R * C));
      const target = Math.round(R * C * 0.22);
      for (let tries = 0; tries < 2000 && isl.length < target; tries++) {
        const from = isl[Math.floor(Math.random() * isl.length)];
        const [dr, dc] = [[0, 1], [1, 0], [0, -1], [-1, 0]][Math.floor(Math.random() * 4)];
        const len = 2 + Math.floor(Math.random() * 4);
        const r = Math.floor(from.k / C), c = from.k % C;
        const er = r + dr * len, ec = c + dc * len;
        if (er < 0 || ec < 0 || er >= R || ec >= C) continue;
        const path = [];
        for (let i = 1; i < len; i++) path.push((r + dr * i) * C + c + dc * i);
        const end = er * C + ec;
        if (path.some((k) => grid[k] !== -1)) continue;
        if (grid[end] === -2) continue;
        if (grid[end] === -1) {
          // New islands may not touch other islands.
          const nr = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => {
            const x = er + a, y = ec + b;
            return x >= 0 && y >= 0 && x < R && y < C && grid[x * C + y] >= 0 && x * C + y !== path.at(-1);
          });
          if (nr) continue;
          add(end);
        } else if (Math.random() < 0.7) continue;
        const a = grid[from.k], b = grid[end];
        if (bridges.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) continue;
        const count = Math.random() < 0.35 ? 2 : 1;
        bridges.push({ a, b, count });
        path.forEach((k) => { grid[k] = -2; });
        isl[a].n += count;
        isl[b].n += count;
      }
      if (isl.length < Math.max(4, target * 0.7)) continue;
      const p = prepare({ R, C, isl });
      const res = solve(p, 2);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = res.solutions[0];
      return p;
    }
    return null;
  }

  // --- board ---
  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(p, state, opts = {}) {
    const { R, C, isl, pairs, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(44, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s, height: R * s, class: 'hs-board' + (readonly ? ' readonly' : '') });
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, rx: 6, class: 'hs-bg' }, svg);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const hintSet = new Set(hint ? hint.pairs : []);
    pairs.forEach((q, j) => {
      const [x1, y1] = xy(isl[q.a].k), [x2, y2] = xy(isl[q.b].k);
      // Result view: the answer, but a wrong bridge of the player is drawn
      // as the player built it (red), so it does not just disappear.
      const wrong = result && state[j] && state[j] !== solution[j];
      const v = result && !wrong ? solution[j] : state[j];
      let cls = '';
      if (result && state[j]) cls = state[j] === solution[j] ? ' ok' : ' bad';
      else if (result && solution[j]) cls = ' miss'; // not entered yet
      if (hintSet.has(j)) cls += ' hint';
      const off = s * 0.09;
      const [ox, oy] = q.horiz ? [0, off] : [off, 0];
      if (v === 1) el('line', { x1, y1, x2, y2, class: 'hs-bridge' + cls }, svg);
      if (v === 2) {
        el('line', { x1: x1 - ox, y1: y1 - oy, x2: x2 - ox, y2: y2 - oy, class: 'hs-bridge' + cls }, svg);
        el('line', { x1: x1 + ox, y1: y1 + oy, x2: x2 + ox, y2: y2 + oy, class: 'hs-bridge' + cls }, svg);
      }
      if (!v && hintSet.has(j)) el('line', { x1, y1, x2, y2, class: 'hs-ghost' }, svg);
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'hs-hit', 'stroke-width': s * 0.5 }, svg);
        const cycle = (back) => { state[j] = (state[j] + (back ? 2 : 1)) % 3; onChange(); };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    });
    isl.forEach((x, i) => {
      const [cx, cy] = xy(x.k);
      const have = p.of[i].reduce((a, j) => a + state[j], 0);
      const done = !result && have === x.n;
      const g = el('g', { class: 'hs-island' + (done ? ' done' : '') + (hint && hint.island === i ? ' hint' : '') }, svg);
      el('circle', { cx, cy, r: s * 0.36 }, g);
      const t = el('text', { x: cx, y: cy, 'font-size': s * 0.42 }, g);
      t.textContent = x.n;
    });
    return svg;
  }

  // --- hints ---
  function hints(p, state) {
    const out = [];
    state.forEach((v, j) => {
      if (v && v > p.solution[j]) out.push({ pairs: [j], v: p.solution[j], reason: 'Too many bridges here.' });
    });
    if (out.length) return out;
    const lo = Int8Array.from(state), hi = new Int8Array(state.length).fill(2);
    const log = [];
    for (let i = 0; i < 50 && !log.some((x) => x.pairs.some((j) => lo[j] > state[j])); i++) {
      if (step(p, lo, hi, log) <= 0) break; // nothing more, or a contradiction
    }
    const firstUseful = log.find((x) => x.pairs.some((j) => lo[j] > state[j]));
    if (firstUseful) {
      return [{ pairs: firstUseful.pairs.filter((j) => lo[j] > state[j]), island: firstUseful.island,
        set: firstUseful.pairs.map((j) => [j, Math.max(lo[j], state[j])]), reason: firstUseful.reason }];
    }
    const j = state.findIndex((v, i) => v < p.solution[i]);
    if (j >= 0) return [{ pairs: [j], set: [[j, p.solution[j]]], reason: 'No simple step is left. These islands are joined here.' }];
    return [];
  }

  PuzzleShell.start({
    id: 'hashiwokakero',
    name: 'Hashiwokakero',
    rules: 'Connect the islands with bridges. Each number tells how many bridges touch that island. ' +
      'Bridges run straight across or down, never cross, and at most two join the same pair of islands. ' +
      'In the end every island must be connected to every other.',
    controls: 'Click between two islands to add a bridge, again for a double bridge, again to remove. Right click goes back.',
    size: { min: 5, max: 12, def: 7 },
    solvedText: 'All islands linked — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, i: p.isl.map((x) => `${x.k}.${x.n}`).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 25)) throw new Error('Invalid board size');
      const isl = String(d.i).split(',').map((s) => { const [k, n] = s.split('.').map(Number); return { k, n }; });
      if (isl.some((x) => !(x.k >= 0 && x.k < R * C && x.n >= 1 && x.n <= 8))) throw new Error('Invalid islands');
      const p = prepare({ R, C, isl });
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.pairs.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.pairs.length);
      if (typeof v === 'string' && v.length === s.length) for (let j = 0; j < s.length; j++) s[j] = Number(v[j]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, j) => v === p.solution[j]),
    hints,
    applyHint(p, s, h) {
      if (h.set) for (const [j, v] of h.set) s[j] = v;
      else for (const j of h.pairs) s[j] = h.v;
    },
  });
})();
