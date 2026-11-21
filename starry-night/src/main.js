// Starry Night. Put one sun (white circle), one moon (black circle) and
// one star into every row and column. Equal figures never touch
// diagonally. A symbol at the edge compares distances in its line: a
// white circle means the sun is closer to the star than the moon, a
// black circle means the moon is closer, a star means equal distances.
// Values: 1 empty, 2 sun, 3 moon, 4 star. Candidates are bitmasks.
// Player entries: 0 blank, 1 marked empty, 2..4 figures.
// Clues: 0 none, 1 sun closer, 2 moon closer, 3 equal.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b11110;

  const relation = (vals) => {
    const s = vals.indexOf(2), m = vals.indexOf(3), t = vals.indexOf(4);
    const a = Math.abs(s - t), b = Math.abs(m - t);
    return a < b ? 1 : a > b ? 2 : 3;
  };

  function prepare(p) {
    const { n, rowClue, colClue } = p;
    p.lines = [];
    for (let r = 0; r < n; r++) p.lines.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), clue: rowClue[r] });
    for (let c = 0; c < n; c++) p.lines.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), clue: colClue[c] });
    for (const L of p.lines) {
      L.ok = (vals) => [2, 3, 4].every((f) => vals.filter((v) => v === f).length === 1) && (!L.clue || relation(vals) === L.clue);
      L.ok.partial = (vals, i) => [2, 3, 4].every((f) => vals.slice(0, i + 1).filter((v) => v === f).length <= 1);
    }
    p.diag = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n, out = [];
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) if (a >= 0 && b >= 0 && a < n && b < n) out.push(a * n + b);
      return out;
    });
    return p;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < cand.length; k++) if (one(cand[k]) && cand[k] !== 2) for (const j of p.diag[k]) cand[j] &= ~cand[k];
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
      const k = cand.findIndex((m) => !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3, 4].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.n * p.n }, (_, k) => (given?.[k] ? 1 << given[k] : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const p = prepare({ n, rowClue: new Int8Array(n), colClue: new Int8Array(n) });
      const fill = solve(p, startCand(p), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const row = (r) => Array.from({ length: n }, (_, c) => sol[r * n + c]);
      const col = (c) => Array.from({ length: n }, (_, r) => sol[r * n + c]);
      p.rowClue = Int8Array.from({ length: n }, (_, r) => relation(row(r)));
      p.colClue = Int8Array.from({ length: n }, (_, c) => relation(col(c)));
      // Figures given where clues alone are not enough, then thin both.
      p.given = new Int8Array(N);
      prepare(p);
      const solved = () => { const c = startCand(p, p.given); return propagate(p, c) && c.every(one); };
      for (let guard = 0; guard < N && !solved(); guard++) {
        const c = startCand(p, p.given);
        propagate(p, c);
        const open = [...new Array(N).keys()].filter((k) => !one(c[k]) && sol[k] > 1);
        if (!open.length) break;
        const k = open[Math.floor(Math.random() * open.length)];
        p.given[k] = sol[k];
      }
      if (!solved()) continue;
      for (const [arr, i] of PuzzleShell.shuffle([...new Array(n).keys()].flatMap((i) => [[p.rowClue, i], [p.colClue, i]]))) {
        const keep = arr[i];
        arr[i] = 0;
        prepare(p);
        if (!solved()) { arr[i] = keep; prepare(p); }
      }
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
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

  const NAME = ['', 'empty', 'a sun', 'a moon', 'a star'];

  function hints(p, entries) {
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && !p.given[k] && e !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This figure is wrong.' }];
    }
    const cand = startCand(p, Int8Array.from(entries, (e, k) => p.given[k] || e));
    propagate(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || p.given[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `This cell must be ${NAME[low(cand[k])]}: anything else breaks a line rule or a clue.` }];
    }
    const k = [...entries.keys()].find((i) => !entries[i] && !p.given[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${NAME[p.solution[k]]}.` }];
  }

  function figureEl(v) {
    const span = document.createElement('span');
    span.className = 'sn-fig sn-' + ['', '', 'sun', 'moon', 'star'][v];
    if (v === 4) span.textContent = '★';
    return span;
  }

  function render(p, entries, opts = {}) {
    const { n, solution, given } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const W = n + 1;
    return PuzzleShell.gridBoard({
      rows: W, cols: W, cellPx: PuzzleShell.fitCell(W, 44), className: 'pz-board sn-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0) {
          el.className = 'clue';
          const v = r < 0 && c >= 0 ? p.colClue[c] : c < 0 && r >= 0 ? p.rowClue[r] : 0;
          if (v) el.append(figureEl(v === 1 ? 2 : v === 2 ? 3 : 4));
          return;
        }
        const k = r * n + c;
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.append(figureEl(given[k])); return; }
        const v = result ? solution[k] : entries[k];
        if (v > 1) el.append(figureEl(v));
        if (v === 1 && !result) el.classList.add('sn-empty');
        if (result && entries[k]) el.classList.add(entries[k] === solution[k] ? 'ok' : 'bad');
        else if (result) el.classList.add('miss'); // not entered yet
      },
      onCell(K, ev) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0) return;
        const k = r * n + c;
        if (given[k]) return;
        const order = [0, 2, 3, 4, 1];
        const i = order.indexOf(entries[k]);
        entries[k] = order[(i + (ev.button === 2 ? 4 : 1)) % 5];
        onChange();
      },
    });
  }

  const enc = (a) => Array.from(a).join('');
  const dec = (s, n) => {
    if (typeof s !== 'string' || s.length !== n || !/^[0-4]+$/.test(s)) throw new Error('Invalid clues');
    return Int8Array.from(s, Number);
  };

  PuzzleShell.start({
    id: 'starry-night',
    name: 'Starry Night',
    rules: 'Put one sun (white circle), one moon (black circle) and one star into every row and every column. Equal ' +
      'figures never touch diagonally. A symbol at the edge compares distances in its row or column: a white circle means ' +
      'the sun is closer to the star than the moon is, a black circle means the moon is closer, a star means both are ' +
      'equally far away.',
    controls: 'Click a cell to cycle sun, moon, star, empty mark, blank. Right click cycles back.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'A clear starry night — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, r: enc(p.rowClue), c: enc(p.colClue), g: enc(p.given) }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const p = prepare({ n, rowClue: dec(d.r, n), colClue: dec(d.c, n) });
      p.given = dec(d.g, n * n);
      const res = solve(p, startCand(p, p.given), 2, 50000);
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
    check: (p, s) => s.every((v, k) => (p.given[k] || v || 1) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
