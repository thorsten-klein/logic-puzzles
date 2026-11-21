// Nanbaboru (Number Ball). Write the numbers 1 to K into some cells so
// each row and each column holds every number exactly once; all other
// cells stay empty. A circle cell holds a number, a cross cell stays
// empty. Some numbers are given.
// p.mark: 0 none, 1 circle, 2 cross. Candidates: bitmask, bit 0 = empty.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function lines(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push([...new Array(n).keys()].map((j) => i * n + j), [...new Array(n).keys()].map((j) => j * n + i));
    }
    return out;
  }

  function propagate(p, cand) {
    const { n, k } = p;
    const empties = n - k;
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      for (const cells of p.lines) {
        for (let v = 1; v <= k; v++) {
          const can = cells.filter((x) => cand[x] & (1 << v));
          if (!can.length) return false;
          if (can.length === 1) cand[can[0]] = 1 << v;
          const fixed = cells.filter((x) => cand[x] === 1 << v);
          if (fixed.length > 1) return false;
          if (fixed.length === 1) for (const x of cells) if (x !== fixed[0]) cand[x] &= ~(1 << v);
        }
        const sure = cells.filter((x) => cand[x] === 1).length;
        const maybe = cells.filter((x) => cand[x] & 1);
        if (sure > empties || maybe.length < empties) return false;
        if (maybe.length === empties) for (const x of maybe) cand[x] = 1;
        if (sure === empties) for (const x of cells) if (cand[x] !== 1) cand[x] &= ~1;
      }
      if (cand.some((m) => !m)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function startCand(p, given) {
    const all = (1 << (p.k + 1)) - 1;
    return Int32Array.from({ length: p.n * p.n }, (_, x) => {
      if (given[x]) return 1 << given[x];
      if (p.mark[x] === 2) return 1;
      if (p.mark[x] === 1) return all & ~1;
      return all;
    });
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      const x = cand.findIndex((m) => !one(m));
      if (x < 0) { out.push(Int8Array.from(cand, low)); return; }
      for (let v = 0; v <= p.k; v++) {
        if (!(cand[x] & (1 << v))) continue;
        const t = Int32Array.from(cand);
        t[x] = 1 << v;
        rec(t);
      }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  // Random Latin square by shuffling rows, columns and symbols of a cyclic one.
  function latin(n) {
    const rows = PuzzleShell.shuffle([...new Array(n).keys()]), cols = PuzzleShell.shuffle([...new Array(n).keys()]);
    const sym = PuzzleShell.shuffle([...new Array(n).keys()].map((i) => i + 1));
    return Int8Array.from({ length: n * n }, (_, x) => sym[(rows[Math.floor(x / n)] + cols[x % n]) % n]);
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    const k = Math.max(2, n - 2);
    while (Date.now() < deadline) {
      const N = n * n;
      // A Latin square with jumbled rows gives more variety.
      let sq = latin(n);
      for (let t = 0; t < 20; t++) {
        const a = Math.floor(Math.random() * n), b = Math.floor(Math.random() * n);
        if (a === b) continue;
        // Swap two symbols in two rows where it keeps columns fine (an intercalate).
        for (let c1 = 0; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) {
          const x1 = sq[a * n + c1], x2 = sq[a * n + c2];
          if (sq[b * n + c1] === x2 && sq[b * n + c2] === x1 && Math.random() < 0.3) {
            sq[a * n + c1] = x2; sq[a * n + c2] = x1; sq[b * n + c1] = x1; sq[b * n + c2] = x2;
          }
        }
      }
      const sol = Int8Array.from(sq, (v) => (v > k ? 0 : v));
      const p = { n, k, lines: lines(n), mark: Uint8Array.from(sol, (v) => (v ? 1 : 2)) };
      const given = new Int8Array(N);
      const unique = () => { const r = solve(p, startCand(p, given), 2, 4000); return r.solutions.length === 1 && !r.capped; };
      // Start with marks only, add numbers until unique.
      let tries = 0;
      while (!unique() && tries++ < N) {
        const x = Math.floor(Math.random() * N);
        if (sol[x]) given[x] = sol[x];
      }
      if (!unique()) continue;
      // Drop marks and numbers that are not needed.
      for (const x of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (given[x]) { const v = given[x]; given[x] = 0; if (!unique()) given[x] = v; }
        const m = p.mark[x];
        p.mark[x] = 0;
        if (!unique()) p.mark[x] = m;
      }
      for (let x = 0; x < N; x++) if (given[x]) p.mark[x] = 0;
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, s) {
    for (let x = 0; x < s.length; x++) if (s[x] && !p.given[x] && s[x] !== p.solution[x]) return [{ cells: [x], v: 0, reason: p.solution[x] ? 'This number is wrong.' : 'This cell stays empty.' }];
    const cand = startCand(p, Int8Array.from(s, (v, x) => p.given[x] || v));
    propagate(p, cand);
    for (let x = 0; x < s.length; x++) {
      if (p.given[x] || s[x] || !one(cand[x]) || cand[x] === 1) continue;
      return [{ cells: [x], v: low(cand[x]), reason: `Only ${low(cand[x])} fits here: its row and column leave no other choice.` }];
    }
    const x = [...s.keys()].find((i) => !p.given[i] && !s[i] && p.solution[i]);
    return x === undefined ? [] : [{ cells: [x], v: p.solution[x], reason: `No simple step is left. This cell is ${p.solution[x]}.` }];
  }

  function render(p, s, opts = {}) {
    const { n, k, mark, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board nb-board', readonly,
      renderCell(x, el) {
        if (hintCells.has(x)) el.classList.add('hint');
        if (mark[x] === 1) { const o = document.createElement('span'); o.className = 'nb-ring'; el.append(o); }
        if (mark[x] === 2) el.classList.add('nb-cross');
        if (given[x]) { el.classList.add('given'); el.append(String(given[x])); return; }
        if (result) {
          if (solution[x]) el.append(String(solution[x]));
          // No mark on a cell that is rightly empty.
          const cls = s[x] === solution[x] && !solution[x] ? '' : PuzzleShell.resultClass(s[x], solution[x]);
          if (cls) el.classList.add(cls);
        } else if (readonly) el.append(s[x] ? String(s[x]) : '');
        else if (mark[x] !== 2) {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(x / n), c: x % n, value: s[x], max: k,
            onSet: (v) => { s[x] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'nanbaboru',
    name: 'Nanbaboru',
    rules: 'Write the numbers 1 to K into some cells so each row and each column holds every number exactly once; all ' +
      'other cells stay empty. K is the board size minus 2. A circle cell holds a number, a cross cell stays empty. Some ' +
      'numbers are given.',
    controls: 'Click a cell and type a number. Leave empty cells blank. Arrow keys move between cells.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every ball in place — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, k: p.k, m: Array.from(p.mark).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n, k = d?.k;
      if (!Number.isInteger(n) || n < 3 || n > 10 || !Number.isInteger(k) || k < 1 || k > n) throw new Error('Invalid board size');
      if (typeof d.m !== 'string' || d.m.length !== n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid puzzle');
      const p = { n, k, lines: lines(n), mark: Uint8Array.from(d.m, Number), given: Int8Array.from(d.v, Number) };
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let x = 0; x < s.length; x++) s[x] = Number(v[x]) || 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, x) => (p.given[x] || v) === p.solution[x]),
    hints,
    applyHint(p, s, h) { for (const x of h.cells) if (!p.given[x]) s[x] = h.v; },
  });
})();
