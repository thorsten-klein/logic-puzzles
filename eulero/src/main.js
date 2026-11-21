// Eulero (Graeco-Latin square). Every cell holds one letter and one digit.
// Each row and each column holds every letter once and every digit once,
// and no letter–digit pair appears twice. Some cells are given.
// A pair is coded as letter * n + digit (both 0-based); candidates are
// bitmasks over all n * n pairs.

(() => {
  const LET = 'ABCDE';
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const bits = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

  function propagate(n, cand) {
    const N = n * n;
    const all = (1 << N) - 1;
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < N; k++) {
        if (!one(cand[k])) continue;
        const v = low(cand[k]), a = Math.floor(v / n), b = v % n;
        const r = Math.floor(k / n), c = k % n;
        let mask = 0;
        for (let d = 0; d < n; d++) { mask |= 1 << (a * n + d); mask |= 1 << (d * n + b); }
        for (let j = 0; j < N; j++) {
          if (j === k) continue;
          cand[j] &= ~(1 << v); // each pair once
          if (Math.floor(j / n) === r || j % n === c) cand[j] &= ~mask & all;
        }
      }
      // Each pair appears once: if only one cell can hold it, it goes there.
      for (let v = 0; v < N; v++) {
        const where = [];
        for (let k = 0; k < N; k++) if (cand[k] & (1 << v)) where.push(k);
        if (!where.length) return false;
        if (where.length === 1) cand[where[0]] = 1 << v;
      }
      if (cand.some((m) => !m)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(n, start, stopAt = 2, maxNodes = 20000) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(n, cand)) return;
      let k = -1, best = 99;
      cand.forEach((m, i) => { const b = bits(m); if (b > 1 && b < best) { best = b; k = i; } });
      if (k < 0) { out.push(Int8Array.from(cand, low)); return; }
      for (let v = 0; v < n * n; v++) if (cand[k] & (1 << v)) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (n, given) => Int32Array.from({ length: n * n }, (_, k) => (given[k] >= 0 ? 1 << given[k] : (1 << (n * n)) - 1));

  // Two orthogonal Latin squares, shuffled.
  function randomSquare(n) {
    let A, B;
    if (n === 4) {
      A = [[0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]];
      B = [[0, 1, 2, 3], [2, 3, 0, 1], [3, 2, 1, 0], [1, 0, 3, 2]];
    } else {
      A = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) % n));
      B = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (2 * r + c) % n));
    }
    const rows = PuzzleShell.shuffle([...new Array(n).keys()]), cols = PuzzleShell.shuffle([...new Array(n).keys()]);
    const la = PuzzleShell.shuffle([...new Array(n).keys()]), lb = PuzzleShell.shuffle([...new Array(n).keys()]);
    return Int8Array.from({ length: n * n }, (_, k) => {
      const r = rows[Math.floor(k / n)], c = cols[k % n];
      return la[A[r][c]] * n + lb[B[r][c]];
    });
  }

  function generate(n) {
    const sol = randomSquare(n);
    const given = Int8Array.from(sol);
    const solved = () => { const c = startCand(n, given); return propagate(n, c) && c.every(one); };
    for (const k of PuzzleShell.shuffle([...new Array(n * n).keys()])) {
      const v = given[k];
      given[k] = -1;
      if (!solved()) given[k] = v;
    }
    return { n, given, solution: sol };
  }

  const text = (n, v) => (v >= 0 ? LET[Math.floor(v / n)] + (v % n + 1) : '');
  const parse = (n, s) => {
    const m = /^([a-e])([1-5])$/i.exec(s.trim());
    if (!m) return -1;
    const a = LET.indexOf(m[1].toUpperCase()), b = Number(m[2]) - 1;
    return a < n && b < n ? a * n + b : -1;
  };

  function hints(p, entries) {
    const { n } = p;
    for (let k = 0; k < n * n; k++) if (entries[k] >= 0 && p.given[k] < 0 && entries[k] !== p.solution[k]) return [{ cells: [k], v: -1, reason: 'This pair is wrong.' }];
    const cand = startCand(n, Int8Array.from(entries, (v, k) => (p.given[k] >= 0 ? p.given[k] : v)));
    propagate(n, cand);
    for (let k = 0; k < n * n; k++) {
      if (entries[k] >= 0 || p.given[k] >= 0 || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${text(n, low(cand[k]))} fits here: its letter and digit must be new in its row and column, and every pair is used once.` }];
    }
    const k = [...entries.keys()].find((i) => entries[i] < 0 && p.given[i] < 0);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${text(n, p.solution[k])}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 56), className: 'pz-board eu-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k] >= 0) { el.classList.add('given'); el.textContent = text(n, given[k]); return; }
        if (result) {
          el.textContent = text(n, solution[k]);
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k], entries[k] >= 0));
          return;
        }
        if (readonly) { el.textContent = text(n, entries[k]); return; }
        const inp = document.createElement('input');
        inp.className = 'eu-input';
        inp.maxLength = 2;
        inp.value = text(n, entries[k]);
        inp.setAttribute('aria-label', `Row ${Math.floor(k / n) + 1}, column ${(k % n) + 1}`);
        inp.addEventListener('input', () => {
          const v = parse(n, inp.value);
          if (v >= 0 || !inp.value) { entries[k] = inp.value ? v : -1; onChange(false); }
        });
        el.appendChild(inp);
      },
    });
  }

  PuzzleShell.start({
    id: 'eulero',
    name: 'Eulero',
    rules: 'Every cell holds one letter and one digit, like B3. Each row and each column holds every letter once and ' +
      'every digit once, and no letter–digit pair appears twice in the grid. Some cells are given.',
    controls: 'Click a cell and type its letter and digit, for example B3.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Euler would be proud — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.given, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d?.n;
      if (n !== 4 && n !== 5) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid givens');
      const given = Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36)));
      const res = solve(n, startCand(n, given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      return { n, given, solution: res.solutions[0] };
    },
    newState: (p) => new Int8Array(p.n * p.n).fill(-1),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n).fill(-1);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const y = Number(x); if (y >= -1 && y < p.n * p.n) s[k] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] >= 0 ? p.given[k] : v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (p.given[k] < 0) s[k] = h.v; },
  });
})();
