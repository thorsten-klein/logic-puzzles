// Kohi Gyunyu (Coffee Milk). Join circles with straight lines across or
// down; a line runs between two circles with no circle between them, and
// lines never cross. Joined circles form a group. Every group holds
// exactly one grey circle and as many white as black circles. A white and
// a black circle are never joined directly.
// The Binary solver runs on candidate lines (YES = line).
// p.col: 0 empty, 1 white, 2 black, 3 grey.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function prepare(p) {
    const { n, col } = p;
    p.cands = [];
    for (let k = 0; k < n * n; k++) {
      if (!col[k]) continue;
      const r = Math.floor(k / n), c = k % n;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        let a = r + dr, b = c + dc;
        const between = [];
        while (a < n && b < n && !col[a * n + b]) { between.push(a * n + b); a += dr; b += dc; }
        if (a >= n || b >= n) continue;
        const j = a * n + b;
        if (col[k] + col[j] === 3) continue; // white–black never joined
        p.cands.push({ a: k, b: j, between, across: dr === 0 });
      }
    }
    return p;
  }

  function model(p) {
    const { n, col, cands } = p;
    const cons = [];
    // Crossing lines: one across and one down that share an empty cell.
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
      if (cands[i].across === cands[j].across) continue;
      if (cands[i].between.some((x) => cands[j].between.includes(x))) cons.push({ cells: [i, j], min: 0, max: 1, why: () => 'Lines never cross.' });
    }
    const at = Array.from({ length: n * n }, () => []);
    cands.forEach((e, i) => { at[e.a].push(i); at[e.b].push(i); });
    for (let k = 0; k < n * n; k++) {
      if (col[k] === 1 || col[k] === 2) cons.push({ cells: at[k], min: 1, max: at[k].length, why: () => 'A white or black circle must join a group with a grey circle.' });
    }
    function check(s, done) {
      const seen = new Uint8Array(n * n);
      for (let k = 0; k < n * n; k++) {
        if (!col[k] || seen[k]) continue;
        const group = [k];
        seen[k] = 1;
        let closed = true;
        for (let i = 0; i < group.length; i++) for (const e of at[group[i]]) {
          if (s[e] === UNKNOWN) { closed = false; continue; }
          if (s[e] !== YES) continue;
          const o = cands[e].a === group[i] ? cands[e].b : cands[e].a;
          if (!seen[o]) { seen[o] = 1; group.push(o); }
        }
        const cnt = [0, 0, 0, 0];
        for (const x of group) cnt[col[x]]++;
        if (cnt[3] > 1) return false;
        if (done || closed) if (cnt[3] !== 1 || cnt[1] !== cnt[2]) return false;
      }
      return true;
    }
    return { N: cands.length, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const col = new Uint8Array(N);
      const used = new Uint8Array(N); // cells crossed by a line
      const lines = [];
      const groups = Math.max(2, Math.round(N / 12));
      let ok = true;
      for (let g = 0; g < groups && ok; g++) {
        // A grey circle on a free cell.
        const free = [...Array(N).keys()].filter((k) => !col[k] && !used[k]);
        if (!free.length) { ok = false; break; }
        const grey = free[Math.floor(Math.random() * free.length)];
        col[grey] = 3;
        const members = [grey];
        const pairs = 1 + Math.floor(Math.random() * 2);
        for (let q = 0; q < 2 * pairs; q++) {
          const want = q % 2 ? 2 : 1;
          let placed = false;
          for (let t = 0; t < 40 && !placed; t++) {
            const from = members[Math.floor(Math.random() * members.length)];
            if (col[from] + want === 3) continue;
            const [dr, dc] = [[0, 1], [0, -1], [1, 0], [-1, 0]][Math.floor(Math.random() * 4)];
            const len = 2 + Math.floor(Math.random() * 3);
            const r = Math.floor(from / n), c = from % n;
            const path = [];
            for (let i = 1; i <= len; i++) {
              const a = r + dr * i, b = c + dc * i;
              if (a < 0 || b < 0 || a >= n || b >= n) break;
              path.push(a * n + b);
            }
            if (path.length !== len) continue;
            const end = path[len - 1];
            if (path.some((x) => col[x] || used[x])) continue;
            col[end] = want;
            path.slice(0, -1).forEach((x) => { used[x] = 1; });
            lines.push([from, end]);
            members.push(end);
            placed = true;
          }
          if (!placed) { ok = false; break; }
        }
      }
      if (!ok) continue;
      const p = prepare({ n, col });
      const sol = new Uint8Array(p.cands.length).fill(NO);
      for (const [a, b] of lines) {
        const i = p.cands.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
        if (i < 0) { ok = false; break; }
        sol[i] = YES;
      }
      if (!ok) continue;
      const m = model(p);
      if (m.check(sol, true) === false) continue;
      const t = Binary.logicSolve(m);
      let unique = t && !t.includes(UNKNOWN);
      if (!unique && t) { const r = Binary.solve(m, 2, 4000, t); unique = r.solutions.length === 1 && !r.capped; }
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
    const { n, col, cands, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const W = n * s;
    const svg = el('svg', { width: W + 4, height: W + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-bg' }, g);
    for (let i = 1; i < n; i++) {
      el('line', { x1: i * s, y1: 0, x2: i * s, y2: W, class: 'gx-grid' }, g);
      el('line', { x1: 0, y1: i * s, x2: W, y2: i * s, class: 'gx-grid' }, g);
    }
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-frame' }, g);
    const xy = (k) => [(k % n) * s + s / 2, Math.floor(k / n) * s + s / 2];
    const hintSet = new Set(hint ? hint.cells : []);
    const show = result ? solution : state;
    cands.forEach((e, i) => {
      const [x1, y1] = xy(e.a), [x2, y2] = xy(e.b);
      let cls = '';
      if (result && state[i] === YES) cls = solution[i] === YES ? ' ok' : ' bad';
      else if (result && solution[i] === YES) cls = state[i] ? ' bad' : ' miss'; // marked "no", or not entered yet
      if (hintSet.has(i)) cls += ' hint';
      // The answer's lines; on the result view also wrong lines (red).
      if (show[i] === YES || cls.includes('bad')) el('line', { x1, y1, x2, y2, class: 'kg-line' + cls }, g);
      else if (state[i] === NO && !result) {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = s * 0.09;
        el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'lp-cross' }, g);
      }
    });
    for (let k = 0; k < n * n; k++) {
      if (!col[k]) continue;
      const [x, y] = xy(k);
      el('circle', { cx: x, cy: y, r: s * 0.3, class: 'kg-c' + col[k] }, g);
    }
    if (!readonly) cands.forEach((e, i) => {
      const [x1, y1] = xy(e.a), [x2, y2] = xy(e.b);
      const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.4 }, g);
      const cycle = (back) => { const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO]; state[i] = order[(order.indexOf(state[i]) + 1) % 3]; onChange(); };
      hit.addEventListener('click', () => cycle(false));
      hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
    });
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] !== UNKNOWN && state[i] !== p.solution[i]) return [{ cells: [i], v: UNKNOWN, reason: state[i] === YES ? 'This line is wrong.' : 'A line goes here.' }];
    const s = Uint8Array.from(state);
    const log = [];
    Binary.settle(model(p), s, log);
    const step = log.find((x) => x.cells.some((i) => state[i] === UNKNOWN));
    if (step) return [{ cells: step.cells, v: step.v, reason: step.con && step.con.why ? step.con.why(step.v) : 'This follows from the rules.' }];
    const i = p.solution.findIndex((v, j) => state[j] === UNKNOWN && v === YES);
    return i < 0 ? [] : [{ cells: [i], v: YES, reason: 'No one-step deduction is left; this needs a longer chain. A line goes here.' }];
  }

  PuzzleShell.start({
    id: 'kohi-gyunyu',
    name: 'Kohi Gyunyu',
    rules: 'Join circles with straight lines across or down. A line runs between two circles with no circle between them, ' +
      'and lines never cross. Joined circles form a group. Every group holds exactly one grey circle and as many white as ' +
      'black circles. A white and a black circle are never joined directly.',
    controls: 'Click between two circles to draw a line, again for a cross, again to clear. Right click cycles back.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Perfect coffee milk — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.col).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[0-3]+$/.test(d.g)) throw new Error('Invalid circles');
      const p = prepare({ n, col: Uint8Array.from(d.g, Number) });
      const m = model(p);
      const t = Binary.logicSolve(m);
      if (t && !t.includes(UNKNOWN) && m.check(t, true) !== false) { p.solution = t; return p; }
      const res = Binary.solve(m, 2, 50000, t || undefined);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.cands.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.cands.length);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => (v === YES) === (p.solution[i] === YES)),
    hints,
    applyHint(p, s, h) { for (const i of h.cells) s[i] = h.v; },
  });
})();
