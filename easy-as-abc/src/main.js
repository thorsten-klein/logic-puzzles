// Easy as ABC. Each row and column holds the letters A.. once each; the
// other cells stay blank. Edge letters show the first letter seen from
// that side. Values: 1..m = letters, m+1 = blank (0 = not filled).

(() => {
  const letter = (v, m) => (v >= 1 && v <= m ? String.fromCodePoint(64 + v) : '');

  // Lines as [clue index, cells in viewing order] (top, bottom, left, right).
  function lines(n) {
    const out = [];
    for (let c = 0; c < n; c++) out.push([c, Array.from({ length: n }, (_, i) => i * n + c)]);
    for (let c = 0; c < n; c++) out.push([n + c, Array.from({ length: n }, (_, i) => (n - 1 - i) * n + c)]);
    for (let r = 0; r < n; r++) out.push([2 * n + r, Array.from({ length: n }, (_, i) => r * n + i)]);
    for (let r = 0; r < n; r++) out.push([3 * n + r, Array.from({ length: n }, (_, i) => r * n + n - 1 - i)]);
    return out;
  }

  const firstSeen = (vals, m) => vals.find((v) => v <= m) || 0;

  function createLineValidator(n, m, want) {
    const ok = (vals) => {
      let used = 0, blanks = 0;
      for (const v of vals) {
        if (v > m) blanks++;
        else {
          if (used & (1 << v)) return false;
          used |= 1 << v;
        }
      }
      return blanks === n - m && (!want || firstSeen(vals, m) === want);
    };
    ok.partial = (vals, j) => {
      let used = 0, blanks = 0, first = 0;
      for (let x = 0; x <= j; x++) {
        const v = vals[x];
        if (v > m) blanks++;
        else {
          if (used & (1 << v)) return false;
          used |= 1 << v;
          if (!first) first = v;
        }
      }
      if (blanks > n - m) return false;
      return !want || !first || first === want;
    };
    return ok;
  }

  // Keeps only candidates that fit some valid filling of each line.
  function propagate(p, cand) {
    const { n, m, clues } = p;
    const all = lines(n);
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (const [i, cells] of all) {
        const ok = createLineValidator(n, m, clues[i]);
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
    (_, k) => (entries?.[k] ? 1 << entries[k] : Latin.full(p.m + 1)));

  function generate(n) {
    const m = n <= 4 ? n - 1 : n - 2;
    const sq = Latin.randomSquare(n);
    const sol = Int8Array.from(sq, (v) => (v > m ? m + 1 : v));
    const clues = new Array(4 * n).fill(0);
    for (const [i, cells] of lines(n)) clues[i] = firstSeen(cells.map((k) => sol[k]), m);
    const p = { n, m, clues, solution: sol };
    const unique = () => {
      const r = solve(p, startCand(p), 2, 5000);
      return r.solutions.length === 1 && !r.capped;
    };
    if (!unique()) return null;
    for (const i of PuzzleShell.shuffle([...clues.keys()])) {
      const keep = clues[i];
      clues[i] = 0;
      if (!unique()) clues[i] = keep;
    }
    return p;
  }

  function hints(p, entries) {
    const { n, m, solution } = p;
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
      out.push({ cells: [k], v, reason: v > m
        ? 'This cell must stay blank. Its row, its column and the edge letters leave no letter for it.'
        : `Only ${letter(v, m)} fits here. Its row, its column and the edge letters rule out the rest.` });
    }
    if (!out.length) {
      const k = [...entries.keys()].find((i) => !entries[i]);
      if (k !== undefined) out.push({ cells: [k], v: solution[k], reason: 'No simple step is left. Here is one cell.' });
    }
    return out;
  }

  function render(p, entries, opts = {}) {
    const { n, m, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const clueAt = (R, C) => {
      if (R === 0 && C >= 1 && C <= n) return clues[C - 1];
      if (R === n + 1 && C >= 1 && C <= n) return clues[n + C - 1];
      if (C === 0 && R >= 1 && R <= n) return clues[2 * n + R - 1];
      if (C === n + 1 && R >= 1 && R <= n) return clues[3 * n + R - 1];
      return 0;
    };
    const edge = (R, C) => R === 0 || C === 0 || R === n + 1 || C === n + 1;
    return PuzzleShell.gridBoard({
      rows: n + 2, cols: n + 2, cellPx: PuzzleShell.fitCell(n + 2, 46), className: 'pz-board abc-board', readonly,
      renderCell(K, el) {
        const R = Math.floor(K / (n + 2)), C = K % (n + 2);
        if (edge(R, C)) {
          el.className = 'clue';
          el.textContent = letter(clueAt(R, C), m);
          return;
        }
        const k = (R - 1) * n + (C - 1);
        const v = result ? solution[k] : entries[k];
        el.textContent = letter(v, m);
        if (v > m) el.classList.add('blank');
        if (result) el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        if (hintCells.has(k)) el.classList.add('hint');
      },
      onCell(K, ev) {
        const R = Math.floor(K / (n + 2)), C = K % (n + 2);
        if (edge(R, C)) return;
        const k = (R - 1) * n + (C - 1);
        const step = ev.button === 2 ? m + 1 : 1;
        entries[k] = (entries[k] + step) % (m + 2);
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'easy-as-abc',
    name: 'Easy as ABC',
    rules: 'Place the letters in the grid so each row and each column holds every letter exactly once. ' +
      'The other cells stay blank. A letter outside the grid is the first letter you meet from that side.',
    controls: 'Click a cell to cycle through the letters and a blank mark (×). Right click cycles back.',
    size: { min: 4, max: 6, def: 5, text: (n) => `${n} (A–${String.fromCodePoint(64 + (n <= 4 ? n - 1 : n - 2))})` },
    solvedText: 'Every letter in place — nicely done.',
    generate(n) {
      for (let t = 0; t < 50; t++) { const p = generate(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.n, m: p.m, c: p.clues.join('') }),
    decode(d) {
      const n = d?.n, m = d?.m;
      if (!Number.isInteger(n) || n < 3 || n > 9 || !Number.isInteger(m) || m < 1 || m > n) throw new Error('Invalid board size');
      if (typeof d.c !== 'string' || d.c.length !== 4 * n || !/^\d+$/.test(d.c)) throw new Error('Invalid clues');
      const p = { n, m, clues: Array.from(d.c, Number) };
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % (p.m + 2);
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
