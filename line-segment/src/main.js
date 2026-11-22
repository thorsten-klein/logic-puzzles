// Line Segment. Cover every cell with straight segments of 3 or 4 cells:
// horizontal, vertical or diagonal. Each cell belongs to exactly one
// segment. A letter shows the direction of its cell's segment: H
// (horizontal), V (vertical) or D (diagonal).
// Directions: 1 H, 2 V, 3 diagonal down-right (\), 4 diagonal down-left (/).

(() => {
  const STEP = [null, [0, 1], [1, 0], [1, 1], [1, -1]];
  const LETTER = ['', 'H', 'V', 'D', 'D'];

  // All covers (direction per cell), up to stopAt, with distinct direction maps.
  function solve(p, stopAt = 2, maxNodes = 200000) {
    const { n, clue } = p;
    const N = n * n;
    const dir = new Int8Array(N);
    const out = [];
    const seen = new Set();
    let nodes = 0;
    (function rec(k) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      while (k < N && dir[k]) k++;
      if (k === N) {
        const key = dir.join('');
        if (!seen.has(key)) { seen.add(key); out.push(Int8Array.from(dir)); }
        return;
      }
      const r = Math.floor(k / n), c = k % n;
      for (let d = 1; d <= 4; d++) for (const len of [3, 4]) {
        const cells = [];
        for (let i = 0; i < len; i++) {
          const a = r + STEP[d][0] * i, b = c + STEP[d][1] * i;
          if (a < 0 || b < 0 || a >= n || b >= n || dir[a * n + b]) { cells.length = 0; break; }
          cells.push(a * n + b);
        }
        if (cells.length !== len) continue;
        const want = (x) => !clue[x] || clue[x] === d || (clue[x] === 3 && d === 4);
        if (!cells.every(want)) continue;
        cells.forEach((x) => { dir[x] = d; });
        rec(k + 1);
        cells.forEach((x) => { dir[x] = 0; });
      }
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      // Random cover.
      const dir = new Int8Array(N);
      let ok = true;
      const rec = (k) => {
        while (k < N && dir[k]) k++;
        if (k === N) return true;
        const r = Math.floor(k / n), c = k % n;
        const opts = [];
        for (let d = 1; d <= 4; d++) for (const len of [3, 4]) {
          const cells = [];
          for (let i = 0; i < len; i++) {
            const a = r + STEP[d][0] * i, b = c + STEP[d][1] * i;
            if (a < 0 || b < 0 || a >= n || b >= n || dir[a * n + b]) { cells.length = 0; break; }
            cells.push(a * n + b);
          }
          if (cells.length === len) opts.push([d, cells]);
        }
        for (const [d, cells] of PuzzleShell.shuffle(opts)) {
          cells.forEach((x) => { dir[x] = d; });
          if (rec(k + 1)) return true;
          cells.forEach((x) => { dir[x] = 0; });
          if (Date.now() > deadline) return false;
        }
        return false;
      };
      if (!rec(0)) { ok = false; }
      if (!ok) continue;
      const clue = Int8Array.from(dir, (d) => (d === 4 ? 3 : d));
      const p = { n, clue };
      const unique = () => { const r = solve(p, 2); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        const keep = clue[k];
        clue[k] = 0;
        if (!unique()) clue[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = solve(p, 1).solutions[0];
      return p;
    }
    return null;
  }

  function hints(p, state) {
    for (let k = 0; k < state.length; k++) if (state[k] && state[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This direction is wrong.' }];
    const k = [...state.keys()].find((i) => !state[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: 'No simple step is left. This cell belongs to a segment in this direction.' }];
  }

  function render(p, state, opts = {}) {
    const { n, clue, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board ls2-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        const d = result ? solution[k] : state[k];
        if (d) {
          const bar = document.createElement('span');
          bar.className = 'ls2-bar ls2-d' + d;
          el.append(bar);
        }
        if (clue[k]) { const t = document.createElement('span'); t.className = 'ls2-letter'; t.textContent = LETTER[clue[k]]; el.append(t); }
        if (result && state[k]) el.classList.add(state[k] === solution[k] ? 'ok' : 'bad');
        else if (result) el.classList.add('miss'); // not entered yet
      },
      onCell(k, ev) {
        state[k] = (state[k] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'line-segment',
    name: 'Line Segment',
    rules: 'Cover every cell with straight segments of 3 or 4 cells — horizontal, vertical or diagonal. Each cell belongs ' +
      'to exactly one segment. A letter shows the direction of its cell\'s segment: H horizontal, V vertical, D diagonal.',
    controls: String.raw`Click a cell to cycle its direction: —, |, \, /, none. Right click cycles back.`,
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'All lined up — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.clue).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[0-3]+$/.test(d.g)) throw new Error('Invalid letters');
      const p = { n, clue: Int8Array.from(d.g, Number) };
      const res = solve(p, 2, 400000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 5;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
