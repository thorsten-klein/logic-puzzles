// Galaxies. Split the grid into regions along cell borders. Each region
// holds exactly one dot and looks the same when turned half a turn
// around that dot.
//
// Dots use half-cell coordinates: (y, x) with y in 1..2R-1, x in 1..2C-1.
// Cell (r, c) has centre (2r+1, 2c+1). Its mirror around dot (y, x) is
// cell (y - r - 1, x - c - 1).

(() => {
  // --- solver ---
  // cand[k] = Set of dot indexes cell k may belong to.
  function coreCells(p, d) {
    const { y, x } = p.dots[d];
    const rows = y % 2 ? [(y - 1) / 2] : [y / 2 - 1, y / 2];
    const cols = x % 2 ? [(x - 1) / 2] : [x / 2 - 1, x / 2];
    const out = [];
    for (const r of rows) for (const c of cols) out.push(r * p.C + c);
    return out;
  }

  function mirror(p, k, d) {
    const r = Math.floor(k / p.C), c = k % p.C;
    const { y, x } = p.dots[d];
    const mr = y - r - 1, mc = x - c - 1;
    return mr >= 0 && mc >= 0 && mr < p.R && mc < p.C ? mr * p.C + mc : -1;
  }

  function startCand(p) {
    const N = p.R * p.C;
    const cand = Array.from({ length: N }, (_, k) => new Set(p.dots.map((_, d) => d).filter((d) => mirror(p, k, d) >= 0)));
    p.dots.forEach((_, d) => { for (const k of coreCells(p, d)) cand[k] = new Set([d]); });
    return cand;
  }

  function neighbours(p, k) {
    const r = Math.floor(k / p.C), c = k % p.C, out = [];
    if (r > 0) out.push(k - p.C);
    if (r < p.R - 1) out.push(k + p.C);
    if (c > 0) out.push(k - 1);
    if (c < p.C - 1) out.push(k + 1);
    return out;
  }

  function propagate(p, cand) {
    const N = p.R * p.C;
    for (let guard = 0; guard < 200; guard++) {
      let changed = false;
      for (let k = 0; k < N; k++) {
        for (const d of [...cand[k]]) {
          const m = mirror(p, k, d);
          if (m < 0 || !cand[m].has(d)) { cand[k].delete(d); changed = true; }
        }
        if (!cand[k].size) return false;
      }
      // Each dot's area must connect to its core.
      for (let d = 0; d < p.dots.length; d++) {
        const seen = new Uint8Array(N);
        const stack = coreCells(p, d).filter((k) => cand[k].has(d));
        if (stack.length !== coreCells(p, d).length) return false;
        stack.forEach((k) => { seen[k] = 1; });
        while (stack.length) {
          const k = stack.pop();
          for (const j of neighbours(p, k)) if (!seen[j] && cand[j].has(d)) { seen[j] = 1; stack.push(j); }
        }
        for (let k = 0; k < N; k++) {
          if (!seen[k] && cand[k].has(d)) { cand[k].delete(d); changed = true; if (!cand[k].size) return false; }
        }
      }
      if (!changed) return true;
    }
    return true;
  }

  function solve(p, stopAt = 2, maxNodes = 5000) {
    const solutions = [];
    let nodes = 0;
    (function rec(cand) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      let pick = -1, best = 1e9;
      cand.forEach((s, k) => { if (s.size > 1 && s.size < best) { best = s.size; pick = k; } });
      if (pick < 0) { solutions.push(Int32Array.from(cand, (s) => [...s][0])); return; }
      for (const d of cand[pick]) {
        const copy = cand.map((s) => new Set(s));
        copy[pick] = new Set([d]);
        const m = mirror(p, pick, d);
        copy[m] = new Set([d]);
        rec(copy);
      }
    })(startCand(p));
    return { solutions, capped: nodes > maxNodes };
  }

  // --- generator: grow symmetric regions one by one ---
  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const owner = new Int32Array(N).fill(-1);
    const dots = [];
    const p = { R, C, dots };
    for (let guard = 0; guard < N * 4; guard++) {
      const free = [];
      for (let k = 0; k < N; k++) if (owner[k] < 0) free.push(k);
      if (!free.length) break;
      const k0 = free[Math.floor(Math.random() * free.length)];
      const r0 = Math.floor(k0 / C), c0 = k0 % C;
      // Dot at the cell centre, or on its right / bottom edge, or corner.
      const [dy, dx] = [[0, 0], [0, 1], [1, 0], [1, 1]][Math.floor(Math.random() * 4)];
      if (2 * r0 + 1 + dy > 2 * R - 1 || 2 * c0 + 1 + dx > 2 * C - 1) continue;
      dots.push({ y: 2 * r0 + 1 + dy, x: 2 * c0 + 1 + dx });
      const d = dots.length - 1;
      const core = coreCells(p, d);
      if (core.some((k) => k < 0 || k >= N || owner[k] >= 0) || core.some((k) => mirror(p, k, d) < 0)) {
        dots.pop();
        continue;
      }
      core.forEach((k) => { owner[k] = d; });
      const size = 2 + Math.floor(Math.random() * Math.max(2, n));
      let cells = core.length;
      for (let t = 0; t < 40 && cells < size; t++) {
        const front = [];
        for (let k = 0; k < N; k++) {
          if (owner[k] !== d) continue;
          for (const j of neighbours(p, k)) {
            const m = mirror(p, j, d);
            if (owner[j] < 0 && m >= 0 && owner[m] < 0) front.push(j);
          }
        }
        if (!front.length) break;
        const j = front[Math.floor(Math.random() * front.length)];
        const m = mirror(p, j, d);
        owner[j] = d;
        owner[m] = d;
        cells += j === m ? 1 : 2;
      }
    }
    if (owner.some((v) => v < 0)) return null;
    const res = solve(p, 2);
    if (res.solutions.length !== 1 || res.capped) return null;
    p.solution = walls(p, res.solutions[0]);
    p.owner = res.solutions[0];
    return p;
  }

  // Wall edges (Loop-style edge indexes) between different owners.
  function walls(p, owner) {
    const { R, C } = p;
    const w = new Uint8Array(R * (C - 1) + (R - 1) * C);
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) w[r * (C - 1) + c] = owner[r * C + c] !== owner[r * C + c + 1] ? 1 : 0;
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) w[R * (C - 1) + r * C + c] = owner[r * C + c] !== owner[(r + 1) * C + c] ? 1 : 0;
    return w;
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
    const { R, C, dots, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s + 4, height: R * s + 4, class: 'gx-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-bg' }, g);
    const hintSet = new Set(hint ? hint.edges : []);
    const edges = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) edges.push([r * (C - 1) + c, (c + 1) * s, r * s, (c + 1) * s, (r + 1) * s]);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) edges.push([R * (C - 1) + r * C + c, c * s, (r + 1) * s, (c + 1) * s, (r + 1) * s]);
    for (const [e, x1, y1, x2, y2] of edges) {
      const v = result ? solution[e] : state[e];
      let cls = v ? 'gx-wall' : 'gx-grid';
      if (result && state[e]) cls += solution[e] ? ' ok' : ' bad';
      if (result && !solution[e] && state[e]) cls = 'gx-wall bad';
      if (result && solution[e] && !state[e]) cls += ' miss'; // not entered yet
      if (hintSet.has(e)) cls += ' hint';
      el('line', { x1, y1, x2, y2, class: cls }, g);
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.35 }, g);
        hit.addEventListener('click', () => { state[e] = state[e] ? 0 : 1; onChange(); });
      }
    }
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-frame' }, g);
    for (const { y, x } of dots) {
      el('circle', { cx: (x * s) / 2, cy: (y * s) / 2, r: s * 0.16, class: 'gx-dot' }, g);
    }
    return svg;
  }

  function hints(p, state) {
    const out = [];
    state.forEach((v, e) => { if (v && !p.solution[e]) out.push({ edges: [e], v: 0, reason: 'This wall is wrong.' }); });
    if (out.length) return out.slice(0, 1);
    const e = p.solution.findIndex((v, i) => v && !state[i]);
    if (e >= 0) out.push({ edges: [e], v: 1, reason: 'No simple step is shown here. A wall of the answer goes here.' });
    return out;
  }

  PuzzleShell.start({
    id: 'galaxies',
    name: 'Galaxies',
    rules: 'Draw walls along the grid lines to split the grid into galaxies. Each galaxy holds exactly one dot, ' +
      'and looks the same when turned half a turn around its dot.',
    controls: 'Click a grid line between two cells to draw a wall, click again to remove it.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Every galaxy is in balance — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ r: p.R, c: p.C, d: p.dots.map(({ y, x }) => `${y}.${x}`).join(',') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      const dots = String(d.d).split(',').map((s) => { const [y, x] = s.split('.').map(Number); return { y, x }; });
      if (dots.some(({ y, x }) => !(y >= 1 && y <= 2 * R - 1 && x >= 1 && x <= 2 * C - 1))) throw new Error('Invalid dots');
      const p = { R, C, dots };
      const res = solve(p, 2, 20000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.owner = res.solutions[0];
      p.solution = walls(p, p.owner);
      return p;
    },
    newState: (p) => new Uint8Array(p.R * (p.C - 1) + (p.R - 1) * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.R * (p.C - 1) + (p.R - 1) * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) ? 1 : 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, e) => v === p.solution[e]),
    hints,
    applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; },
  });
})();
