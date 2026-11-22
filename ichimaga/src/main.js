// Ichimaga. Join all circles with lines across and down. A line runs
// from circle to circle and turns at most once. Lines never cross or
// touch each other, and all circles end up connected. A number tells how
// many lines touch its circle; a circle without a number needs at least
// one. Adapted from Korekutokonekuto: each pair of circles has up to
// three line options (straight, or an L through one of two corners).

(() => {
  // --- puzzle model ---
  // p = { R, C, isl: [{ k, n }] }. Pairs are islands that see each
  // other along a row or column: { a, b, cells } (cells between them).
  function prepare(p) {
    const { C, isl } = p;
    const at = new Map(isl.map((x, i) => [x.k, i]));
    const line = (a, b) => {
      const ra = Math.floor(a / C), ca = a % C, rb = Math.floor(b / C), cb = b % C;
      const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca), out = [];
      for (let r = ra + dr, c = ca + dc; r !== rb || c !== cb; r += dr, c += dc) out.push(r * C + c);
      return out;
    };
    p.pairs = [];
    for (let i = 0; i < isl.length; i++) for (let j = i + 1; j < isl.length; j++) {
      const a = isl[i].k, b = isl[j].k;
      const ra = Math.floor(a / C), ca = a % C, rb = Math.floor(b / C), cb = b % C;
      const options = [];
      if (ra === rb || ca === cb) options.push({ cells: line(a, b), corner: -1 });
      else for (const corner of [ra * C + cb, rb * C + ca]) options.push({ cells: [...line(a, corner), corner, ...line(corner, b)], corner });
      for (const o of options) if (!o.cells.some((k) => at.has(k))) p.pairs.push({ a: i, b: j, cells: o.cells, corner: o.corner });
    }
    p.of = isl.map(() => []);
    p.pairs.forEach((q, j) => { p.of[q.a].push(j); p.of[q.b].push(j); });
    // Options that clash: they share a cell, or join the same two circles.
    p.cross = p.pairs.map(() => []);
    p.pairs.forEach((q, i) => p.pairs.forEach((o, j) => {
      if (i >= j) return;
      if ((q.a === o.a && q.b === o.b) || q.cells.some((k) => o.cells.includes(k))) { p.cross[i].push(j); p.cross[j].push(i); }
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

  function checkCrossingLines(p, lo, hi) {
    for (let j = 0; j < p.pairs.length; j++) {
      if (!lo[j]) continue;
      for (const o of p.cross[j]) {
        if (lo[o]) return -1;
        if (hi[o]) {
          hi[o] = 0;
          return 1;
        }
      }
    }
    return 0;
  }

  function checkClosedPairs(p, lo, hi) {
    if (p.isl.length <= 2) return 0;
    for (let j = 0; j < p.pairs.length; j++) {
      const { a, b } = p.pairs[j];
      const na = p.isl[a].n, nb = p.isl[b].n;
      if (na === 1 && nb === 1 && hi[j] >= 1) {
        hi[j] = 0;
        if (lo[j] > hi[j]) return -1;
        return 1;
      }
    }
    return 0;
  }

  function checkCrossings(p, lo, hi) {
    const res = checkCrossingLines(p, lo, hi);
    return res !== 0 ? res : checkClosedPairs(p, lo, hi);
  }

  // One round of forced moves. Returns false on contradiction, else the
  // number of changes.
  function step(p, lo, hi) {
    const N = p.isl.length;
    for (let i = 0; i < N; i++) {
      const n = p.isl[i].n, js = p.of[i];
      const least = n < 0 ? 1 : n, most = n < 0 ? 99 : n;
      const sumLo = js.reduce((a, j) => a + lo[j], 0), sumHi = js.reduce((a, j) => a + hi[j], 0);
      if (sumLo > most || sumHi < least) return -1;
      const changed = [];
      for (const j of js) {
        const minJ = Math.max(lo[j], least - (sumHi - hi[j]));
        const maxJ = Math.min(hi[j], most - (sumLo - lo[j]));
        if (minJ > maxJ) return -1;
        if (minJ !== lo[j] || maxJ !== hi[j]) { lo[j] = minJ; hi[j] = maxJ; changed.push(j); }
      }
      if (changed.length) return changed.length;
    }
    const crossRes = checkCrossings(p, lo, hi);
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
    })(new Int8Array(p.pairs.length), new Int8Array(p.pairs.length).fill(1));
    return { solutions, capped: nodes > maxNodes };
  }

  // --- generator ---
  function generate(n) {
    const R = n, C = n;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const grid = new Int32Array(R * C).fill(-1); // circle index, -2 = line
      const isl = [];
      const add = (k) => { grid[k] = isl.length; isl.push({ k, n: 0 }); };
      add(Math.floor(Math.random() * R * C));
      const target = Math.round(R * C * 0.2);
      const joined = new Set();
      for (let tries = 0; tries < 3000 && isl.length < target; tries++) {
        const from = isl[Math.floor(Math.random() * isl.length)];
        const STEP = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const d1 = Math.floor(Math.random() * 4), len1 = 1 + Math.floor(Math.random() * 4);
        const turn = Math.random() < 0.5;
        const d2 = (d1 + (Math.random() < 0.5 ? 1 : 3)) % 4, len2 = 1 + Math.floor(Math.random() * 3);
        const cells = [];
        let r = Math.floor(from.k / C), c = from.k % C, ok = true;
        const walk = (d, len) => {
          for (let i = 0; i < len; i++) {
            r += STEP[d][0]; c += STEP[d][1];
            if (r < 0 || c < 0 || r >= R || c >= C) { ok = false; return; }
            cells.push(r * C + c);
          }
        };
        walk(d1, len1);
        if (ok && turn) walk(d2, len2);
        if (!ok || cells.length < 2) continue;
        const end = cells.pop();
        if (cells.some((k) => grid[k] !== -1) || grid[end] === -2) continue;
        if (grid[end] === -1) {
          const touch = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => {
            const x = Math.floor(end / C) + a, y = (end % C) + b;
            return x >= 0 && y >= 0 && x < R && y < C && grid[x * C + y] >= 0;
          });
          if (touch) continue;
          add(end);
        } else if (Math.random() < 0.7) continue;
        const a = grid[from.k], b = grid[end];
        const key = Math.min(a, b) + ':' + Math.max(a, b);
        if (a === b || joined.has(key)) continue;
        joined.add(key);
        cells.forEach((k) => { grid[k] = -2; });
        isl[a].n++;
        isl[b].n++;
      }
      if (isl.length < Math.max(4, target * 0.7)) continue;
      const p = prepare({ R, C, isl });
      const unique = () => { const r = solve(p, 2, 8000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const x of PuzzleShell.shuffle(isl.slice())) {
        const keep = x.n;
        x.n = -1;
        if (!unique()) x.n = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = solve(p, 1).solutions[0];
      p.edges = edgesOf(p, p.solution);
      return p;
    }
    return null;
  }

  // --- board: the player draws on cell edges like in the loop games ---
  // Edges used by the chosen line options.
  function edgesOf(p, sol) {
    const g = Loop.grid(p.R, p.C);
    const edge = new Map();
    for (let e = 0; e < g.E; e++) edge.set(g.ends[e].join(','), e);
    const out = new Uint8Array(g.E).fill(Loop.CROSS);
    sol.forEach((v, j) => {
      if (!v) return;
      const q = p.pairs[j];
      const path = [p.isl[q.a].k];
      const order = q.cells.slice();
      // Cells of a line run from circle a to circle b.
      path.push(...order, p.isl[q.b].k);
      for (let i = 0; i + 1 < path.length; i++) out[edge.get([path[i], path[i + 1]].sort((x, y) => x - y).join(','))] = Loop.LINE;
    });
    return out;
  }

  function drawCell(p) {
    const at = new Map(p.isl.map((x) => [x.k, x]));
    return (svg, k, x, y, s) => {
      const c = at.get(k);
      if (!c) return;
      const NS = 'http://www.w3.org/2000/svg';
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
      if (c.n < 0) return;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.34);
      t.setAttribute('class', 'll-num');
      t.textContent = c.n;
      svg.appendChild(t);
    };
  }

  function render(p, state, opts = {}) {
    const m = { g: Loop.grid(p.R, p.C) };
    return Loop.render(m, state, { ...opts, solution: p.edges, fixed: [] }, drawCell(p), true);
  }

  function hints(p, state) {
    const { LINE, CROSS } = Loop;
    for (let e = 0; e < state.length; e++) {
      if (state[e] === LINE && p.edges[e] !== LINE) return [{ edges: [e], v: CROSS, reason: 'No line goes here.' }];
    }
    // Next: a whole line of the answer that is not drawn yet.
    for (let j = 0; j < p.pairs.length; j++) {
      if (!p.solution[j]) continue;
      const one = edgesOf(p, Int8Array.from(p.solution, (v, i) => (i === j ? 1 : 0)));
      const missing = [...one.keys()].filter((e) => one[e] === LINE && state[e] !== LINE);
      if (missing.length) return [{ edges: missing, v: LINE, reason: 'No simple step is left. This line from circle to circle belongs to the answer.' }];
    }
    return [];
  }

  PuzzleShell.start({
    id: 'ichimaga',
    name: 'Ichimaga',
    rules: 'Join all circles with lines across and down. Each line runs from one circle to another and turns at most ' +
      'once. Lines never cross or touch each other, and in the end all circles are connected. A number tells how many ' +
      'lines touch its circle; a circle without a number needs at least one line.',
    controls: 'Click between two cells to draw a line, click again for a cross, again to clear. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'All circles linked — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, i: p.isl.map((x) => `${x.k}.${x.n}`).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 25)) throw new Error('Invalid board size');
      const isl = String(d.i).split(',').map((s) => { const [k, n] = s.split('.').map(Number); return { k, n }; });
      if (isl.some((x) => !(x.k >= 0 && x.k < R * C && (x.n === -1 || (x.n >= 1 && x.n <= 4))))) throw new Error('Invalid circles');
      const p = prepare({ R, C, isl });
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      p.edges = edgesOf(p, p.solution);
      return p;
    },
    newState: (p) => new Uint8Array(Loop.grid(p.R, p.C).E),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(Loop.grid(p.R, p.C).E);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, e) => (v === Loop.LINE) === (p.edges[e] === Loop.LINE)),
    hints,
    applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; },
  });
})();
