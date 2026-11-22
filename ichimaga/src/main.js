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
  function findCircleOptions(a, b, C, line, at) {
    const ra = Math.floor(a / C), ca = a % C, rb = Math.floor(b / C), cb = b % C;
    const options = [];
    if (ra === rb || ca === cb) options.push({ cells: line(a, b), corner: -1 });
    else for (const corner of [ra * C + cb, rb * C + ca]) options.push({ cells: [...line(a, corner), corner, ...line(corner, b)], corner });
    return options.filter((o) => !o.cells.some((k) => at.has(k)));
  }

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
    for (let i = 0; i < isl.length; i++) {
      for (let j = i + 1; j < isl.length; j++) {
        for (const o of findCircleOptions(isl[i].k, isl[j].k, C, line, at)) {
          p.pairs.push({ a: i, b: j, cells: o.cells, corner: o.corner });
        }
      }
    }
    p.of = isl.map(() => []);
    p.pairs.forEach((q, j) => { p.of[q.a].push(j); p.of[q.b].push(j); });
    p.cross = p.pairs.map(() => []);
    p.pairs.forEach((q, i) => p.pairs.forEach((o, j) => {
      if (i < j && ((q.a === o.a && q.b === o.b) || q.cells.some((k) => o.cells.includes(k)))) {
        p.cross[i].push(j); p.cross[j].push(i);
      }
    }));
    return p;
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
    const res = PuzzleShell.checkCrossingPairs(p, lo, hi);
    return res !== 0 ? res : checkClosedPairs(p, lo, hi);
  }

  // One round of forced moves. Returns false on contradiction, else the
  // number of changes.
  function step(p, lo, hi) {
    const r = PuzzleShell.islandDegreeStep(p, lo, hi, null, null);
    if (r !== 0) return r;
    const crossRes = checkCrossings(p, lo, hi);
    if (crossRes !== 0) return crossRes;
    if (!PuzzleShell.graphConnected(p, hi)) return -1;
    return 0;
  }

  function settle(p, lo, hi) {
    for (;;) {
      const r = step(p, lo, hi);
      if (r < 0) return false;
      if (r === 0) return true;
    }
  }

  const solve = (p, stopAt = 2, maxNodes = 20000) => PuzzleShell.solveIslandGraph(p, settle, 1, stopAt, maxNodes);

  // --- generator ---
  function buildCircleLegs(fromK, R, C) {
    const STEP = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const d1 = Math.floor(Math.random() * 4), len1 = 1 + Math.floor(Math.random() * 4);
    const turn = Math.random() < 0.5;
    const d2 = (d1 + (Math.random() < 0.5 ? 1 : 3)) % 4, len2 = 1 + Math.floor(Math.random() * 3);
    const cells = [];
    let r = Math.floor(fromK / C), c = fromK % C;
    for (const [dir, len] of (turn ? [[d1, len1], [d2, len2]] : [[d1, len1]])) {
      for (let i = 0; i < len; i++) {
        r += STEP[dir][0]; c += STEP[dir][1];
        if (r < 0 || c < 0 || r >= R || c >= C) return null;
        cells.push(r * C + c);
      }
    }
    return cells;
  }

  function tryAddCirclePath(R, C, isl, grid, joined, add) {
    const from = isl[Math.floor(Math.random() * isl.length)];
    const cells = buildCircleLegs(from.k, R, C);
    if (!cells || cells.length < 2) return;
    const end = cells.pop();
    if (grid[end] === -2 || cells.some((k) => grid[k] !== -1)) return;
    const a = grid[from.k];
    if (grid[end] === -1) {
      const touchesAny = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
        const rr = Math.floor(end / C) + dr, cc = (end % C) + dc;
        return rr >= 0 && cc >= 0 && rr < R && cc < C && grid[rr * C + cc] >= 0;
      });
      if (touchesAny) return;
      add(end);
    } else if (Math.random() < 0.7) return;
    const b = grid[end];
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (a === b || joined.has(key)) return;
    joined.add(key);
    for (const k of cells) grid[k] = -2;
    isl[a].n++;
    isl[b].n++;
  }

  function thinIchimagaGivens(p, unique, deadline) {
    for (const x of PuzzleShell.shuffle(p.isl.slice())) {
      const keep = x.n;
      x.n = -1;
      if (!unique()) x.n = keep;
      if (Date.now() > deadline + 3000) break;
    }
  }

  function generate(n) {
    const R = n, C = n;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const grid = new Int32Array(R * C).fill(-1);
      const isl = [];
      const add = (k) => { grid[k] = isl.length; isl.push({ k, n: 0 }); };
      add(Math.floor(Math.random() * R * C));
      const target = Math.round(R * C * 0.2);
      const joined = new Set();
      for (let tries = 0; tries < 3000 && isl.length < target; tries++) {
        tryAddCirclePath(R, C, isl, grid, joined, add);
      }
      if (isl.length < Math.max(4, target * 0.7)) continue;
      const p = prepare({ R, C, isl });
      const unique = () => { const r = solve(p, 2, 8000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      thinIchimagaGivens(p, unique, deadline);
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
