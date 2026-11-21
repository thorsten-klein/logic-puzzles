// Yagit (Goats and Wolves). Draw lines on cell borders that start and end
// at the outer frame. Lines run straight and may cross, but they turn
// only at dots, and at a dot they never cross. Every region the lines make
// holds goats or wolves, never both, and no region is empty. Not every dot
// must be used.
// The Binary solver runs on inner borders (YES = line).
// p.num: 1 goat (circle), 2 wolf (square).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function prepare(p) {
    const { n } = p;
    p.edges = []; // [cellA, cellB, across?]
    for (let k = 0; k < n * n; k++) {
      if (k % n < n - 1) p.edges.push([k, k + 1, false]); // vertical border
      if (k + n < n * n) p.edges.push([k, k + n, true]); // horizontal border
    }
    const idx = new Map(p.edges.map(([a, b], i) => [a + ',' + b, i]));
    // Points (i, j), 0..n, without frame corners: inner borders meeting there.
    p.points = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const fi = i === 0 || i === n, fj = j === 0 || j === n;
      if (fi && fj) continue;
      const es = [];
      if (i > 0 && j > 0 && j < n) es.push(idx.get(`${(i - 1) * n + j - 1},${(i - 1) * n + j}`));
      if (i < n && j > 0 && j < n) es.push(idx.get(`${i * n + j - 1},${i * n + j}`));
      if (j > 0 && i > 0 && i < n) es.push(idx.get(`${(i - 1) * n + j - 1},${i * n + j - 1}`));
      if (j < n && i > 0 && i < n) es.push(idx.get(`${(i - 1) * n + j},${i * n + j}`));
      const up = i > 0 && j > 0 && j < n ? idx.get(`${(i - 1) * n + j - 1},${(i - 1) * n + j}`) : -1;
      const down = i < n && j > 0 && j < n ? idx.get(`${i * n + j - 1},${i * n + j}`) : -1;
      const left = j > 0 && i > 0 && i < n ? idx.get(`${(i - 1) * n + j - 1},${i * n + j - 1}`) : -1;
      const right = j < n && i > 0 && i < n ? idx.get(`${(i - 1) * n + j},${i * n + j}`) : -1;
      p.points.push({ k: i * (n + 1) + j, es, frame: fi || fj ? 2 : 0, dirs: [up, down, left, right] });
    }
    return p;
  }

  function model(p) {
    const { n, num, edges, points, dot } = p;
    const cons = [];
    for (const { k, es, frame, dirs } of points) {
      if (frame) continue;
      const [up, down, left, right] = dirs;
      if (!dot[k]) {
        // Lines go straight here: up = down and left = right.
        cons.push({ cells: [up, down], w: [1, -1], min: 0, max: 0, why: () => 'Lines turn only at dots, so this line goes straight on.' });
        cons.push({ cells: [left, right], w: [1, -1], min: 0, max: 0, why: () => 'Lines turn only at dots, so this line goes straight on.' });
      } else cons.push({ cells: es, min: 0, max: 2, why: () => 'Lines never cross at a dot.' });
    }
    const at = Array.from({ length: n * n }, () => []);
    edges.forEach(([a, b], i) => { at[a].push([i, b]); at[b].push([i, a]); });
    function check(s, done) {
      // A dot holds no line or exactly one line (two pieces).
      for (const { k, es, frame } of points) {
        if (frame || !dot[k]) continue;
        if (es.every((e) => s[e] !== UNKNOWN) && es.filter((e) => s[e] === YES).length === 1) return false;
      }
      const id = new Int32Array(n * n).fill(-1);
      let g = 0;
      for (let k = 0; k < n * n; k++) {
        if (id[k] >= 0) continue;
        const cells = [k];
        id[k] = g;
        for (let i = 0; i < cells.length; i++) for (const [e, o] of at[cells[i]]) if (id[o] < 0 && s[e] === NO) { id[o] = g; cells.push(o); }
        const kinds = new Set(cells.map((x) => num[x]).filter(Boolean));
        if (kinds.size > 1) return false;
        const closed = done || cells.every((x) => at[x].every(([e, o]) => id[o] === g || s[e] === YES));
        if (closed && !kinds.size) return false;
        g++;
      }
      return true;
    }
    return { N: edges.length, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const p = prepare({ n, num: new Uint8Array(N), dot: new Uint8Array((n + 1) * (n + 1)) });
      for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) if (Math.random() < 0.18) p.dot[i * (n + 1) + j] = 1;
      // Lines: from a frame point inward, straight, turning only at dots.
      const wall = new Uint8Array(p.edges.length);
      const segAt = new Map(); // "i,j,d" -> edge index (d: 0 up 1 down 2 left 3 right from point (i, j))
      for (const pt of p.points) {
        const i = Math.floor(pt.k / (n + 1)), j = pt.k % (n + 1);
        pt.dirs.forEach((e, d) => { if (e >= 0) segAt.set(`${i},${j},${d}`, e); });
      }
      const usedDot = new Set();
      const lines = 2 + Math.floor(Math.random() * n);
      for (let t = 0; t < lines * 4 && wall.reduce((a, b) => a + b, 0) < N; t++) {
        // Start on a frame point, heading in.
        const side = Math.floor(Math.random() * 4), x = 1 + Math.floor(Math.random() * (n - 1));
        let [i, j, d] = [[0, x, 1], [n, x, 0], [x, 0, 3], [x, n, 2]][side];
        const segs = [];
        const dotsHere = [];
        let ok = true;
        for (let guard = 0; guard < 4 * n; guard++) {
          const e = segAt.get(`${i},${j},${d}`);
          if (e === undefined) break;
          if (wall[e] || segs.includes(e)) { ok = false; break; }
          segs.push(e);
          [i, j] = [i + [-1, 1, 0, 0][d], j + [0, 0, -1, 1][d]];
          if (i === 0 || j === 0 || i === n || j === n) break;
          const k = i * (n + 1) + j;
          if (p.dot[k]) {
            if (usedDot.has(k) || dotsHere.includes(k)) { ok = false; break; }
            dotsHere.push(k);
            if (Math.random() < 0.6) d = d < 2 ? (Math.random() < 0.5 ? 2 : 3) : (Math.random() < 0.5 ? 0 : 1);
          }
        }
        if (!ok || !segs.length) continue;
        segs.forEach((e) => { wall[e] = 1; });
        dotsHere.forEach((k) => usedDot.add(k));
      }
      const sol = Uint8Array.from(wall, (v) => (v ? YES : NO));
      // Regions and animals.
      const at = Array.from({ length: N }, () => []);
      p.edges.forEach(([a, b], e) => { at[a].push([e, b]); at[b].push([e, a]); });
      const reg = new Int32Array(N).fill(-1);
      const regs = [];
      for (let k = 0; k < N; k++) {
        if (reg[k] >= 0) continue;
        const cells = [k];
        reg[k] = regs.length;
        for (let q = 0; q < cells.length; q++) for (const [e, o] of at[cells[q]]) if (reg[o] < 0 && !wall[e]) { reg[o] = regs.length; cells.push(o); }
        regs.push(cells);
      }
      if (regs.length < 3) continue;
      const kind = regs.map(() => 1 + Math.floor(Math.random() * 2));
      regs.forEach((cells, g) => { p.num[cells[Math.floor(Math.random() * cells.length)]] = kind[g]; });
      if (model(p).check(sol, true) === false) continue;
      // Add animals until the answer is unique.
      let unique = false;
      for (let add = 0; add < N && Date.now() < deadline; add++) {
        const m = model(p);
        const t = Binary.logicSolve(m);
        if (!t) break;
        if (!t.includes(UNKNOWN)) { unique = m.check(t, true) !== false; break; }
        const r = Binary.solve(m, 2, 4000, t);
        if (r.capped) break;
        if (r.solutions.length === 1) { unique = true; break; }
        const free = [...new Array(N).keys()].filter((k) => !p.num[k]);
        if (!free.length) break;
        const k = free[Math.floor(Math.random() * free.length)];
        p.num[k] = kind[reg[k]];
      }
      if (!unique) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function render(p, state, opts = {}) {
    const { n, num, edges, dot, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const W = n * s;
    const svg = el('svg', { width: W + 8, height: W + 8, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(4 4)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-bg' }, g);
    const seg = ([a, b, across]) => {
      const r = Math.floor(b / n), c = b % n;
      return across ? [c * s, r * s, (c + 1) * s, r * s] : [c * s, r * s, c * s, (r + 1) * s];
    };
    const hintSet = new Set(hint ? hint.cells : []);
    const show = result ? solution : state;
    edges.forEach((e, i) => {
      const [x1, y1, x2, y2] = seg(e);
      let cls = '';
      if (result && state[i] === YES) cls = solution[i] === YES ? ' ok' : ' bad';
      else if (result && solution[i] === YES) cls = state[i] ? ' bad' : ' miss'; // marked "no", or not entered yet
      if (hintSet.has(i)) cls += ' hint';
      // The answer's lines; on the result view also wrong lines (red).
      if (show[i] === YES || cls.includes('bad')) el('line', { x1, y1, x2, y2, class: 'bb-wall' + cls }, g);
      else {
        el('line', { x1, y1, x2, y2, class: 'gx-grid' }, g);
        if (state[i] === NO && !result) {
          const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = s * 0.08;
          el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'lp-cross' }, g);
        }
      }
    });
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-frame', fill: 'none' }, g);
    for (let k = 0; k < (n + 1) * (n + 1); k++) {
      if (!dot[k]) continue;
      el('circle', { cx: (k % (n + 1)) * s, cy: Math.floor(k / (n + 1)) * s, r: s * 0.1, class: 'bb-dot' }, g);
    }
    for (let k = 0; k < n * n; k++) {
      if (!num[k]) continue;
      const cx = (k % n) * s + s / 2, cy = Math.floor(k / n) * s + s / 2;
      if (num[k] === 1) el('circle', { cx, cy, r: s * 0.25, class: 'yg-goat' }, g);
      else el('rect', { x: cx - s * 0.22, y: cy - s * 0.22, width: s * 0.44, height: s * 0.44, class: 'yg-wolf' }, g);
    }
    if (!readonly) edges.forEach((e, i) => {
      const [x1, y1, x2, y2] = seg(e);
      const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.35 }, g);
      const cycle = (back) => { const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO]; state[i] = order[(order.indexOf(state[i]) + 1) % 3]; onChange(); };
      hit.addEventListener('click', () => cycle(false));
      hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
    });
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] !== UNKNOWN && state[i] !== p.solution[i]) return [{ cells: [i], v: UNKNOWN, reason: state[i] === YES ? 'No line goes here.' : 'A line goes here.' }];
    const s = Uint8Array.from(state);
    const log = [];
    Binary.settle(model(p), s, log);
    const step = log.find((x) => x.cells.some((i) => state[i] === UNKNOWN));
    if (step) return [{ cells: step.cells, v: step.v, reason: step.con?.why ? step.con.why(step.v) : 'This follows from the rules.' }];
    const i = p.solution.findIndex((v, j) => state[j] === UNKNOWN && v === YES);
    return i < 0 ? [] : [{ cells: [i], v: YES, reason: 'No one-step deduction is left; this needs a longer chain. A line goes here.' }];
  }

  PuzzleShell.start({
    id: 'yagit',
    name: 'Yagit',
    rules: 'Draw lines on cell borders that start and end at the outer frame. Lines run straight and may cross, but they ' +
      'turn only at dots, and they never cross at a dot. Every region holds goats (circles) or wolves (squares), never ' +
      'both, and no region is empty. Not every dot must be used.',
    controls: 'Click a cell border to draw a line, again for a cross, again to clear. Right click cycles back.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Goats safe from wolves — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, m: Array.from(p.num).join(','), d: Array.from(p.dot).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const num = Uint8Array.from(String(d.m).split(','), Number);
      if (num.length !== n * n || typeof d.d !== 'string' || d.d.length !== (n + 1) * (n + 1)) throw new Error('Invalid puzzle');
      const p = prepare({ n, num, dot: Uint8Array.from(d.d, Number) });
      const m = model(p);
      const t = Binary.logicSolve(m);
      if (t && !t.includes(UNKNOWN) && m.check(t, true) !== false) { p.solution = t; return p; }
      const res = Binary.solve(m, 2, 50000, t || undefined);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.edges.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.edges.length);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => (v === YES) === (p.solution[i] === YES)),
    hints,
    applyHint(p, s, h) { for (const i of h.cells) s[i] = h.v; },
  });
})();
