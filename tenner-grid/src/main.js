// Tenner Grid. Each row of ten cells holds the digits 0-9 once. Cells
// that touch (even at a corner) hold different digits. The numbers at
// the bottom are the column sums. Some digits are given.
// Internally a digit d is stored as d + 1 (0 = empty); candidates are
// bitmasks over 0..9.

(() => {
  const C = 10;
  const FULL = (1 << 10) - 1;
  const bits = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const low = (m) => 31 - Math.clz32(m & -m);
  const high = (m) => 31 - Math.clz32(m);

  function propagate(p, cand) {
    const R = p.R;
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < R * C; k++) {
        if (!cand[k]) return false;
        if (bits(cand[k]) !== 1) continue;
        const r = Math.floor(k / C), c = k % C;
        for (let j = 0; j < C; j++) if (j !== c) cand[r * C + j] &= ~cand[k];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) cand[nr * C + nc] &= ~cand[k];
        }
      }
      for (let r = 0; r < R; r++) {
        for (let d = 0; d < 10; d++) {
          const where = [];
          for (let c = 0; c < C; c++) if (cand[r * C + c] & (1 << d)) where.push(r * C + c);
          if (!where.length) return false;
          if (where.length === 1) cand[where[0]] = 1 << d;
        }
      }
      // Column sums: each cell's value must fit the others' min / max.
      for (let c = 0; c < C; c++) {
        const cells = Array.from({ length: R }, (_, r) => r * C + c);
        const mins = cells.map((k) => low(cand[k])), maxs = cells.map((k) => high(cand[k]));
        const sMin = mins.reduce((a, b) => a + b, 0), sMax = maxs.reduce((a, b) => a + b, 0);
        const want = p.sums[c];
        if (sMin > want || sMax < want) return false;
        cells.forEach((k, i) => {
          const lo = want - (sMax - maxs[i]), hi = want - (sMin - mins[i]);
          let m = cand[k];
          for (let d = 0; d < 10; d++) if (d < lo || d > hi) m &= ~(1 << d);
          cand[k] = m;
        });
      }
      if (cand.some((m) => !m)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000) {
    const solutions = [];
    let nodes = 0;
    (function rec(cand) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      let pick = -1, best = 99;
      cand.forEach((m, k) => { const b = bits(m); if (b > 1 && b < best) { best = b; pick = k; } });
      if (pick < 0) { solutions.push(Int8Array.from(cand, (m) => low(m) + 1)); return; }
      for (let d = 0; d < 10; d++) {
        if (!(cand[pick] & (1 << d))) continue;
        const t = Int32Array.from(cand);
        t[pick] = 1 << d;
        rec(t);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * C }, (_, k) => (given[k] ? 1 << (given[k] - 1) : FULL));

  function randomGrid(R) {
    const g = new Int8Array(R * C);
    let nodes = 0;
    const rec = (k) => {
      if (k === R * C) return true;
      if (++nodes > 20000) return false;
      const r = Math.floor(k / C), c = k % C;
      for (const d of PuzzleShell.shuffle([...new Array(10).keys()])) {
        let ok = true;
        for (let j = r * C; j < k && ok; j++) if (g[j] === d + 1) ok = false;
        for (let dc = -1; dc <= 1 && ok; dc++) {
          const nc = c + dc;
          if (r > 0 && nc >= 0 && nc < C && g[(r - 1) * C + nc] === d + 1) ok = false;
        }
        if (!ok) continue;
        g[k] = d + 1;
        if (rec(k + 1)) return true;
        g[k] = 0;
      }
      return false;
    };
    return rec(0) ? g : null;
  }

  function generate(R) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sol = randomGrid(R);
      if (!sol) continue;
      const sums = Array.from({ length: C }, (_, c) => {
        let s = 0;
        for (let r = 0; r < R; r++) s += sol[r * C + c] - 1;
        return s;
      });
      const p = { R, sums, given: new Int8Array(R * C) };
      const run = () => solve(p, startCand(p, p.given), 2, 4000);
      for (let guard = 0; guard < R * C; guard++) {
        const res = run();
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
        const diff = [...sol.keys()].filter((k) => !p.given[k] && (other?.[k] !== sol[k]));
        const k = diff[Math.floor(Math.random() * diff.length)];
        p.given[k] = sol[k];
      }
      const unique = () => { const r = run(); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...sol.keys()])) {
        if (!p.given[k]) continue;
        p.given[k] = 0;
        if (!unique()) p.given[k] = sol[k];
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    const out = [];
    for (let k = 0; k < val.length; k++) {
      if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) out.push({ cells: [k], v: 0, reason: 'This digit is wrong.' });
    }
    if (out.length) return out;
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (val[k] || bits(cand[k]) !== 1) continue;
      out.push({ cells: [k], v: low(cand[k]) + 1, reason: `Only ${low(cand[k])} fits here. Its row, its neighbours and the column sum rule out the rest.` });
    }
    if (!out.length) {
      const k = [...val.keys()].find((i) => !val[i]);
      if (k !== undefined) out.push({ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k] - 1}.` });
    }
    return out;
  }

  function render(p, entries, opts = {}) {
    const { R, given, solution, sums } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R + 1, cols: C, cellPx: PuzzleShell.fitCell(C, 42), className: 'pz-board tg-board', readonly,
      renderCell(K, el) {
        if (K >= R * C) { el.className = 'clue'; el.textContent = sums[K - R * C]; return; }
        const k = K;
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k] - 1; return; }
        const v = result ? solution[k] : entries[k];
        el.textContent = v ? v - 1 : '';
        if (result) el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        if (!readonly) {
          el.tabIndex = 0;
          el.addEventListener('keydown', (ev) => {
            if (/^\d$/.test(ev.key)) { entries[k] = Number(ev.key) + 1; onChange(); }
            else if (ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === ' ') { entries[k] = 0; onChange(); }
            else return;
            ev.preventDefault();
            const next = document.querySelector(`#board-wrap [data-k="${Math.min(R * C - 1, k + 1)}"]`);
            if (next) next.focus();
          });
        }
      },
      onCell(K, ev) {
        if (K >= R * C || given[K]) return;
        // Click cycles 0..9 and empty; typing is faster.
        entries[K] = (entries[K] + (ev.button === 2 ? 10 : 1)) % 11;
        onChange();
        const el = document.querySelector(`#board-wrap [data-k="${K}"]`);
        if (el) el.focus();
      },
    });
  }

  PuzzleShell.start({
    id: 'tenner-grid',
    name: 'Tenner Grid',
    rules: 'Fill every row with the digits 0 to 9, each once. Cells that touch, even at a corner, hold different digits. ' +
      'Digits may repeat in a column; the numbers at the bottom are the column sums.',
    controls: 'Click a cell and type a digit (it moves on to the next cell). Clicking also cycles the digits; right click goes back.',
    size: { min: 3, max: 6, def: 4, label: 'Rows' },
    solvedText: 'Every column adds up — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, s: p.sums.join(','), g: Array.from(p.given, (v) => (v ? v - 1 : '.')).join('') }),
    decode(d) {
      const R = d?.r;
      if (!Number.isInteger(R) || R < 2 || R > 10) throw new Error('Invalid board size');
      const sums = String(d.s).split(',').map(Number);
      if (sums.length !== C || typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid puzzle');
      const p = { R, sums, given: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number(ch) + 1)) };
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.R * C),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.R * C);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const n = Number(x); if (n >= 0 && n <= 10) s[k] = n; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
