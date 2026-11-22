// Korekutokonekuto (Correct Connection). Join all white circles with
// straight lines across or down. At most one line joins two circles,
// lines never cross and never pass a black circle, and all white circles
// end up connected. A number tells how many lines touch its circle; a
// circle without a number needs at least one line.
// Adapted from Hashiwokakero. n = -1 marks a circle without a number.

(() => {
  // --- puzzle model ---
  const prepare = (p) => PuzzleShell.buildIslandPairs(p, new Set(p.black || []));

  function checkClosedPairs(p, lo, hi, log) {
    if (p.isl.length <= 2) return 0;
    for (let j = 0; j < p.pairs.length; j++) {
      const { a, b } = p.pairs[j];
      const na = p.isl[a].n, nb = p.isl[b].n;
      if (na === 1 && nb === 1 && hi[j] >= 1) {
        hi[j] = 0;
        if (lo[j] > hi[j]) return -1;
        if (log) log.push({ pairs: [j], reason: 'Two 1s joined by a line would form a closed group. So they are not joined.' });
        return 1;
      }
    }
    return 0;
  }

  function checkCrossings(p, lo, hi, log) {
    const res = PuzzleShell.checkCrossingPairs(p, lo, hi, log, 'Lines');
    return res !== 0 ? res : checkClosedPairs(p, lo, hi, log);
  }

  // One round of forced moves. Returns false on contradiction, else the
  // number of changes. `log` gets { pairs, reason } for hints.
  function step(p, lo, hi, log) {
    const formatReason = (n, sumLo, sumHi) => {
      const need = n < 0 ? 1 : n;
      if (n < 0) return 'This circle needs at least one line, and only this one is left.';
      if (sumHi === need) return `This ${need} needs every line it can still get.`;
      if (sumLo === need) return `This ${need} already has all its lines.`;
      return `This ${need} can only reach its number with these lines.`;
    };
    const r = PuzzleShell.islandDegreeStep(p, lo, hi, log, formatReason);
    if (r !== 0) return r;
    const crossRes = checkCrossings(p, lo, hi, log);
    if (crossRes !== 0) return crossRes;
    if (!PuzzleShell.graphConnected(p, hi)) return -1;
    return 0;
  }

  function settle(p, lo, hi) {
    let r = 1;
    while (r > 0) r = step(p, lo, hi);
    return r === 0;
  }

  const solve = (p, stopAt = 2, maxNodes = 20000) => PuzzleShell.solveIslandGraph(p, settle, 1, stopAt, maxNodes);

  // --- generator ---
  function thinGivensAndObstacles(p, unique, black) {
    for (const x of PuzzleShell.shuffle(p.isl.slice())) {
      const keep = x.n;
      x.n = -1;
      if (!unique()) x.n = keep;
    }
    for (const k of PuzzleShell.shuffle(black.slice())) {
      p.black = p.black.filter((b) => b !== k);
      prepare(p);
      if (!unique()) { p.black.push(k); prepare(p); }
    }
  }

  function generate(n) {
    const R = n, C = n;
    for (let t = 0; t < 200; t++) {
      const net = PuzzleShell.growIslandNetwork(R, C, 1);
      if (!net) continue;
      const black = PuzzleShell.shuffle([...new Array(R * C).keys()].filter((k) => net.grid[k] === -1)).slice(0, Math.round(R * C * 0.08));
      const p = prepare({ R, C, isl: net.isl, black });
      const unique = () => { const r = solve(p, 2); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      thinGivensAndObstacles(p, unique, black);
      p.solution = solve(p, 1).solutions[0];
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

  function render(p, state, opts = {}) {
    const { R, C, isl, pairs, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = PuzzleShell.fitCell(C, 44, 26);
    const svg = el('svg', { width: C * s, height: R * s, class: 'hs-board' + (readonly ? ' readonly' : '') });
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, rx: 6, class: 'hs-bg' }, svg);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const hintSet = new Set(hint ? hint.pairs : []);
    pairs.forEach((q, j) => {
      const [x1, y1] = xy(isl[q.a].k), [x2, y2] = xy(isl[q.b].k);
      const v = result ? solution[j] : state[j];
      let cls = '';
      if (result && state[j]) cls = state[j] === solution[j] ? ' ok' : ' bad';
      else if (result && solution[j]) cls = ' miss'; // not entered yet
      if (hintSet.has(j)) cls += ' hint';
      if (v === 1) el('line', { x1, y1, x2, y2, class: 'hs-bridge' + cls }, svg);
      if (!v && (hintSet.has(j) || cls.includes('bad'))) el('line', { x1, y1, x2, y2, class: 'hs-ghost' + cls }, svg); // hint, or a wrong line
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'hs-hit', 'stroke-width': s * 0.5 }, svg);
        const cycle = () => { state[j] = state[j] ? 0 : 1; onChange(); };
        // Left and right click both switch the line on or off.
        hit.addEventListener('click', () => cycle());
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(); });
      }
    });
    for (const k of p.black || []) { const [cx, cy] = xy(k); el('circle', { cx, cy, r: s * 0.3, class: 'kc-black' }, svg); }
    isl.forEach((x, i) => {
      const [cx, cy] = xy(x.k);
      const have = p.of[i].reduce((a, j) => a + state[j], 0);
      const done = !result && (x.n < 0 ? have >= 1 : have === x.n);
      const g = el('g', { class: 'hs-island' + (done ? ' done' : '') + (hint && hint.island === i ? ' hint' : '') }, svg);
      el('circle', { cx, cy, r: s * 0.36 }, g);
      const t = el('text', { x: cx, y: cy, 'font-size': s * 0.42 }, g);
      t.textContent = x.n < 0 ? '' : x.n;
    });
    return svg;
  }

  // --- hints ---
  function hints(p, state) {
    const wrong = [];
    state.forEach((v, j) => {
      if (v && v > p.solution[j]) wrong.push({ pairs: [j], v: p.solution[j], reason: 'No line goes here.' });
    });
    if (wrong.length) return wrong;
    return PuzzleShell.findIslandHint(p, state, (lo, hi, log) => step(p, lo, hi, log), 1, 'No simple step is left. These circles are joined here.');
  }

  PuzzleShell.start({
    id: 'korekutokonekuto',
    name: 'Korekutokonekuto',
    rules: 'Join all white circles with straight lines across or down. At most one line joins two circles, lines never ' +
      'cross and never pass a black circle, and in the end all white circles are connected. A number tells how many lines ' +
      'touch its circle; a circle without a number needs at least one line.',
    controls: 'Click between two circles to draw a line, click again to remove it.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Correctly connected — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, i: p.isl.map((x) => `${x.k}.${x.n}`).join(','), b: (p.black || []).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 25)) throw new Error('Invalid board size');
      const isl = String(d.i).split(',').map((s) => { const [k, n] = s.split('.').map(Number); return { k, n }; });
      if (isl.some((x) => !(x.k >= 0 && x.k < R * C && (x.n === -1 || (x.n >= 1 && x.n <= 4))))) throw new Error('Invalid circles');
      const black = String(d.b || '').split(',').filter((t) => t !== '').map(Number);
      if (black.some((k) => !(k >= 0 && k < R * C))) throw new Error('Invalid circles');
      const p = prepare({ R, C, isl, black });
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.pairs.length),
    saveState: (s) => Array.from(s).join(''),
    loadState: (p, v) => (typeof v === 'string' && v.length === p.pairs.length ? Int8Array.from(v, (ch) => Number(ch) % 2) : new Int8Array(p.pairs.length)),
    render,
    check: (p, s) => s.every((v, j) => v === p.solution[j]),
    hints,
    applyHint(p, s, h) {
      if (h.set) for (const [j, v] of h.set) s[j] = v;
      else for (const j of h.pairs) s[j] = h.v;
    },
  });
})();
