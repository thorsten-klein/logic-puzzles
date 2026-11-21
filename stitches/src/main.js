// Stitches. Join every pair of neighbouring rooms with exactly one stitch:
// a short line between two cells that touch across the rooms' border. A
// cell holds at most one stitch end. A number at the edge tells how many
// stitch ends lie in that row or column.
// The Binary solver runs on candidate stitches (YES = stitch).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function prepare(p) {
    const { n, room } = p;
    p.cands = [];
    for (let k = 0; k < n * n; k++) {
      const r = Math.floor(k / n), c = k % n;
      for (const j of [c < n - 1 ? k + 1 : -1, r < n - 1 ? k + n : -1]) if (j >= 0 && room[j] !== room[k]) p.cands.push([k, j]);
    }
    return p;
  }

  function model(p) {
    const { n, room, rowCnt, colCnt, cands } = p;
    const cons = [];
    // One stitch per pair of touching rooms.
    const pairs = new Map();
    cands.forEach(([a, b], i) => {
      const key = Math.min(room[a], room[b]) + ':' + Math.max(room[a], room[b]);
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(i);
    });
    for (const cells of pairs.values()) cons.push({ cells, min: 1, max: 1, why: (v) => (v === YES ? 'These two rooms need one stitch, and only this place is left.' : 'These two rooms already have their stitch.') });
    // At most one stitch end per cell.
    const at = Array.from({ length: n * n }, () => []);
    cands.forEach(([a, b], i) => { at[a].push(i); at[b].push(i); });
    for (const cells of at) if (cells.length > 1) cons.push({ cells, min: 0, max: 1, why: () => 'A cell holds at most one stitch end.' });
    // Stitch ends per row and column (weighted: a stitch inside a row has two ends there).
    for (let i = 0; i < n; i++) {
      if (rowCnt[i] >= 0) {
        const cells = [], w = [];
        cands.forEach(([a, b], j) => { const e = (Math.floor(a / n) === i) + (Math.floor(b / n) === i); if (e) { cells.push(j); w.push(e); } });
        cons.push({ cells, w, min: rowCnt[i], max: rowCnt[i], why: () => `Row ${i + 1} needs ${rowCnt[i]} stitch ends.` });
      }
      if (colCnt[i] >= 0) {
        const cells = [], w = [];
        cands.forEach(([a, b], j) => { const e = (a % n === i) + (b % n === i); if (e) { cells.push(j); w.push(e); } });
        cons.push({ cells, w, min: colCnt[i], max: colCnt[i], why: () => `Column ${i + 1} needs ${colCnt[i]} stitch ends.` });
      }
    }
    return { N: cands.length, cons };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const p = prepare({ n, room, rowCnt: new Int8Array(n).fill(-1), colCnt: new Int8Array(n).fill(-1) });
      const sol = Binary.randomFill(model(p), 0.5, 20);
      if (!sol) continue;
      p.rowCnt = new Int8Array(n);
      p.colCnt = new Int8Array(n);
      sol.forEach((v, i) => {
        if (v !== YES) return;
        for (const k of p.cands[i]) { p.rowCnt[Math.floor(k / n)]++; p.colCnt[k % n]++; }
      });
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const [arr, i] of PuzzleShell.shuffle([...new Array(n).keys()].flatMap((i) => [[p.rowCnt, i], [p.colCnt, i]]))) {
        const keep = arr[i];
        arr[i] = -1;
        if (!unique()) arr[i] = keep;
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
    const { n, room, cands, solution, rowCnt, colCnt } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(44, Math.floor((Math.min(window.innerWidth, 900) - 40) / (n + 1))));
    const W = (n + 1) * s;
    const svg = el('svg', { width: W + 4, height: W + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    const ox = s, oy = s;
    el('rect', { x: ox, y: oy, width: n * s, height: n * s, class: 'gx-bg' }, g);
    // Grid and room walls.
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = r * n + c;
      if (c < n - 1) el('line', { x1: ox + (c + 1) * s, y1: oy + r * s, x2: ox + (c + 1) * s, y2: oy + (r + 1) * s, class: room[k] !== room[k + 1] ? 'gx-wall' : 'gx-grid' }, g);
      if (r < n - 1) el('line', { x1: ox + c * s, y1: oy + (r + 1) * s, x2: ox + (c + 1) * s, y2: oy + (r + 1) * s, class: room[k] !== room[k + n] ? 'gx-wall' : 'gx-grid' }, g);
    }
    el('rect', { x: ox, y: oy, width: n * s, height: n * s, class: 'gx-frame' }, g);
    const xy = (k) => [ox + (k % n) * s + s / 2, oy + Math.floor(k / n) * s + s / 2];
    const hintSet = new Set(hint ? hint.cells : []);
    cands.forEach(([a, b], i) => {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      const v = result ? solution[i] : state[i];
      let cls = '';
      if (result && state[i] === YES) cls = solution[i] === YES ? ' ok' : ' bad';
      else if (result && solution[i] === YES) cls = state[i] ? ' bad' : ' miss'; // marked "no", or not entered yet
      if (hintSet.has(i)) cls += ' hint';
      // The answer's stitches; on the result view also wrong ones (red).
      if (v === YES || cls.includes('bad')) {
        el('line', { x1, y1, x2, y2, class: 'sti-line' + cls }, g);
        el('circle', { cx: x1, cy: y1, r: s * 0.12, class: 'sti-end' + cls }, g);
        el('circle', { cx: x2, cy: y2, r: s * 0.12, class: 'sti-end' + cls }, g);
      } else if (v === NO && !result) {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = s * 0.09;
        el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'lp-cross' }, g);
      }
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.4 }, g);
        const cycle = (back) => { const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO]; state[i] = order[(order.indexOf(state[i]) + 1) % 3]; onChange(); };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    });
    // Stitch ends per row and column so far: a number turns green when
    // its line has exactly that many (on the playing board).
    const rowsNow = new Array(n).fill(0), colsNow = new Array(n).fill(0);
    if (!result) state.forEach((v, i) => { if (v === YES) for (const k of p.cands[i]) { rowsNow[Math.floor(k / n)]++; colsNow[k % n]++; } });
    const clueCls = (now, want) => 'pt-clue' + (!result && now === want ? ' done' : '');
    const bar = (x, y, w, h) => el('rect', { x, y, width: w, height: h, class: 'clue-bar' }, g);
    for (let i = 0; i < n; i++) {
      if (colCnt[i] >= 0 && clueCls(colsNow[i], colCnt[i]).includes('done')) bar(ox + i * s + 4, s - 5, s - 8, 4);
      if (rowCnt[i] >= 0 && clueCls(rowsNow[i], rowCnt[i]).includes('done')) bar(s - 5, oy + i * s + 4, 4, s - 8);
      if (colCnt[i] >= 0) el('text', { x: ox + i * s + s / 2, y: s / 2, 'font-size': s * 0.42, class: clueCls(colsNow[i], colCnt[i]) }, g).textContent = colCnt[i];
      if (rowCnt[i] >= 0) el('text', { x: s / 2, y: oy + i * s + s / 2, 'font-size': s * 0.42, class: clueCls(rowsNow[i], rowCnt[i]) }, g).textContent = rowCnt[i];
    }
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] !== UNKNOWN && state[i] !== p.solution[i]) return [{ cells: [i], v: UNKNOWN, reason: state[i] === YES ? 'No stitch goes here.' : 'A stitch goes here.' }];
    const m = model(p);
    const s = Uint8Array.from(state);
    const log = [];
    Binary.settle(m, s, log);
    const step = log.find((x) => x.cells.some((i) => state[i] === UNKNOWN));
    if (step) return [{ cells: step.cells, v: step.v, reason: step.con?.why ? step.con.why(step.v) : 'This follows from the rules.' }];
    const i = p.solution.findIndex((v, j) => state[j] === UNKNOWN && v === YES);
    return i < 0 ? [] : [{ cells: [i], v: YES, reason: 'No simple step is left. A stitch goes here.' }];
  }

  PuzzleShell.start({
    id: 'stitches',
    name: 'Stitches',
    rules: 'Join every pair of neighbouring rooms with exactly one stitch: a short line between two cells that touch ' +
      'across the rooms\' border. A cell holds at most one stitch end. A number at the edge tells how many stitch ends ' +
      'lie in that row or column.',
    controls: 'Click between two cells of different rooms to place a stitch, again for a cross, again to clear. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Neatly sewn — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), r: Array.from(p.rowCnt).join(','), c: Array.from(p.colCnt).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const p = prepare({ n, room, rowCnt: Int8Array.from(String(d.r).split(','), Number), colCnt: Int8Array.from(String(d.c).split(','), Number) });
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
