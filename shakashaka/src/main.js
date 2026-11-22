// Shakashaka. Put black triangles (half cells, cut along a diagonal) into
// some white cells, so every white area is a rectangle (upright or turned
// by 45°). A number in a black cell tells how many triangles touch it by
// a side.
// Cells: 0 empty, 1..4 triangle with its right angle at the top-left,
// top-right, bottom-right or bottom-left corner. p.black: 0 white cell,
// 1 black cell, v + 2 black cell with number v.
// Check: around every grid point the white part, cut into eight 45°
// slices, has only runs of 2 (a corner) or 4 (a straight side), or is all
// white. This holds exactly when all white areas are rectangles.

(() => {
  // Corners: 0 TL, 1 TR, 2 BR, 3 BL. For a cell around a point, the
  // point is at corner vc; A is the slice next to the cell's vertical side
  // through the point, B the one next to its horizontal side.
  const OPP = [2, 3, 0, 1];
  // [dr, dc of cell from point, corner of the point in that cell, slice A, slice B, vertical-side corner, horizontal-side corner]
  const AROUND = [
    [-1, 0, 3, 0, 1, 0, 2], // NE cell: point at its BL
    [0, 0, 0, 3, 2, 3, 1], // SE cell: point at its TL
    [0, -1, 1, 4, 5, 2, 0], // SW cell: point at its TR
    [-1, -1, 2, 7, 6, 1, 3], // NW cell: point at its BR
  ];

  function slices(p, v, i, j) {
    // v: cell values (-1 unknown). Returns 8 slices: 1 white, 0 black, -1 unknown.
    const out = new Array(8);
    for (const [dr, dc, vc, A, B, cv] of AROUND) {
      const r = i + dr, c = j + dc;
      if (r < 0 || c < 0 || r >= p.n || c >= p.n || p.black[r * p.n + c]) { out[A] = 0; out[B] = 0; continue; }
      const x = v[r * p.n + c];
      if (x < 0) { out[A] = -1; out[B] = -1; continue; }
      if (x === 0) { out[A] = 1; out[B] = 1; continue; }
      const q = x - 1;
      if (q === vc) { out[A] = 0; out[B] = 0; } else if (q === OPP[vc]) { out[A] = 1; out[B] = 1; } else if (q === cv) { out[A] = 0; out[B] = 1; } else { out[A] = 1; out[B] = 0; }
    }
    return out;
  }
  function pointOk(o) {
    if (o.every((x) => x === 1)) return true;
    const start = o.indexOf(0);
    if (start < 0) return true; // white and unknown only
    // Runs of white between two known blacks.
    for (let s = 0; s < 8; s++) {
      const i = (start + s) % 8;
      if (o[i] !== 0 || o[(i + 1) % 8] !== 1) continue;
      let len = 0, j = (i + 1) % 8;
      while (o[j] === 1) { len++; j = (j + 1) % 8; }
      if (o[j] === 0 && len !== 2 && len !== 4) return false;
    }
    return true;
  }

  function solve(p, stopAt = 2, maxNodes = 200000, random = false) {
    const { n, black } = p;
    const N = n * n;
    const v = new Int8Array(N).fill(-1);
    for (let k = 0; k < N; k++) if (black[k]) v[k] = 0;
    const out = [];
    let nodes = 0;
    const nbs = (k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };
    const numOk = (k) => {
      for (const j of nbs(k)) {
        if (black[j] < 2) continue;
        const around = nbs(j);
        const tri = around.filter((x) => !black[x] && v[x] > 0).length, open = around.filter((x) => !black[x] && v[x] < 0).length;
        if (tri > black[j] - 2 || tri + open < black[j] - 2) return false;
      }
      return true;
    };
    (function rec(k) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      while (k < N && black[k]) k++;
      if (k === N) { out.push(Int8Array.from(v)); return; }
      const r = Math.floor(k / n), c = k % n;
      const vals = random ? PuzzleShell.shuffle([0, 0, 0, 1, 2, 3, 4]) : [0, 1, 2, 3, 4];
      const tried = new Set();
      for (const x of vals) {
        if (tried.has(x)) continue;
        tried.add(x);
        v[k] = x;
        if (numOk(k) && pointOk(slices(p, v, r, c)) && pointOk(slices(p, v, r, c + 1)) && pointOk(slices(p, v, r + 1, c)) && pointOk(slices(p, v, r + 1, c + 1))) rec(k + 1);
      }
      v[k] = -1;
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const black = new Uint8Array(N);
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N * 0.15))) black[k] = 1;
      const p = { n, black };
      const fill = solve(p, 1, 20000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      if (sol.filter((x) => x > 0).length < N * 0.12) continue;
      // Numbers on all black cells, then drop the ones not needed.
      const nbs = (k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };
      for (let k = 0; k < N; k++) if (black[k]) black[k] = 2 + nbs(k).filter((j) => !black[j] && sol[j] > 0).length;
      const unique = () => { const r = solve(p, 2, 30000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (black[k] < 2) continue;
        const keep = black[k];
        black[k] = 1;
        if (!unique()) black[k] = keep;
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
    const { n, black, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const W = n * s;
    const svg = el('svg', { width: W + 4, height: W + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    const hintSet = new Set(hint ? hint.cells : []);
    for (let k = 0; k < n * n; k++) {
      const x = (k % n) * s, y = Math.floor(k / n) * s;
      el('rect', { x, y, width: s, height: s, class: 'gx-bg sk-cell' + (hintSet.has(k) ? ' hint' : '') }, g);
    }
    for (let i = 1; i < n; i++) {
      el('line', { x1: i * s, y1: 0, x2: i * s, y2: W, class: 'gx-grid' }, g);
      el('line', { x1: 0, y1: i * s, x2: W, y2: i * s, class: 'gx-grid' }, g);
    }
    for (let k = 0; k < n * n; k++) {
      const x = (k % n) * s, y = Math.floor(k / n) * s;
      if (black[k]) {
        el('rect', { x, y, width: s, height: s, class: 'sk-black' }, g);
        if (black[k] >= 2) el('text', { x: x + s / 2, y: y + s / 2, 'font-size': s * 0.45, class: 'pt-clue sk-num' }, g).textContent = black[k] - 2;
        continue;
      }
      const v = result ? solution[k] : state[k];
      if (v) {
        const C = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
        const q = v - 1;
        const pts = [C[q], C[(q + 1) % 4], C[(q + 3) % 4]];
        let cls = '';
        if (result) cls = ' ' + PuzzleShell.resultClass(state[k], solution[k]);
        el('polygon', { points: pts.map((c) => c.join(',')).join(' '), class: 'sk-tri' + cls }, g);
      } else if (result && state[k]) {
        el('circle', { cx: x + s / 2, cy: y + s / 2, r: s * 0.12, class: 'sk-tri bad' }, g);
      }
      if (!readonly) {
        const hit = el('rect', { x, y, width: s, height: s, fill: 'transparent' }, g);
        hit.style.cursor = 'pointer';
        // Click near a corner to put the right angle there; click again to clear.
        hit.addEventListener('click', (ev) => {
          const b = hit.getBoundingClientRect();
          const fx = (ev.clientX - b.left) / b.width, fy = (ev.clientY - b.top) / b.height;
          let q;
          if (fy < 0.5) q = fx < 0.5 ? 0 : 1;
          else if (fx < 0.5) q = 3;
          else q = 2;
          state[k] = state[k] === q + 1 ? 0 : q + 1;
          onChange();
        });
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); state[k] = (state[k] + 1) % 5; onChange(); });
      }
    }
    el('rect', { x: 0, y: 0, width: W, height: W, class: 'gx-frame', fill: 'none' }, g);
    return svg;
  }

  function hints(p, state) {
    for (let k = 0; k < state.length; k++) if (state[k] && state[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: p.solution[k] ? 'This triangle points the wrong way.' : 'This cell stays white.' }];
    const k = p.solution.findIndex((v, i) => v && !state[i]);
    return k < 0 ? [] : [{ cells: [k], v: p.solution[k], reason: 'No simple step is shown here. A triangle goes in this cell.' }];
  }

  PuzzleShell.start({
    id: 'shakashaka',
    name: 'Shakashaka',
    rules: 'Put black triangles (half cells, cut along a diagonal) into some white cells, so that every white area is a ' +
      'rectangle — upright or turned by 45°. A number in a black cell tells how many triangles touch it by a side.',
    controls: 'Click near a corner of a cell to put a triangle with its right angle in that corner; click the same corner again to clear. Right click cycles.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every white area squared up — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, b: Array.from(p.black).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const black = Uint8Array.from(String(d.b).split(','), Number);
      if (black.length !== n * n) throw new Error('Invalid cells');
      const p = { n, black };
      const res = solve(p, 2, 400000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 5;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.black[k] || v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
