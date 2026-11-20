// Doppelblock. Each row and column has two black cells and the digits
// 1..N-2 once each. A clue gives the sum of the digits between the two
// black cells of its row or column.
// Values: 1..N-2 = digits, B = N-1 = black (0 = not filled).

(() => {
  // Lines as [clue index, cells]: columns (top clues), then rows (left clues).
  function lines(n) {
    const out = [];
    for (let c = 0; c < n; c++) out.push([c, Array.from({ length: n }, (_, i) => i * n + c)]);
    for (let r = 0; r < n; r++) out.push([n + r, Array.from({ length: n }, (_, i) => r * n + i)]);
    return out;
  }

  // Sum between the two blacks (or -1 if not exactly two).
  function between(vals, B) {
    const at = [];
    vals.forEach((v, i) => { if (v === B) at.push(i); });
    if (at.length !== 2) return -1;
    let s = 0;
    for (let i = at[0] + 1; i < at[1]; i++) s += vals[i];
    return s;
  }

  function propagate(p, cand) {
    const { n, clues } = p;
    const B = n - 1;
    const all = lines(n);
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (const [i, cells] of all) {
        const want = clues[i];
        const ok = (vals) => {
          let used = 0, blacks = 0;
          for (const v of vals) {
            if (v === B) blacks++;
            else { if (used & (1 << v)) return false; used |= 1 << v; }
          }
          return blacks === 2 && (want < 0 || between(vals, B) === want);
        };
        ok.partial = (vals, j) => {
          let used = 0, blacks = 0, sum = 0;
          for (let x = 0; x <= j; x++) {
            const v = vals[x];
            if (v === B) blacks++;
            else {
              if (used & (1 << v)) return false;
              used |= 1 << v;
              if (blacks === 1) sum += v;
            }
          }
          if (blacks > 2) return false;
          return want < 0 || blacks !== 1 || sum <= want;
        };
        if (!Latin.filterGroup(cells, cand, ok, false)) return false;
      }
      if (cand.some((x) => !x)) return false;
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
      for (let k = 0; k < cand.length; k++) {
        const c = Latin.bitCount(cand[k]);
        if (c > 1 && c < best) { best = c; pick = k; }
      }
      if (pick < 0) { solutions.push(Int8Array.from(cand, Latin.lowBit)); return; }
      for (const v of Latin.values(cand[pick])) {
        const copy = Int32Array.from(cand);
        copy[pick] = 1 << v;
        rec(copy);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  const startCand = (p, entries) => Int32Array.from({ length: p.n * p.n },
    (_, k) => (entries && entries[k] ? 1 << entries[k] : Latin.full(p.n - 1)));

  function generate(n) {
    const B = n - 1;
    const sq = Latin.randomSquare(n);
    const sol = Int8Array.from(sq, (v) => (v >= n - 1 ? B : v));
    const clues = lines(n).map(([, cells]) => between(cells.map((k) => sol[k]), B));
    const p = { n, clues, solution: sol };
    const unique = () => {
      const r = solve(p, startCand(p), 2, 4000);
      return r.solutions.length === 1 && !r.capped;
    };
    if (!unique()) return null;
    for (const i of PuzzleShell.shuffle([...clues.keys()])) {
      const keep = clues[i];
      clues[i] = -1;
      if (!unique()) clues[i] = keep;
    }
    return p;
  }

  function hints(p, entries) {
    const { n, solution } = p;
    const B = n - 1;
    const out = [];
    for (let k = 0; k < n * n; k++) {
      if (entries[k] && entries[k] !== solution[k]) out.push({ cells: [k], v: 0, reason: 'This cell is wrong.' });
    }
    if (out.length) return out;
    const cand = startCand(p, entries);
    propagate(p, cand);
    for (let k = 0; k < n * n; k++) {
      if (entries[k] || Latin.bitCount(cand[k]) !== 1) continue;
      const v = Latin.lowBit(cand[k]);
      out.push({ cells: [k], v, reason: v === B
        ? 'This cell must be black. Its row, its column and the sums leave nothing else.'
        : `Only ${v} fits here. Its row, its column and the sums rule out the rest.` });
    }
    if (!out.length) {
      const k = [...entries.keys()].find((i) => !entries[i]);
      if (k !== undefined) out.push({ cells: [k], v: solution[k], reason: 'No simple step is left. Here is one cell.' });
    }
    return out;
  }

  function render(p, entries, opts = {}) {
    const { n, clues, solution } = p;
    const B = n - 1;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n + 1, cols: n + 1, cellPx: PuzzleShell.fitCell(n + 1, 46), className: 'pz-board db-board', readonly,
      renderCell(K, el) {
        const R = Math.floor(K / (n + 1)) - 1, C = (K % (n + 1)) - 1;
        if (R < 0 || C < 0) {
          el.className = 'clue';
          const v = R < 0 && C >= 0 ? clues[C] : C < 0 && R >= 0 ? clues[n + R] : -1;
          el.textContent = v >= 0 ? v : '';
          return;
        }
        const k = R * n + C;
        const v = result ? solution[k] : entries[k];
        if (v === B) el.classList.add('shaded');
        else if (v) el.textContent = v;
        if (result) el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        if (hintCells.has(k)) el.classList.add('hint');
        if (!readonly) {
          el.addEventListener('keydown', (ev) => {
            if (/^[1-9]$/.test(ev.key) && Number(ev.key) <= n - 2) { entries[k] = Number(ev.key); onChange(); }
            else if (ev.key === 'x' || ev.key === 'X' || ev.key === ' ') { entries[k] = B; onChange(); }
            else if (ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === '0') { entries[k] = 0; onChange(); }
          });
          el.tabIndex = 0;
        }
      },
      onCell(K, ev) {
        const R = Math.floor(K / (n + 1)) - 1, C = (K % (n + 1)) - 1;
        if (R < 0 || C < 0) return;
        const k = R * n + C;
        // Click order: empty → black → 1 → 2 ... → empty.
        const order = [0, B, ...Array.from({ length: n - 2 }, (_, i) => i + 1)];
        const i = order.indexOf(entries[k]);
        entries[k] = order[(i + (ev.button === 2 ? order.length - 1 : 1)) % order.length];
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'doppelblock',
    name: 'Doppelblock',
    rules: 'Shade two cells black in every row and column. Fill the other cells with the digits 1 to N-2 so each row and ' +
      'column holds each digit once. A number outside tells the sum of the digits between the two black cells of that line.',
    controls: 'Click a cell to cycle: black, 1, 2, … , empty. Right click cycles back. Or select a cell and type a digit, X for black.',
    size: { min: 5, max: 7, def: 5 },
    solvedText: 'Every sum adds up — nicely done.',
    generate(n) {
      for (let t = 0; t < 60; t++) { const p = generate(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.n, c: p.clues.join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 4 || n > 9) throw new Error('Invalid board size');
      const clues = String(d.c).split(',').map(Number);
      if (clues.length !== 2 * n || clues.some((x) => !(x >= -1 && x <= 45))) throw new Error('Invalid clues');
      const p = { n, clues };
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % p.n;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
