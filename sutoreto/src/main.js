// Sutoreto. Fill every white cell with a number from 1 to N (N is the
// grid size). Black cells split rows and columns into stretches; each
// stretch holds a run of consecutive numbers in any order (like 4-2-3).
// Numbers may repeat elsewhere in a row or column. Some are given.
// Uses the Latin helpers for the run rule.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  // Stretches of white cells (length >= 2) in rows and columns.
  function prepare(p) {
    const { R, C, black } = p;
    p.runs = [];
    const scan = (cells) => {
      let cur = [];
      for (const k of [...cells, -1]) {
        if (k >= 0 && !black[k]) { cur.push(k); continue; }
        if (cur.length >= 1) p.runs.push(cur);
        cur = [];
      }
    };
    for (let r = 0; r < R; r++) scan(Array.from({ length: C }, (_, c) => r * C + c));
    for (let c = 0; c < C; c++) scan(Array.from({ length: R }, (_, r) => r * C + c));
    return p;
  }

  function propagate(p, cand) {
    const { R, C, black } = p;
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      // Each stretch is a run of consecutive numbers.
      for (const run of p.runs) {
        if (run.length < 2) continue;
        const ok = (vals) => Math.max(...vals) - Math.min(...vals) === vals.length - 1;
        if (!Latin.filterGroup(run, cand, ok, true)) return false;
      }
      if (cand.some((m, k) => !black[k] && !m)) return false;
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
      const k = cand.findIndex((m, i) => !p.black[i] && !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, (m, i) => (p.black[i] ? 0 : low(m)))); return; }
      const vals = [];
      for (let v = 1; v < 31; v++) if (cand[k] & (1 << v)) vals.push(v);
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => (p.black[k] ? 0 : given[k] ? 1 << given[k] : (((1 << (p.R + 1)) - 1) & ~1)));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const black = Uint8Array.from({ length: N }, () => (Math.random() < 0.2 ? 1 : 0));
      const p = prepare({ R, C, black });
      const fill = solve(p, startCand(p, new Int8Array(N)), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const given = Int8Array.from(sol);
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every((m, k) => black[k] || one(m)); };
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (!given[k]) continue;
        const v = given[k];
        given[k] = 0;
        if (!solved()) given[k] = v;
      }
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.black[k] || val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${low(cand[k])} fits here: its stretches across and down must be runs of consecutive numbers.` }];
    }
    const k = [...val.keys()].find((i) => !p.black[i] && !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { R, C, black, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 46), className: 'pz-board st-board', readonly,
      renderCell(k, el) {
        if (black[k]) { el.classList.add('blk'); return; }
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) el.textContent = entries[k] || '';
        else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / C), c: k % C, value: entries[k], max: p.R,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'sutoreto',
    name: 'Sutoreto',
    rules: 'Fill every white cell with a number from 1 to N (N is the grid size). Black cells split rows and columns ' +
      'into stretches; each stretch holds a run of consecutive numbers in any order (like 4-2-3). Numbers may repeat ' +
      'elsewhere in a row or column.',
    controls: 'Click a cell and type a number. Arrow keys move between cells.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every stretch runs straight — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, b: Array.from(p.black).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid size');
      if (typeof d.b !== 'string' || d.b.length !== n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid grid');
      const p = prepare({ R: n, C: n, black: Uint8Array.from(d.b, Number) });
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
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) || 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.black[k] || (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
