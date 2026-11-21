// Endorain (End Line). Draw straight lines, across or down, through the
// centres of cells. Every cell is on exactly one line, and each line is at
// least two cells long. The two ends of a line lie in different rooms. A
// number tells how many line ends lie in its room.
// The Binary solver runs on links between neighbouring cells (YES = link).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function prepare(p) {
    const { n } = p;
    p.cands = [];
    p.at = Array.from({ length: n * n }, () => [[], []]); // [across links, down links]
    for (let k = 0; k < n * n; k++) {
      const r = Math.floor(k / n), c = k % n;
      if (c < n - 1) { p.at[k][0].push(p.cands.length); p.at[k + 1][0].push(p.cands.length); p.cands.push([k, k + 1]); }
      if (r < n - 1) { p.at[k][1].push(p.cands.length); p.at[k + n][1].push(p.cands.length); p.cands.push([k, k + n]); }
    }
    p.rooms = [];
    p.room.forEach((g, k) => { (p.rooms[g] = p.rooms[g] || []).push(k); });
    return p;
  }

  function model(p) {
    const { n, room, clues, cands, at } = p;
    const N = n * n;
    const cons = [];
    for (let k = 0; k < N; k++) {
      const [h, v] = at[k];
      cons.push({ cells: h.concat(v), min: 1, max: 2, why: (x) => (x === YES ? 'Every cell is on a line.' : 'A line passes a cell at most once.') });
      for (const a of h) for (const b of v) cons.push({ cells: [a, b], min: 0, max: 1, why: () => 'Lines are straight; they never turn.' });
    }
    const done = (s, k) => at[k][0].concat(at[k][1]).every((i) => s[i] !== UNKNOWN);
    const deg = (s, k) => at[k][0].concat(at[k][1]).filter((i) => s[i] === YES).length;
    // The other end of the line that ends in cell k (or -1 if not known yet).
    const other = (s, k) => {
      const i = at[k][0].concat(at[k][1]).find((e) => s[e] === YES);
      let x = cands[i][0] === k ? cands[i][1] : cands[i][0];
      const step = x - k;
      for (;;) {
        if (!done(s, x)) return -1;
        if (deg(s, x) === 1) return x;
        x += step;
      }
    };
    function check(s) {
      const ends = new Int32Array(p.rooms.length), maybe = new Int32Array(p.rooms.length);
      for (let k = 0; k < N; k++) {
        if (!done(s, k)) { maybe[room[k]]++; continue; }
        if (deg(s, k) !== 1) continue;
        ends[room[k]]++;
        const o = other(s, k);
        if (o >= 0 && room[o] === room[k]) return false;
      }
      for (let g = 0; g < clues.length; g++) {
        if (clues[g] < 0) continue;
        if (ends[g] > clues[g] || ends[g] + maybe[g] < clues[g]) return false;
      }
      return true;
    }
    return { N: cands.length, cons, check };
  }

  // Random cover with straight lines of 2..4 cells whose ends differ in room.
  function randomCover(n, room, deadline) {
    const N = n * n;
    const used = new Int8Array(N);
    const lines = [];
    const rec = (k) => {
      while (k < N && used[k]) k++;
      if (k === N) return true;
      const r = Math.floor(k / n), c = k % n;
      const opts = [];
      for (const [dr, dc] of [[0, 1], [1, 0]]) for (const len of [2, 3, 4]) {
        const cells = [];
        for (let i = 0; i < len; i++) {
          const a = r + dr * i, b = c + dc * i;
          if (a >= n || b >= n || used[a * n + b]) break;
          cells.push(a * n + b);
        }
        if (cells.length === len && room[cells[0]] !== room[cells[len - 1]]) opts.push(cells);
      }
      for (const cells of PuzzleShell.shuffle(opts)) {
        cells.forEach((x) => { used[x] = 1; });
        lines.push(cells);
        if (rec(k + 1)) return true;
        lines.pop();
        cells.forEach((x) => { used[x] = 0; });
        if (Date.now() > deadline) return false;
      }
      return false;
    };
    return rec(0) ? lines : null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const lines = randomCover(n, room, Math.min(deadline, Date.now() + 1000));
      if (!lines) continue;
      const count = Math.max(...room) + 1;
      const p = prepare({ n, room, clues: new Int8Array(count) });
      const sol = new Uint8Array(p.cands.length).fill(NO);
      const key = new Map(p.cands.map(([a, b], i) => [a + ',' + b, i]));
      for (const cells of lines) {
        p.clues[room[cells[0]]]++;
        p.clues[room[cells.at(-1)]]++;
        for (let i = 0; i + 1 < cells.length; i++) sol[key.get(cells[i] + ',' + cells[i + 1])] = YES;
      }
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const g of PuzzleShell.shuffle([...new Array(count).keys()])) {
        const keep = p.clues[g];
        p.clues[g] = -1;
        if (!unique()) p.clues[g] = keep;
        if (Date.now() > deadline + 3000) break;
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
    const { n, room, cands, solution, clues, rooms, at } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const W = n * s;
    const svg = el('svg', { width: W + 4, height: W + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-bg' }, g);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = r * n + c;
      if (c < n - 1) el('line', { x1: (c + 1) * s, y1: r * s, x2: (c + 1) * s, y2: (r + 1) * s, class: room[k] !== room[k + 1] ? 'gx-wall' : 'gx-grid' }, g);
      if (r < n - 1) el('line', { x1: c * s, y1: (r + 1) * s, x2: (c + 1) * s, y2: (r + 1) * s, class: room[k] !== room[k + n] ? 'gx-wall' : 'gx-grid' }, g);
    }
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-frame' }, g);
    rooms.forEach((cells, i) => {
      if (clues[i] < 0) return;
      const k = cells[0];
      el('text', { x: (k % n) * s + s * 0.2, y: Math.floor(k / n) * s + s * 0.24, 'font-size': s * 0.3, class: 'pt-clue' }, g).textContent = clues[i];
    });
    const xy = (k) => [(k % n) * s + s / 2, Math.floor(k / n) * s + s / 2];
    const show = result ? solution : state;
    const hintSet = new Set(hint ? hint.cells : []);
    // Dots at line ends.
    for (let k = 0; k < n * n; k++) {
      const d = at[k][0].concat(at[k][1]).filter((i) => show[i] === YES).length;
      if (d === 1) { const [x, y] = xy(k); el('circle', { cx: x, cy: y, r: s * 0.13, class: 'sti-end' }, g); }
    }
    cands.forEach(([a, b], i) => {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      let cls = '';
      if (result && state[i] === YES) cls = solution[i] === YES ? ' ok' : ' bad';
      else if (result && solution[i] === YES) cls = state[i] ? ' bad' : ' miss'; // marked "no", or not entered yet
      if (hintSet.has(i)) cls += ' hint';
      // The answer's lines; on the result view also wrong lines (red).
      if (show[i] === YES || cls.includes('bad')) el('line', { x1, y1, x2, y2, class: 'sti-line' + cls }, g);
      else if (state[i] === NO && !result) {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = s * 0.08;
        el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'lp-cross' }, g);
      }
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.45 }, g);
        const cycle = (back) => { const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO]; state[i] = order[(order.indexOf(state[i]) + 1) % 3]; onChange(); };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    });
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] !== UNKNOWN && state[i] !== p.solution[i]) return [{ cells: [i], v: UNKNOWN, reason: state[i] === YES ? 'These two cells are not joined.' : 'These two cells are joined.' }];
    const s = Uint8Array.from(state);
    const log = [];
    Binary.settle(model(p), s, log);
    const step = log.find((x) => x.cells.some((i) => state[i] === UNKNOWN));
    if (step) return [{ cells: step.cells, v: step.v, reason: step.con?.why ? step.con.why(step.v) : 'This follows from the rules.' }];
    const i = p.solution.findIndex((v, j) => state[j] === UNKNOWN && v === YES);
    return i < 0 ? [] : [{ cells: [i], v: YES, reason: 'No simple step is left. These two cells are joined.' }];
  }

  PuzzleShell.start({
    id: 'endorain',
    name: 'Endorain',
    rules: 'Draw straight lines, across or down, through the centres of cells. Every cell is on exactly one line, and each ' +
      'line is at least two cells long. The two ends of a line lie in different rooms. A number tells how many line ends ' +
      'lie in its room.',
    controls: 'Click between two cells to join them, again for a cross, again to clear. Right click cycles back.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every end in its place — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), c: Array.from(p.clues).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = Int8Array.from(String(d.c).split(','), Number);
      if (room.some((v) => !(v >= 0 && v < clues.length))) throw new Error('Invalid rooms');
      const p = prepare({ n, room, clues });
      const m = model(p);
      const t = Binary.logicSolve(m);
      if (t && !t.includes(UNKNOWN)) { p.solution = t; return p; }
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
