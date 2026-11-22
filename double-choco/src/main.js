// Double Choco. Half of the cells are grey. Draw walls to divide the
// grid into regions. Each region holds one white area and one grey area
// of the same shape and size (they may be turned or mirrored). A number
// tells how many cells of its own colour its region holds.
// The Binary solver runs on inner borders (YES = wall).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function prepare(p) {
    const { n } = p;
    p.edges = [];
    for (let k = 0; k < n * n; k++) {
      if (k % n < n - 1) p.edges.push([k, k + 1, false]);
      if (k + n < n * n) p.edges.push([k, k + n, true]);
    }
    return p;
  }

  function shapeKey(n, cells) {
    const pts = cells.map((k) => [Math.floor(k / n), k % n]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let a = r, b = c;
        if (t & 1) [a, b] = [b, -a];
        if (t & 2) [a, b] = [-a, -b];
        if (t & 4) b = -b;
        return [a, b];
      });
      const r0 = Math.min(...q.map((x) => x[0])), c0 = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - r0},${b - c0}`).sort().join(' '));
    }
    return keys.sort()[0];  // smallest key
  }
  const connected = (n, cells) => {
    if (!cells.length) return false;
    const set = new Set(cells), seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) {
      const k = st.pop();
      for (const j of [k - n, k + n, k % n ? k - 1 : -1, (k + 1) % n ? k + 1 : -1]) if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); }
    }
    return seen.size === cells.length;
  };

  function model(p) {
    const { n, num, grey, edges } = p;
    const cons = [];
    // Two cells with numbers of one colour but different values are apart.
    edges.forEach(([a, b], i) => {
      if (num[a] && num[b] && grey[a] === grey[b] && num[a] !== num[b]) cons.push({ cells: [i], min: 1, max: 1, why: () => 'These numbers differ, so the cells are in different regions.' });
    });
    const at = Array.from({ length: n * n }, () => []);
    edges.forEach(([a, b], i) => { at[a].push([i, b]); at[b].push([i, a]); });
    function check(s, done) {
      const id = new Int32Array(n * n).fill(-1);
      let g = 0;
      for (let k = 0; k < n * n; k++) {
        if (id[k] >= 0) continue;
        const cells = [k];
        id[k] = g;
        for (const cur of cells) for (const [e, o] of at[cur]) if (id[o] < 0 && s[e] === NO) { id[o] = g; cells.push(o); }
        const white = cells.filter((x) => !grey[x]), dark = cells.filter((x) => grey[x]);
        // A region with number m holds m white and m grey cells.
        for (const x of cells) if (num[x] && (dark.length > num[x] || white.length > num[x])) return false;
        const closed = done || cells.every((x) => at[x].every(([e, o]) => id[o] === g || s[e] === YES));
        if (closed) {
          if (white.length !== dark.length || !connected(n, white) || !connected(n, dark)) return false;
          if (shapeKey(n, white) !== shapeKey(n, dark)) return false;
          if (cells.some((x) => num[x] && num[x] !== white.length)) return false;
        }
        g++;
      }
      for (let i = 0; i < edges.length; i++) if (s[i] === YES && id[edges[i][0]] === id[edges[i][1]]) return false;
      return true;
    }
    return { N: edges.length, cons, check };
  }

  // Tile the grid with regions: a small shape plus a turned or mirrored
  // copy next to it. Returns { region per cell, grey } or null.
  function randomTiling(n, deadline) {
    const N = n * n;
    const reg = new Int32Array(N).fill(-1);
    const grey = new Uint8Array(N);
    let count = 0;
    const shapes = [[[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, -1], [1, 0]]];
    const tf = (pts, t) => pts.map(([r, c]) => {
      let a = r, b = c;
      if (t & 1) [a, b] = [b, -a];
      if (t & 2) [a, b] = [-a, -b];
      if (t & 4) b = -b;
      return [a, b];
    });
    const rec = () => {
      if (Date.now() > deadline) return false;
      const k = reg.indexOf(-1);
      if (k < 0) return true;
      const r = Math.floor(k / n), c = k % n;
      for (const sh of PuzzleShell.shuffle(shapes.slice())) {
        const A = sh.map(([a, b]) => [r + a, c + b]);
        if (A.some(([a, b]) => a < 0 || b < 0 || a >= n || b >= n || reg[a * n + b] >= 0)) continue;
        const Ak = A.map(([a, b]) => a * n + b);
        // Place a copy touching A.
        const tries = [];
        for (let t = 0; t < 8; t++) for (const [ar, ac] of A) for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) tries.push([t, ar + dr, ac + dc]);
        for (const [t, r0, c0] of PuzzleShell.shuffle(tries).slice(0, 24)) {
          const q = tf(sh, t);
          for (const [qa, qb] of q) {
            const B = q.map(([a, b]) => [r0 + a - qa, c0 + b - qb]);
            if (B.some(([a, b]) => a < 0 || b < 0 || a >= n || b >= n || reg[a * n + b] >= 0)) continue;
            const Bk = B.map(([a, b]) => a * n + b);
            if (Bk.some((x) => Ak.includes(x))) continue;
            const g = Math.random() < 0.5;
            Ak.forEach((x) => { reg[x] = count; grey[x] = g ? 1 : 0; });
            Bk.forEach((x) => { reg[x] = count; grey[x] = g ? 0 : 1; });
            count++;
            if (rec()) return true;
            count--;
            Ak.concat(Bk).forEach((x) => { reg[x] = -1; grey[x] = 0; });
          }
        }
      }
      return false;
    };
    return rec() ? { reg, grey } : null;
  }

  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const N = n * n;
      const til = randomTiling(n, Math.min(deadline, Date.now() + 1000));
      if (!til) continue;
      const { reg, grey } = til;
      const p = prepare({ n, grey, num: new Uint8Array(N) });
      const sol = Uint8Array.from(p.edges, ([a, b]) => (reg[a] !== reg[b] ? YES : NO));
      // A number in every region to start.
      const rooms = [];
      reg.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
      for (const cells of rooms) p.num[cells[Math.floor(Math.random() * cells.length)]] = cells.length / 2;
      const unique = () => {
        const m = model(p);
        const t = Binary.logicSolve(m);
        if (t && !t.includes(UNKNOWN)) return m.check(t, true) !== false;
        if (!t) return false;
        const r = Binary.solve(m, 2, 4000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      // Repair: while another answer exists, add a number where that
      // answer's region has a different size (rooms may hold several numbers).
      const sizeIn = (walls) => {
        const id = new Int32Array(N).fill(-1), size = [];
        for (let k = 0; k < N; k++) {
          if (id[k] >= 0) continue;
          const st = [k]; id[k] = size.length; let cnt = 0;
          while (st.length) { const x = st.pop(); cnt++; p.edges.forEach(([a, b], e) => { if (walls[e] !== YES && (a === x || b === x)) { const o = a === x ? b : a; if (id[o] < 0) { id[o] = size.length; st.push(o); } } }); }
          size.push(cnt);
        }
        return Int32Array.from(id, (g) => size[g]);
      };
      const mine = sizeIn(sol);
      let ok = false;
      for (let fix = 0; fix < 30 && Date.now() < deadline; fix++) {
        if (unique()) { ok = true; break; }
        const r = Binary.solve(model(p), 2, 4000);
        if (r.capped) break;
        const other = r.solutions.find((x) => x.some((v, e) => v !== sol[e]));
        if (!other) break;
        const theirs = sizeIn(other);
        const spots = [...new Array(N).keys()].filter((k) => !p.num[k] && theirs[k] !== mine[k]);
        if (!spots.length) break;
        const k = spots[Math.floor(Math.random() * spots.length)];
        p.num[k] = mine[k] / 2;
      }
      if (!ok) continue;
      const stop = Date.now() + 1500;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!p.num[k]) continue;
        const keep = p.num[k];
        p.num[k] = 0;
        if (!unique()) p.num[k] = keep;
        if (Date.now() > stop) break;
      }
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
    const { n, num, edges, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const W = n * s;
    const svg = el('svg', { width: W + 8, height: W + 8, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(4 4)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-bg' }, g);
    for (let k = 0; k < n * n; k++) if (p.grey[k]) el('rect', { x: (k % n) * s, y: Math.floor(k / n) * s, width: s, height: s, class: 'dc-grey' }, g);
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
    for (let k = 0; k < n * n; k++) {
      if (!num[k]) continue;
      el('text', { x: (k % n) * s + s / 2, y: Math.floor(k / n) * s + s / 2, 'font-size': s * 0.42, class: 'pt-clue' }, g).textContent = num[k];
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
    for (let i = 0; i < state.length; i++) if (state[i] !== UNKNOWN && state[i] !== p.solution[i]) return [{ cells: [i], v: UNKNOWN, reason: state[i] === YES ? 'No wall goes here.' : 'A wall goes here.' }];
    const s = Uint8Array.from(state);
    const log = [];
    Binary.settle(model(p), s, log);
    const step = log.find((x) => x.cells.some((i) => state[i] === UNKNOWN));
    if (step) return [{ cells: step.cells, v: step.v, reason: step.con?.why ? step.con.why(step.v) : 'This follows from the rules.' }];
    const i = p.solution.findIndex((v, j) => state[j] === UNKNOWN && v === YES);
    return i < 0 ? [] : [{ cells: [i], v: YES, reason: 'No one-step deduction is left; this needs a longer chain. A wall goes here.' }];
  }

  PuzzleShell.start({
    id: 'double-choco',
    name: 'Double Choco',
    rules: 'Half of the cells are grey. Draw walls on cell borders to divide the grid into regions. Each region holds ' +
      'one white area and one grey area with the same shape and size (they may be turned or mirrored). A number tells ' +
      'how many cells of its own colour its region holds.',
    controls: 'Click a cell border to draw a wall, again for a cross, again to clear. Right click cycles back.',
    size: { min: 2, max: 3, def: 2, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Perfectly split chocolate — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, m: Array.from(p.num).join(','), y: Array.from(p.grey).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const num = Uint8Array.from(String(d.m).split(','), Number);
      if (num.length !== n * n || typeof d.y !== 'string' || d.y.length !== n * n) throw new Error('Invalid puzzle');
      const p = prepare({ n, num, grey: Uint8Array.from(d.y, Number) });
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
