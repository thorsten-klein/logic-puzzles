// Trilogy. Fill every cell with a square, circle or triangle. In any
// three cells in a row (across, down or diagonal) the figures are never
// all the same and never all different. Some figures are given.
// Values 1..3; candidates are bitmasks (bit v).

(() => {
  const SHAPES = ['', '■', '⬤', '▲'];
  const ALL = 0b1110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function triples(R, C) {
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [0, 1, 2].map((i) => [r + dr * i, c + dc * i]);
        if (cells.every(([a, b]) => a >= 0 && b >= 0 && a < R && b < C)) out.push(cells.map(([a, b]) => a * C + b));
      }
    }
    return out;
  }

  // Exactly two equal figures among the three.
  const okTriple = (x, y, z) => (x === y) + (y === z) + (x === z) === 1;

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (const cells of p.triples) {
        const keep = [0, 0, 0];
        for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) for (let z = 1; z <= 3; z++) {
          if (!okTriple(x, y, z)) continue;
          const v = [x, y, z];
          if (cells.every((k, i) => cand[k] & (1 << v[i]))) v.forEach((w, i) => { keep[i] |= 1 << w; });
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
      const p = { R: n, C: n, triples: triples(n, n) };
      const fill = solve(p, startCand(p, new Int8Array(n * n)), 1, 3000, true);
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
    for (let k = 0; k < val.length; k++) {
      if (!val[k] && one(cand[k])) return [{ cells: [k], v: low(cand[k]), reason: `Only ${SHAPES[low(cand[k])]} fits here: any other figure would make three in a row all equal or all different.` }];
    }
    const k = [...val.keys()].find((i) => !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell holds ${SHAPES[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { R, C, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board tl-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.append(PuzzleShell.figure(given[k])); return; }
        const v = result ? solution[k] : entries[k];
        if (v) el.append(PuzzleShell.figure(v));
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
    id: 'trilogy',
    name: 'Trilogy',
    rules: 'Fill every cell with a square, circle or triangle. Any three cells in a row — across, down or diagonal — ' +
      'never hold three equal figures and never three different figures.',
    controls: 'Click a cell to cycle square, circle, triangle, empty. Right click cycles back.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'Never all, never none — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.v !== 'string' || d.v.length !== n * n || !/^[0-3]+$/.test(d.v)) throw new Error('Invalid givens');
      const p = { R: n, C: n, triples: triples(n, n), given: Int8Array.from(d.v, Number) };
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
