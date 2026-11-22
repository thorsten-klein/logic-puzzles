// Hashiwokakero (Bridges). Join the islands with bridges. Each island's
// number is its count of bridges. At most two bridges join two islands,
// bridges run straight, never cross, and all islands end up connected.

(() => {
  // --- puzzle model ---
  const prepare = (p) => PuzzleShell.buildIslandPairs(p);

  function checkClosedPairs(p, lo, hi, log) {
    if (p.isl.length <= 2) return 0;
    for (const [j, pair] of p.pairs.entries()) {
      const na = p.isl[pair.a].n, nb = p.isl[pair.b].n;
      if (na === nb && na <= 2 && hi[j] >= na) {
        hi[j] = na - 1;
        if (lo[j] > hi[j]) return -1;
        if (log) log.push({ pairs: [j], reason: `Two ${na}s joined by ${PuzzleShell.plural(na, 'bridge')} would form a closed group. So they can not be joined that way.` });
        return 1;
      }
    }
    return 0;
  }

  function checkCrossings(p, lo, hi, log) {
    const res = PuzzleShell.checkCrossingPairs(p, lo, hi, log, 'Bridges');
    return res !== 0 ? res : checkClosedPairs(p, lo, hi, log);
  }

  // One round of forced moves. Returns false on contradiction, else the
  // number of changes. `log` gets { pairs, reason } for hints.
  const formatIslandReason = (need, sumLo, sumHi) => {
    if (sumHi === need) return `This ${need} needs every bridge it can still get.`;
    if (sumLo === need) return `This ${need} already has all its bridges.`;
    return `This ${need} can only reach its number if these bridges are built.`;
  };
  const step = (p, lo, hi, log) => PuzzleShell.runIslandStep(p, lo, hi, log, formatIslandReason, checkCrossings);
  const settle = (p, lo, hi) => PuzzleShell.settleIslandGraph(p, lo, hi, step);

  const solve = (p, stopAt = 2, maxNodes = 20000) => PuzzleShell.solveIslandGraph(p, settle, 2, stopAt, maxNodes);

  // --- generator ---
  function generate(n) {
    const R = n, C = n;
    for (let t = 0; t < 200; t++) {
      const net = PuzzleShell.growIslandNetwork(R, C, 2);
      if (!net) continue;
      const p = prepare({ R, C, isl: net.isl });
      const res = solve(p, 2);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = res.solutions[0];
      return p;
    }
    return null;
  }

  // --- board ---
  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function drawBridgeLines(svg, pts, q, s, v, cls) {
    const [x1, y1, x2, y2] = pts;
    const off = s * 0.09;
    const [ox, oy] = q.horiz ? [0, off] : [off, 0];
    if (v === 1) el('line', { x1, y1, x2, y2, class: 'hs-bridge' + cls }, svg);
    if (v === 2) {
      el('line', { x1: x1 - ox, y1: y1 - oy, x2: x2 - ox, y2: y2 - oy, class: 'hs-bridge' + cls }, svg);
      el('line', { x1: x1 + ox, y1: y1 + oy, x2: x2 + ox, y2: y2 + oy, class: 'hs-bridge' + cls }, svg);
    }
  }

  function renderBridge(svg, q, j, ctx, opts, hintSet) {
    const { state, solution, xy, isl, s } = ctx;
    const { readonly, result, onChange } = opts;
    const [x1, y1] = xy(isl[q.a].k), [x2, y2] = xy(isl[q.b].k);
    const wrong = result && state[j] && state[j] !== solution[j];
    const v = result && !wrong ? solution[j] : state[j];
    let cls = '';
    if (result && state[j]) cls = state[j] === solution[j] ? ' ok' : ' bad';
    else if (result && solution[j]) cls = ' miss';
    if (hintSet.has(j)) cls += ' hint';
    drawBridgeLines(svg, [x1, y1, x2, y2], q, s, v, cls);
    if (!v && hintSet.has(j)) el('line', { x1, y1, x2, y2, class: 'hs-ghost' }, svg);
    if (!readonly) {
      const hit = el('line', { x1, y1, x2, y2, class: 'hs-hit', 'stroke-width': s * 0.5 }, svg);
      const cycle = (back) => { state[j] = (state[j] + (back ? 2 : 1)) % 3; onChange(); };
      hit.addEventListener('click', () => cycle(false));
      hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
    }
  }

  function render(p, state, opts = {}) {
    const { R, C, isl, pairs, solution } = p;
    const { readonly, result, hint } = opts;
    const s = PuzzleShell.fitCell(C, 44, 26);
    const svg = el('svg', { width: C * s, height: R * s, class: 'hs-board' + (readonly ? ' readonly' : '') });
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, rx: 6, class: 'hs-bg' }, svg);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const hintSet = new Set(hint ? hint.pairs : []);
    const ctx = { state, solution, xy, isl, s };
    pairs.forEach((q, j) => renderBridge(svg, q, j, ctx, opts, hintSet));
    isl.forEach((x, i) => {
      const [cx, cy] = xy(x.k);
      const have = p.of[i].reduce((a, j) => a + state[j], 0);
      const done = !result && have === x.n;
      const g = el('g', { class: 'hs-island' + (done ? ' done' : '') + (hint && hint.island === i ? ' hint' : '') }, svg);
      el('circle', { cx, cy, r: s * 0.36 }, g);
      const t = el('text', { x: cx, y: cy, 'font-size': s * 0.42 }, g);
      t.textContent = x.n;
    });
    return svg;
  }

  // --- hints ---
  function hints(p, state) {
    const wrong = [];
    state.forEach((v, j) => {
      if (v && v > p.solution[j]) wrong.push({ pairs: [j], v: p.solution[j], reason: 'Too many bridges here.' });
    });
    if (wrong.length) return wrong;
    return PuzzleShell.findIslandHint(p, state, (lo, hi, log) => step(p, lo, hi, log), 2, 'No simple step is left. These islands are joined here.');
  }

  PuzzleShell.start({
    id: 'hashiwokakero',
    name: 'Hashiwokakero',
    rules: 'Connect the islands with bridges. Each number tells how many bridges touch that island. ' +
      'Bridges run straight across or down, never cross, and at most two join the same pair of islands. ' +
      'In the end every island must be connected to every other.',
    controls: 'Click between two islands to add a bridge, again for a double bridge, again to remove. Right click goes back.',
    size: { min: 5, max: 12, def: 7 },
    solvedText: 'All islands linked — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, i: p.isl.map((x) => `${x.k}.${x.n}`).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 25)) throw new Error('Invalid board size');
      const isl = String(d.i).split(',').map((s) => { const [k, n] = s.split('.').map(Number); return { k, n }; });
      if (isl.some((x) => !(x.k >= 0 && x.k < R * C && x.n >= 1 && x.n <= 8))) throw new Error('Invalid islands');
      const p = prepare({ R, C, isl });
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.pairs.length),
    saveState: (s) => Array.from(s).join(''),
    loadState: (p, v) => (typeof v === 'string' && v.length === p.pairs.length ? Int8Array.from(v, (ch) => Number(ch) % 3) : new Int8Array(p.pairs.length)),
    render,
    check: (p, s) => s.every((v, j) => v === p.solution[j]),
    hints,
    applyHint(p, s, h) {
      if (h.set) for (const [j, v] of h.set) s[j] = v;
      else for (const j of h.pairs) s[j] = h.v;
    },
  });
})();
