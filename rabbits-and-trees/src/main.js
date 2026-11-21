// Rabbits and Trees. Put exactly one rabbit (white circle) and one tree
// (black circle) into every row and every column. A number tells how many
// rabbits it can see in its row and column; trees block the view.
// Numbered cells stay empty.
// Values: 1 empty, 2 rabbit, 3 tree. Candidates are bitmasks (bit v).
// Player entries: 0 blank, 1 marked empty, 2 rabbit, 3 tree.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  function prepare(p) {
    const { n } = p;
    p.lines = [];
    for (let r = 0; r < n; r++) p.lines.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) p.lines.push(Array.from({ length: n }, (_, r) => r * n + c));
    return p;
  }

  // Rabbits seen from position i of a line (0 or 1).
  const seen = (rab, tree, i) => {
    for (const d of [-1, 1]) {
      for (let x = i + d; x >= 0 && x < 1e9; x += d) {
        if (x === tree) break;
        if (x === rab) return 1;
        if ((d < 0 && x === 0) || (d > 0 && x > Math.max(rab, tree))) break;
      }
    }
    return 0;
  };

  // Layouts [rabbit, tree] of a line that fit the candidates.
  const layouts = (cells, cand) => {
    const out = [];
    for (let a = 0; a < cells.length; a++) {
      if (!(cand[cells[a]] & 4)) continue;
      for (let b = 0; b < cells.length; b++) {
        if (a === b || !(cand[cells[b]] & 8)) continue;
        if (cells.some((k, i) => i !== a && i !== b && !(cand[k] & 2))) continue;
        out.push([a, b]);
      }
    }
    return out;
  };

  function propagate(p, cand) {
    const { n, num } = p;
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      const opts = p.lines.map((cells) => layouts(cells, cand));
      if (opts.some((o) => !o.length)) return false;
      // Numbers link the row and column of their cell.
      for (let k = 0; k < n * n; k++) {
        if (num[k] < 0) continue;
        const r = Math.floor(k / n), c = k % n;
        const rowO = opts[r], colO = opts[n + c];
        const visR = new Set(rowO.map(([a, b]) => seen(a, b, c)));
        const visC = new Set(colO.map(([a, b]) => seen(a, b, r)));
        opts[r] = rowO.filter(([a, b]) => visC.has(num[k] - seen(a, b, c)));
        opts[n + c] = colO.filter(([a, b]) => visR.has(num[k] - seen(a, b, r)));
        if (!opts[r].length || !opts[n + c].length) return false;
      }
      p.lines.forEach((cells, li) => {
        const keep = new Int32Array(cells.length);
        for (const [a, b] of opts[li]) cells.forEach((_, i) => { keep[i] |= i === a ? 4 : i === b ? 8 : 2; });
        cells.forEach((k, i) => { cand[k] &= keep[i]; });
      });
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
      if (i < 0) { out.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3].filter((v) => cand[i] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[i] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p) => Int32Array.from({ length: p.n * p.n }, (_, k) => (p.num[k] >= 0 ? 2 : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const p = prepare({ n, num: new Int8Array(N).fill(-1) });
      const fill = solve(p, startCand(p), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      // Numbers on every empty cell, then thin while logic solves it.
      const count = (k) => {
        const r = Math.floor(k / n), c = k % n;
        const row = Array.from({ length: n }, (_, i) => sol[r * n + i]), col = Array.from({ length: n }, (_, i) => sol[i * n + c]);
        return seen(row.indexOf(2), row.indexOf(3), c) + seen(col.indexOf(2), col.indexOf(3), r);
      };
      for (let k = 0; k < N; k++) if (sol[k] === 1) p.num[k] = count(k);
      const solved = () => { const c = startCand(p); return propagate(p, c) && c.every(one); };
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (p.num[k] < 0) continue;
        const keep = p.num[k];
        p.num[k] = -1;
        if (!solved()) p.num[k] = keep;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  const NAME = ['', 'empty', 'a rabbit', 'a tree'];

  function hints(p, entries) {
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && p.num[k] < 0 && e !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This is wrong here.' }];
    }
    const cand = Int32Array.from(entries, (e, k) => (p.num[k] >= 0 ? 2 : e ? 1 << e : ALL));
    propagate(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || p.num[k] >= 0 || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `This cell must be ${NAME[low(cand[k])]}: anything else breaks a row, a column or a number.` }];
    }
    const k = [...entries.keys()].find((i) => !entries[i] && p.num[i] < 0);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${NAME[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, num, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board rt-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (num[k] >= 0) { el.classList.add('given', 'rt-num'); el.textContent = num[k]; return; }
        const v = result ? solution[k] : entries[k];
        if (v === 2 || v === 3) {
          const o = document.createElement('span');
          o.className = 'rt-fig ' + (v === 2 ? 'rabbit' : 'tree');
          el.append(o);
        }
        if (v === 1 && !result) el.classList.add('rt-empty');
        if (result && entries[k]) el.classList.add(entries[k] === solution[k] ? 'ok' : 'bad');
        else if (result && solution[k] > 1) el.classList.add('miss'); // not entered yet
      },
      onCell(k, ev) {
        if (num[k] >= 0) return;
        const order = [0, 2, 3, 1];
        entries[k] = order[(order.indexOf(entries[k]) + (ev.button === 2 ? 3 : 1)) % 4];
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'rabbits-and-trees',
    name: 'Rabbits and Trees',
    rules: 'Put exactly one rabbit (white circle) and one tree (black circle) into every row and every column. A number ' +
      'tells how many rabbits it can see in its row and column together; trees block the view. Numbered cells stay empty.',
    controls: 'Click a cell to cycle rabbit, tree, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'Every rabbit has its tree — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.num, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[.0-2]+$/.test(d.g)) throw new Error('Invalid numbers');
      const p = prepare({ n, num: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) });
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 4;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.num[k] >= 0 || (v || 1) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (p.num[k] < 0) s[k] = h.v; },
  });
})();
