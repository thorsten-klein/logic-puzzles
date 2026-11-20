// Grades. Put digits 1–9 into some cells. No two digits touch, not even
// diagonally. Numbers above and left of the grid count the digits in that
// column or row; numbers below and right give their sum. Some digits may
// be given. Values: 1 = empty, v + 1 = digit v. Candidates are bitmasks.
// Player entries: 0 blank, 10 = marked empty, 1..9 digits.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b11111111110; // bits 1..10

  function prepare(p) {
    const { n, cnt, sum } = p; // cnt/sum: rows 0..n-1, then cols n..2n-1
    p.lines = [];
    for (let i = 0; i < 2 * n; i++) {
      const cells = i < n ? Array.from({ length: n }, (_, c) => i * n + c) : Array.from({ length: n }, (_, r) => r * n + (i - n));
      const L = { cells, cnt: cnt[i], sum: sum[i] };
      L.ok = (vals) => {
        const d = vals.filter((v) => v > 1);
        return d.length === L.cnt && d.reduce((a, v) => a + v - 1, 0) === L.sum;
      };
      L.ok.partial = (vals, j) => {
        let c = 0, s = 0;
        for (let x = 0; x <= j; x++) {
          if (vals[x] > 1) { c++; s += vals[x] - 1; if (x > 0 && vals[x - 1] > 1) return false; }
        }
        return c <= L.cnt && s <= L.sum && L.cnt - c <= Math.ceil((vals.length - j - 1) / 2) + 0;
      };
      p.lines.push(L);
    }
    p.around = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if ((dr || dc) && a >= 0 && b >= 0 && a < n && b < n) out.push(a * n + b);
      }
      return out;
    });
    return p;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      // A digit makes all cells around it empty.
      for (let k = 0; k < cand.length; k++) if (!(cand[k] & 2)) for (const j of p.around[k]) cand[j] &= 2;
      for (const L of p.lines) if (!Latin.filterGroup(L.cells, cand, L.ok, false)) return false;
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
      const i = cand.findIndex((m) => !one(m));
      if (i < 0) { out.push(Int8Array.from(cand, (m) => low(m) - 1)); return; }
      const vals = [];
      for (let v = 1; v <= 10; v++) if (cand[i] & (1 << v)) vals.push(v);
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[i] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  // Solutions hold 0 = empty, 1..9 digits.
  const startCand = (p) => Int32Array.from({ length: p.n * p.n }, (_, k) => (p.given[k] ? 1 << (p.given[k] + 1) : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      // Random digits that never touch.
      const sol = new Int8Array(N);
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        const r = Math.floor(k / n), c = k % n;
        let free = true;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const a = r + dr, b = c + dc;
          if (a >= 0 && b >= 0 && a < n && b < n && sol[a * n + b]) free = false;
        }
        if (free && Math.random() < 0.6) sol[k] = 1 + Math.floor(Math.random() * 9);
      }
      const cnt = new Int8Array(2 * n), sum = new Int16Array(2 * n);
      for (let k = 0; k < N; k++) {
        if (!sol[k]) continue;
        const r = Math.floor(k / n), c = k % n;
        cnt[r]++; sum[r] += sol[k]; cnt[n + c]++; sum[n + c] += sol[k];
      }
      const p = prepare({ n, cnt, sum, given: new Int8Array(N) });
      const solved = () => { const c = startCand(p); return propagate(p, c) && c.every(one); };
      // Give digits where logic gets stuck, then drop the extras.
      for (let guard = 0; guard < N && !solved() && Date.now() < deadline; guard++) {
        const c = startCand(p);
        propagate(p, c);
        const open = [...Array(N).keys()].filter((k) => !one(c[k]) && sol[k]);
        if (!open.length) break;
        const k = open[Math.floor(Math.random() * open.length)];
        p.given[k] = sol[k];
      }
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (!p.given[k]) continue;
        const keep = p.given[k];
        p.given[k] = 0;
        if (!solved()) p.given[k] = keep;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = (e) => (e === 10 ? 0 : e);
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && !p.given[k] && val(e) !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 10 ? 'This cell is not empty.' : 'This digit is wrong.' }];
    }
    const cand = Int32Array.from(entries, (e, k) => (p.given[k] ? 1 << (p.given[k] + 1) : e ? 1 << (val(e) + 1) : ALL));
    propagate(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || p.given[k] || !one(cand[k])) continue;
      const v = low(cand[k]) - 1;
      return [{ cells: [k], v: v || 10, reason: v ? `Only ${v} fits here: the counts and sums of its row and column leave no other choice.` : 'This cell stays empty: a digit here breaks a count, a sum or the no-touching rule.' }];
    }
    const k = [...entries.keys()].find((i) => !entries[i] && !p.given[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k] || 10, reason: p.solution[k] ? `No simple step is left. This cell holds ${p.solution[k]}.` : 'No simple step is left. This cell stays empty.' }];
  }

  function render(p, entries, opts = {}) {
    const { n, cnt, sum, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const W = n + 2;
    return PuzzleShell.gridBoard({
      rows: W, cols: W, cellPx: PuzzleShell.fitCell(W, 42), className: 'pz-board gr-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0 || r >= n || c >= n) {
          el.className = 'clue';
          if (r < 0 && c >= 0 && c < n) { el.textContent = cnt[n + c]; el.classList.add('gr-cnt'); }
          else if (r >= n && c >= 0 && c < n) { el.textContent = sum[n + c]; el.classList.add('gr-sum'); }
          else if (c < 0 && r >= 0 && r < n) { el.textContent = cnt[r]; el.classList.add('gr-cnt'); }
          else if (c >= n && r >= 0 && r < n) { el.textContent = sum[r]; el.classList.add('gr-sum'); }
          return;
        }
        const k = r * n + c;
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          if (solution[k]) el.textContent = solution[k];
          const mine = entries[k] === 10 ? 0 : entries[k];
          if (entries[k]) el.classList.add(mine === solution[k] ? 'ok' : 'bad');
          else if (solution[k]) el.classList.add('show');
          return;
        }
        if (readonly) { el.textContent = entries[k] && entries[k] < 10 ? entries[k] : ''; if (entries[k] === 10) el.classList.add('gr-empty'); return; }
        if (entries[k] === 10) el.classList.add('gr-empty');
        el.appendChild(PuzzleShell.digitInput({ r, c, value: entries[k] < 10 ? entries[k] : 0, max: 9,
          onSet: (v) => { entries[k] = v; onChange(false); } }));
      },
    });
  }

  PuzzleShell.start({
    id: 'grades',
    name: 'Grades',
    rules: 'Put digits 1 to 9 into some cells. No two digits touch, not even at a corner. The grey numbers above and ' +
      'left of the grid tell how many digits a column or row holds; the blue numbers below and right give their sum. ' +
      'Some digits may be given.',
    controls: 'Click a cell and type a digit. Arrow keys move between cells. Leave cells without a digit empty.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Top marks — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, c: Array.from(p.cnt).join(','), s: Array.from(p.sum).join(','), g: Array.from(p.given).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 10) throw new Error('Invalid board size');
      const cnt = Int8Array.from(String(d.c).split(','), Number), sum = Int16Array.from(String(d.s).split(','), Number);
      if (cnt.length !== 2 * n || sum.length !== 2 * n) throw new Error('Invalid clues');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[0-9]+$/.test(d.g)) throw new Error('Invalid givens');
      const p = prepare({ n, cnt, sum, given: Int8Array.from(d.g, Number) });
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const y = Number(x); if (y >= 0 && y <= 10) s[k] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || (v === 10 ? 0 : v)) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
