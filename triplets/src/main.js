// Triplets (One or All). The grid is split into regions of three cells.
// Fill every cell with a square, circle or triangle. A region holds three
// equal figures or three different ones. Figures next to each other
// across a region border are different. Some figures are given.
// Values 1..3; candidates are bitmasks (bit v).

(() => {
  const SHAPES = ['', '■', '⬤', '▲'];
  const ALL = 0b1110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function prepare(p) {
    const { R, C, region } = p;
    p.groups = [];
    region.forEach((g, k) => { (p.groups[g] = p.groups[g] || []).push(k); });
    p.pairs = [];
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      if (c < C - 1 && region[k] !== region[k + 1]) p.pairs.push([k, k + 1]);
      if (r < R - 1 && region[k] !== region[k + C]) p.pairs.push([k, k + C]);
    }
    return p;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (const [a, b] of p.pairs) {
        if (one(cand[a])) cand[b] &= ~cand[a];
        if (one(cand[b])) cand[a] &= ~cand[b];
      }
      for (const cells of p.groups) {
        // Keep values that fit some all-same or all-different filling.
        const keep = cells.map(() => 0);
        for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) for (let z = 1; z <= 3; z++) {
          const v = [x, y, z];
          const same = x === y && y === z, diff = x !== y && y !== z && x !== z;
          if (!same && !diff) continue;
          if (cells.every((k, i) => cand[k] & (1 << v[i]))) cells.forEach((k, i) => { keep[i] |= 1 << v[i]; });
        }
        cells.forEach((k, i) => { cand[k] &= keep[i]; });
      }
      if (cand.some((m) => !m)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000, random = false) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      const k = cand.findIndex((m) => !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => (given[k] ? 1 << given[k] : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const pieces = Pieces.randomTiling(R, C, () => 3);
      if (!pieces) continue;
      const region = new Int32Array(R * C);
      pieces.forEach((cells, i) => cells.forEach((k) => { region[k] = i; }));
      const p = prepare({ R, C, region });
      const fill = solve(p, startCand(p, new Int8Array(R * C)), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const given = Int8Array.from(sol);
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every(one); };
      for (const k of PuzzleShell.shuffle([...sol.keys()])) {
        given[k] = 0;
        if (!solved()) given[k] = sol[k];
      }
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This figure is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    const out = [];
    for (let k = 0; k < val.length; k++) {
      if (!val[k] && one(cand[k])) out.push({ cells: [k], v: low(cand[k]), reason: `Only ${SHAPES[low(cand[k])]} fits here: its region must be all the same or all different, and neighbours across borders differ.` });
    }
    if (!out.length) {
      const k = [...val.keys()].find((i) => !val[i]);
      if (k !== undefined) out.push({ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell holds ${SHAPES[p.solution[k]]}.` });
    }
    return out;
  }

  function render(p, entries, opts = {}) {
    const { R, C, region, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions tp3-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, region, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = SHAPES[given[k]]; return; }
        const v = result ? solution[k] : entries[k];
        el.textContent = SHAPES[v];
        if (result) el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
      },
      onCell(k, ev) {
        if (given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 3 : 1)) % 4;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'triplets',
    name: 'Triplets',
    rules: 'Fill every cell with a square, circle or triangle. Each outlined region of three cells holds three equal ' +
      'figures or three different figures. Two figures next to each other across a region border are different.',
    controls: 'Click a cell to cycle square, circle, triangle, empty. Right click cycles back.',
    size: { min: 2, max: 4, def: 2, text: (h) => `${3 * h}×${3 * h}` },
    solvedText: 'All or one, everywhere — nicely done.',
    generate: (h) => generate(3 * h),
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      if (typeof d.v !== 'string' || d.v.length !== n * n || !/^[0-3]+$/.test(d.v)) throw new Error('Invalid givens');
      const p = prepare({ R: n, C: n, region: Int32Array.from({ length: n * n }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) });
      p.given = Int8Array.from(d.v, Number);
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.R * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.R * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 4;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
