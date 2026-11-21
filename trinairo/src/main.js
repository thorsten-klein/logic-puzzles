// Trinairo. Fill the 9x9 grid with A, B and C so every row and column
// holds three of each. A shaded cell differs from all its side
// neighbours. Values: 1 = A, 2 = B, 3 = C (0 = empty).

(() => {
  const N = 9;
  const L = ['', 'A', 'B', 'C'];

  function lines() {
    const out = [];
    for (let i = 0; i < N; i++) {
      out.push(Array.from({ length: N }, (_, j) => i * N + j));
      out.push(Array.from({ length: N }, (_, j) => j * N + i));
    }
    return out;
  }
  const LINES = lines();

  function nbs(k) {
    const r = Math.floor(k / N), c = k % N, out = [];
    if (r > 0) out.push(k - N);
    if (r < N - 1) out.push(k + N);
    if (c > 0) out.push(k - 1);
    if (c < N - 1) out.push(k + 1);
    return out;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      // Marked cells: a fixed neighbour value is ruled out (and back).
      for (let k = 0; k < N * N; k++) {
        if (!p.marked[k]) continue;
        for (const j of nbs(k)) {
          if (Latin.bitCount(cand[k]) === 1) cand[j] &= ~cand[k];
          if (Latin.bitCount(cand[j]) === 1) cand[k] &= ~cand[j];
        }
      }
      for (const cells of LINES) {
        const ok = (vals) => {
          const n = [0, 0, 0, 0];
          for (const v of vals) n[v]++;
          return n[1] === 3 && n[2] === 3 && n[3] === 3;
        };
        ok.partial = (vals, j) => {
          const n = [0, 0, 0, 0];
          for (let x = 0; x <= j; x++) if (++n[vals[x]] > 3) return false;
          return true;
        };
        if (!Latin.filterGroup(cells, cand, ok, false)) return false;
      }
      if (cand.some((x) => !x)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 5000, random = false) {
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
      const vals = Latin.values(cand[pick]);
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) {
        const copy = Int32Array.from(cand);
        copy[pick] = 1 << v;
        rec(copy);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  const startCand = (given) => Int32Array.from({ length: N * N }, (_, k) => (given?.[k] ? 1 << given[k] : 0b1110));

  function generate() {
    for (let t = 0; t < 20; t++) {
      const blank = { marked: new Uint8Array(N * N) };
      const res = solve(blank, startCand(), 1, 3000, true);
      if (!res.solutions.length) continue;
      const sol = res.solutions[0];
      // Mark some cells that differ from all their neighbours.
      const marked = new Uint8Array(N * N);
      for (let k = 0; k < N * N; k++) {
        if (nbs(k).every((j) => sol[j] !== sol[k]) && Math.random() < 0.5) marked[k] = 1;
      }
      const p = { marked, given: Int8Array.from(sol), solution: sol };
      const unique = () => {
        const cand = startCand(p.given);
        return propagate(p, cand) && cand.every((m) => Latin.bitCount(m) === 1);
      };
      for (const k of PuzzleShell.shuffle([...new Array(N * N).keys()])) {
        p.given[k] = 0;
        if (!unique()) p.given[k] = sol[k];
      }
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const out = [];
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < N * N; k++) {
      if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) out.push({ cells: [k], v: 0, reason: 'This letter is wrong.' });
    }
    if (out.length) return out;
    const cand = startCand(val);
    propagate(p, cand);
    for (let k = 0; k < N * N; k++) {
      if (val[k] || Latin.bitCount(cand[k]) !== 1) continue;
      const v = Latin.lowBit(cand[k]);
      out.push({ cells: [k], v, reason: `Only ${L[v]} fits here. Its row, its column and the shaded cells rule out the rest.` });
    }
    if (!out.length) {
      const k = [...val.keys()].find((i) => !val[i]);
      if (k !== undefined) out.push({ cells: [k], v: p.solution[k], reason: 'No simple step is left. Here is one cell.' });
    }
    return out;
  }

  function render(p, entries, opts = {}) {
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: N, cols: N, cellPx: PuzzleShell.fitCell(N, 42), className: 'pz-board tn-board', readonly,
      renderCell(k, el) {
        if (p.marked[k]) el.classList.add('marked-cell');
        if (hintCells.has(k)) el.classList.add('hint');
        if (p.given[k]) { el.classList.add('given'); el.textContent = L[p.given[k]]; return; }
        const v = result ? p.solution[k] : entries[k];
        el.textContent = L[v];
        if (result) el.classList.add(entries[k] === p.solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
      },
      onCell(k, ev) {
        if (p.given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 3 : 1)) % 4;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'trinairo',
    name: 'Trinairo',
    rules: 'Fill the 9×9 grid with the letters A, B and C. Every row and every column holds exactly three of each letter. ' +
      'A letter in a shaded cell differs from the letters in all cells next to it (up, down, left, right).',
    controls: 'Click a cell to cycle A, B, C, empty. Right click cycles back.',
    size: { min: 9, max: 9, def: 9 },
    solvedText: 'Three of a kind everywhere — nicely done.',
    generate,
    encode: (p) => ({ m: Array.from(p.marked).join(''), g: Array.from(p.given).join('') }),
    decode(d) {
      if (typeof d.m !== 'string' || d.m.length !== N * N || !/^[01]+$/.test(d.m)) throw new Error('Invalid marks');
      if (typeof d.g !== 'string' || d.g.length !== N * N || !/^[0-3]+$/.test(d.g)) throw new Error('Invalid givens');
      const p = { marked: Uint8Array.from(d.m, Number), given: Int8Array.from(d.g, Number) };
      const res = solve(p, startCand(p.given), 2, 20000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: () => new Int8Array(N * N),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(N * N);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 4;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
