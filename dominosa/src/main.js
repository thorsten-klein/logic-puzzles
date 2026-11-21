// Dominosa. The grid holds a full set of dominoes 0-0 .. n-n with the
// borders missing. Find where each domino lies.
// Grid: (n+1) rows x (n+2) columns. Edges use Loop-style indexes:
//   horizontal (r, c)-(r, c+1): r * (C-1) + c
//   vertical   (r, c)-(r+1, c): R * (C-1) + r * C + c

(() => {
  function edgeList(R, C) {
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) out.push([r * C + c, r * C + c + 1]);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) out.push([r * C + c, (r + 1) * C + c]);
    return out;
  }

  const typeOf = (n, a, b) => (a <= b ? a * (n + 1) + b : b * (n + 1) + a);

  function prepare(p) {
    p.R = p.n + 1;
    p.C = p.n + 2;
    p.edges = edgeList(p.R, p.C);
    p.etype = p.edges.map(([a, b]) => typeOf(p.n, p.g[a], p.g[b]));
    p.cellEdges = Array.from({ length: p.R * p.C }, () => []);
    p.edges.forEach(([a, b], e) => { p.cellEdges[a].push(e); p.cellEdges[b].push(e); });
    return p;
  }

  // st: 0 open, 1 chosen, 2 ruled out. Returns false on contradiction,
  // else { e, why } for the first forced choice found, or null.
  function forced(p, st) {
    for (let k = 0; k < p.R * p.C; k++) {
      const es = p.cellEdges[k];
      if (es.some((e) => st[e] === 1)) continue;
      const open = es.filter((e) => st[e] === 0);
      if (!open.length) return false;
      if (open.length === 1) return { e: open[0], why: 'cell', k };
    }
    const byType = new Map();
    p.edges.forEach((_, e) => {
      if (st[e] === 2) return;
      const t = p.etype[e];
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(e);
    });
    for (let a = 0; a <= p.n; a++) for (let b = a; b <= p.n; b++) {
      const list = byType.get(typeOf(p.n, a, b)) || [];
      if (!list.length) return false;
      if (list.filter((e) => st[e] === 1).length > 1) return false;
      if (list.length === 1 && st[list[0]] === 0) return { e: list[0], why: 'type', a, b };
    }
    return null;
  }

  // Choosing edge e rules out its neighbours and its twins.
  function choose(p, st, e) {
    st[e] = 1;
    const [a, b] = p.edges[e];
    for (const x of [...p.cellEdges[a], ...p.cellEdges[b]]) if (x !== e) st[x] = 2;
    p.edges.forEach((_, x) => { if (x !== e && p.etype[x] === p.etype[e]) st[x] = 2; });
  }

  function settle(p, st) {
    for (;;) {
      const f = forced(p, st);
      if (f === false) return false;
      if (!f) return true;
      choose(p, st, f.e);
    }
  }

  function solve(p, stopAt = 2, maxNodes = 20000) {
    const solutions = [];
    let nodes = 0;
    (function rec(st) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!settle(p, st)) return;
      // Branch on the cell with the fewest open edges.
      let pick = -1, best = 9;
      for (let k = 0; k < p.R * p.C; k++) {
        if (p.cellEdges[k].some((e) => st[e] === 1)) continue;
        const open = p.cellEdges[k].filter((e) => st[e] === 0).length;
        if (open < best) { best = open; pick = k; }
      }
      if (pick < 0) { solutions.push(Uint8Array.from(st, (v) => (v === 1 ? 1 : 0))); return; }
      for (const e of p.cellEdges[pick].filter((x) => st[x] === 0)) {
        const t = Uint8Array.from(st);
        choose(p, t, e);
        rec(t);
      }
    })(new Uint8Array(p.edges.length));
    return { solutions, capped: nodes > maxNodes };
  }

  // Random domino tiling of the grid, then a random set of numbers.
  function tryOnce(n) {
    const R = n + 1, C = n + 2, N = R * C;
    const mate = new Int32Array(N).fill(-1);
    let nodes = 0;
    const tile = (k) => {
      while (k < N && mate[k] >= 0) k++;
      if (k === N) return true;
      if (++nodes > 5000) return false;
      const opts = [];
      if ((k % C) < C - 1 && mate[k + 1] < 0) opts.push(k + 1);
      if (k + C < N && mate[k + C] < 0) opts.push(k + C);
      for (const j of PuzzleShell.shuffle(opts)) {
        mate[k] = j; mate[j] = k;
        if (tile(k + 1)) return true;
        mate[k] = -1; mate[j] = -1;
      }
      return false;
    };
    if (!tile(0)) return null;
    const types = [];
    for (let a = 0; a <= n; a++) for (let b = a; b <= n; b++) types.push([a, b]);
    PuzzleShell.shuffle(types);
    const g = new Int8Array(N);
    let i = 0;
    for (let k = 0; k < N; k++) {
      if (mate[k] < k) continue;
      const [a, b] = Math.random() < 0.5 ? types[i] : [types[i][1], types[i][0]];
      g[k] = a; g[mate[k]] = b;
      i++;
    }
    const p = prepare({ n, g });
    const res = solve(p, 2);
    if (res.solutions.length !== 1 || res.capped) return null;
    p.solution = res.solutions[0];
    return p;
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
    const { R, C, g, edges, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s, height: R * s, class: 'dm-board' + (readonly ? ' readonly' : '') });
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const shown = result ? solution : state;
    const hintSet = new Set(hint ? hint.edges : []);
    // Domino bodies behind the numbers.
    edges.forEach(([a, b], e) => {
      if (shown[e] !== 1) return;
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      let cls = 'dm-tile';
      if (result && state[e] === 1) cls += ' ok';
      else if (result) cls += ' miss'; // not entered yet
      if (hintSet.has(e)) cls += ' hint';
      el('rect', { x: Math.min(x1, x2) - s * 0.44, y: Math.min(y1, y2) - s * 0.44,
        width: Math.abs(x2 - x1) + s * 0.88, height: Math.abs(y2 - y1) + s * 0.88, rx: s * 0.16, class: cls }, svg);
    });
    for (let k = 0; k < R * C; k++) {
      const [x, y] = xy(k);
      const t = el('text', { x, y, 'font-size': s * 0.45, class: 'dm-num' }, svg);
      t.textContent = g[k];
    }
    edges.forEach(([a, b], e) => {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      if (hintSet.has(e) && shown[e] !== 1) {
        el('line', { x1, y1, x2, y2, class: 'dm-ghost' }, svg);
      }
      if (result && state[e] === 1 && !solution[e]) el('line', { x1, y1, x2, y2, class: 'dm-bad' }, svg);
      if (readonly) return;
      const hit = el('line', { x1, y1, x2, y2, class: 'dm-hit', 'stroke-width': s * 0.45 }, svg);
      hit.addEventListener('click', () => {
        if (state[e] === 1) state[e] = 0;
        else {
          // Joining two cells undoes other dominoes on them.
          for (const x of [...p.cellEdges[a], ...p.cellEdges[b]]) state[x] = 0;
          state[e] = 1;
        }
        onChange();
      });
    });
    return svg;
  }

  function hints(p, state) {
    const out = [];
    state.forEach((v, e) => { if (v === 1 && !p.solution[e]) out.push({ edges: [e], v: 0, reason: 'This domino is wrong.' }); });
    if (out.length) return out.slice(0, 1);
    const st = new Uint8Array(p.edges.length);
    state.forEach((v, e) => { if (v === 1) choose(p, st, e); });
    const f = forced(p, st);
    if (f && f.why === 'cell') {
      return [{ edges: [f.e], v: 1, reason: `This ${p.g[f.k]} has only one neighbour left to pair with.` }];
    }
    if (f && f.why === 'type') {
      return [{ edges: [f.e], v: 1, reason: `The ${f.a}-${f.b} domino can only go here.` }];
    }
    const e = p.solution.findIndex((v, i) => v && !state[i]);
    if (e >= 0) out.push({ edges: [e], v: 1, reason: 'No simple step is left. Here is one domino.' });
    return out;
  }

  PuzzleShell.start({
    id: 'dominosa',
    name: 'Dominosa',
    rules: 'The grid is covered by a full set of dominoes (every pair of numbers from 0-0 up to the highest number, ' +
      'each exactly once), but the borders are missing. Find where every domino lies.',
    controls: 'Click between two numbers to join them as a domino, click again to undo.',
    size: { min: 3, max: 7, def: 5, text: (n) => `0–${n}` },
    solvedText: 'Every domino found — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.n, g: Array.from(p.g).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error('Invalid size');
      if (typeof d.g !== 'string' || d.g.length !== (n + 1) * (n + 2) || !/^[0-9]+$/.test(d.g)) throw new Error('Invalid grid');
      const p = prepare({ n, g: Int8Array.from(d.g, Number) });
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.edges.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.edges.length);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = v[i] === '1' ? 1 : 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, e) => v === p.solution[e]),
    hints,
    applyHint(p, s, h) {
      for (const e of h.edges) {
        if (h.v === 1) { const [a, b] = p.edges[e]; for (const x of [...p.cellEdges[a], ...p.cellEdges[b]]) s[x] = 0; }
        s[e] = h.v;
      }
    },
  });
})();
