// Bodaburokku (Border Block). Draw walls on cell borders to divide the
// grid into regions. Cells with the same number are in the same region;
// different numbers are in different regions. Every region holds at least
// one number. The dots show exactly the points where three or four lines
// meet (the outer frame counts as lines).
// The Binary solver runs on inner borders (YES = wall).

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
      p.points.push({ k: i * (n + 1) + j, es, frame: fi || fj ? 2 : 0 });
    }
    return p;
  }

  function model(p) {
    const { n, num, edges, points, dot } = p;
    const cons = [];
    for (const { k, es, frame } of points) {
      if (dot[k]) cons.push({ cells: es, min: 3 - frame, max: es.length, why: () => 'Three or four lines meet at a dot.' });
      else cons.push({ cells: es, min: 0, max: 2 - frame, why: () => 'Without a dot, at most two lines meet here.' });
    }
    // Different numbers side by side need a wall; same numbers side by side none.
    edges.forEach(([a, b], i) => {
      if (num[a] && num[b]) cons.push({ cells: [i], min: num[a] === num[b] ? 0 : 1, max: num[a] === num[b] ? 0 : 1, why: () => (num[a] === num[b] ? 'Same numbers are in one region.' : 'Different numbers are in different regions.') });
    });
    const at = Array.from({ length: n * n }, () => []);
    edges.forEach(([a, b], i) => { at[a].push([i, b]); at[b].push([i, a]); });
    function check(s, done) {
      // A wall end inside the grid without a dot is a loose end.
      for (const { k, es, frame } of points) {
        if (frame || dot[k]) continue;
        if (es.every((e) => s[e] !== UNKNOWN) && es.filter((e) => s[e] === YES).length === 1) return false;
      }
      // Regions by open borders (NO, or UNKNOWN when not done).
      const id = new Int32Array(n * n).fill(-1);
      const seen = [];
      let g = 0;
      for (let k = 0; k < n * n; k++) {
        if (id[k] >= 0) continue;
        const cells = [k];
        id[k] = g;
        for (const cur of cells) for (const [e, o] of at[cur]) if (id[o] < 0 && s[e] === NO) { id[o] = g; cells.push(o); }
        const nums = new Set(cells.map((x) => num[x]).filter(Boolean));
        if (nums.size > 1) return false;
        seen.push({ cells, nums });
        g++;
      }
      // A wall between two cells of one sure region is not allowed.
      for (let i = 0; i < edges.length; i++) if (s[i] === YES && id[edges[i][0]] === id[edges[i][1]]) return false;
      if (done) {
        const where = new Map();
        for (let r = 0; r < seen.length; r++) {
          if (!seen[r].nums.size) return false;
          const v = [...seen[r].nums][0];
          if (where.has(v)) return false;
          where.set(v, r);
        }
      }
      return true;
    }
    return { N: edges.length, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const p = prepare({ n, num: new Uint8Array(N), dot: new Uint8Array((n + 1) * (n + 1)) });
      const sol = Uint8Array.from(p.edges, ([a, b]) => (room[a] !== room[b] ? YES : NO));
      for (const { k, es, frame } of p.points) if (frame + es.filter((e) => sol[e] === YES).length >= 3) p.dot[k] = 1;
      // Two numbers per region to start.
      const rooms = [];
      room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
      const labels = PuzzleShell.shuffle(rooms.map((_, i) => i + 1));
      rooms.forEach((cells, g) => { for (const k of PuzzleShell.shuffle(cells.slice()).slice(0, 2)) p.num[k] = labels[g]; });
      const unique = () => {
        const m = model(p);
        const t = Binary.logicSolve(m);
        if (t && !t.includes(UNKNOWN)) return m.check(t, true) !== false;
        if (!t) return false;
        const r = Binary.solve(m, 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!p.num[k]) continue;
        if (rooms[room[k]].filter((x) => p.num[x]).length < 2) continue;
        const keep = p.num[k];
        p.num[k] = 0;
        if (!unique()) p.num[k] = keep;
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
    id: 'bodaburokku',
    name: 'Bodaburokku',
    rules: 'Draw walls on cell borders to divide the grid into regions. Cells with the same number are in the same region, ' +
      'and different numbers are in different regions. Every region holds at least one number. The dots show exactly the ' +
      'points where three or four lines meet; the outer frame counts as lines.',
    controls: 'Click a cell border to draw a wall, again for a cross, again to clear. Right click cycles back.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every border in place — nicely done.',
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
