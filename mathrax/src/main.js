// Mathrax. A Latin square (1..N once per row and column) with circle
// clues on grid corners. A clue applies to both diagonal pairs of the
// four cells around it: "5+" means both pairs add up to 5, "1−" both
// differ by 1, "6×" multiply to 6, "2÷" divide to 2. "E" means all four
// cells are even, "O" all four are odd.

(() => {
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  // The four cells around corner (r, c), r and c in 1..n-1:
  // diagonal pairs [tl, br] and [tr, bl].
  function around(n, r, c) {
    const tl = (r - 1) * n + c - 1;
    return { tl, tr: tl + 1, bl: tl + n, br: tl + n + 1 };
  }

  function pairOk(op, v, a, b) {
    if (op === '+') return a + b === v;
    if (op === '*') return a * b === v;
    if (op === '-') return Math.abs(a - b) === v;
    return Math.max(a, b) === v * Math.min(a, b); // '/'
  }

  function clueOk(cl, vals) {
    const [tl, tr, bl, br] = vals;
    if (cl.op === 'E') return vals.every((x) => x % 2 === 0);
    if (cl.op === 'O') return vals.every((x) => x % 2 === 1);
    return pairOk(cl.op, cl.v, tl, br) && pairOk(cl.op, cl.v, tr, bl);
  }

  function makePrune(p) {
    return (cand) => {
      for (const cl of p.clues) {
        const { tl, tr, bl, br } = around(p.n, cl.r, cl.c);
        const cells = [tl, tr, bl, br];
        const ok = (vals) => clueOk(cl, vals);
        if (!Latin.filterGroup(cells, cand, ok, false)) return false;
        for (const k of cells) if (!cand[k]) return false;
      }
      return true;
    };
  }

  // Clues that hold at corner (r, c) of grid g.
  function possibleClues(n, g, r, c) {
    const { tl, tr, bl, br } = around(n, r, c);
    const vals = [g[tl], g[tr], g[bl], g[br]];
    const out = [];
    for (const op of ['+', '-', '*', '/']) {
      const a = op === '+' ? vals[0] + vals[3] : op === '*' ? vals[0] * vals[3]
        : op === '-' ? Math.abs(vals[0] - vals[3]) : Math.max(vals[0], vals[3]) / Math.min(vals[0], vals[3]);
      if (Number.isInteger(a) && a > 0 && clueOk({ op, v: a }, vals)) out.push({ r, c, op, v: a });
    }
    if (vals.every((x) => x % 2 === 0)) out.push({ r, c, op: 'E' });
    if (vals.every((x) => x % 2 === 1)) out.push({ r, c, op: 'O' });
    return out;
  }

  const solveP = (p, nodes = 20000) =>
    Latin.solve(p.n, Latin.startCand(p.n, p.given), makePrune(p), 2, nodes);

  function generate(n) {
    for (let t = 0; t < 40; t++) {
      const sol = Latin.randomSquare(n);
      const clues = [];
      for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) {
        const opts = possibleClues(n, sol, r, c);
        if (opts.length) clues.push(opts[Math.floor(Math.random() * opts.length)]);
      }
      const p = { n, clues, given: new Int8Array(n * n), solution: sol };
      // Add givens where another answer differs, until unique.
      for (let guard = 0; guard < n * n; guard++) {
        const res = solveP(p, 5000);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
        const diff = [...sol.keys()].filter((k) => !p.given[k] && (other?.[k] !== sol[k]));
        const k = diff[Math.floor(Math.random() * diff.length)];
        p.given[k] = sol[k];
      }
      const unique = () => { const r = solveP(p, 5000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...sol.keys()])) {
        if (!p.given[k]) continue;
        p.given[k] = 0;
        if (!unique()) p.given[k] = sol[k];
      }
      for (const cl of PuzzleShell.shuffle(p.clues.slice())) {
        p.clues = p.clues.filter((x) => x !== cl);
        if (!unique()) p.clues.push(cl);
      }
      return p;
    }
    return null;
  }

  function render(p, entries, opts = {}) {
    const { n, given, solution, clues } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = PuzzleShell.fitCell(n, 52);
    const wrap = document.createElement('div');
    wrap.className = 'mx-wrap';
    const hintCells = new Set(hint ? hint.cells : []);
    const board = PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: s, className: 'pz-board mx-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) {
          el.textContent = entries[k] || '';
          el.classList.add('entry');
        } else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: n,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
    wrap.appendChild(board);
    // Circles on the corners. Board has 2px padding and 2px gaps.
    for (const cl of clues) {
      const b = document.createElement('div');
      b.className = 'mx-clue';
      b.textContent = cl.op === 'E' || cl.op === 'O' ? cl.op : `${cl.v}${SYM[cl.op]}`;
      b.style.left = `${3 + cl.c * (s + 2) - 1}px`;
      b.style.top = `${3 + cl.r * (s + 2) - 1}px`;
      wrap.appendChild(b);
    }
    return wrap;
  }

  const merged = (p, s) => Int8Array.from(s, (v, k) => p.given[k] || v);

  PuzzleShell.start({
    id: 'mathrax',
    name: 'Mathrax',
    rules: 'Fill the grid with 1 to N so each row and column holds every number once. A circle on a corner applies to both ' +
      'diagonal pairs of the four cells around it: "5+" both pairs add up to 5, "1−" both differ by 1, "6×" both multiply ' +
      'to 6, "2÷" one is twice the other. "E" means all four are even, "O" all four are odd.',
    controls: 'Click a cell and type a number. Arrow keys move between cells.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every corner checks out — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.given).join(''), k: p.clues.map((x) => `${x.r}.${x.c}.${x.op}${x.v || ''}`).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 9) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^\d+$/.test(d.g)) throw new Error('Invalid givens');
      const clues = String(d.k || '').split(',').filter(Boolean).map((s) => {
        const m = /^(\d+)\.(\d+)\.([-+*/EO])(\d*)$/.exec(s);
        if (!m) throw new Error('Invalid clue');
        return { r: Number(m[1]), c: Number(m[2]), op: m[3], v: m[4] ? Number(m[4]) : undefined };
      });
      const p = { n, clues, given: Int8Array.from(d.g, Number) };
      const res = solveP(p, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, val) {
      const s = new Int8Array(p.n * p.n);
      const parts = String(val).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const v = Number(x); if (v >= 0 && v <= p.n) s[k] = v; });
      return s;
    },
    render,
    check: (p, s) => merged(p, s).every((v, k) => v === p.solution[k]),
    hints: (p, s) => Latin.hints(p.n, merged(p, s), p.solution, makePrune(p), 'the corner clues'),
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
