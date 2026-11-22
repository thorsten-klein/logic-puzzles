// Hamusando (Ham Sandwich). Each row and each column holds exactly two
// squares ("toast") and the same number K of circles ("ham"); K is given.
// A number at the edge tells how many circles lie between the two squares
// of that row or column. Some figures may be given.
// Values: 1 empty, 2 circle, 3 square. Candidates are bitmasks (bit v).
// Player entries: 0 blank, 1 marked empty, 2 circle, 3 square.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  const between = (vals) => {
    const a = vals.indexOf(3), b = vals.lastIndexOf(3);
    return vals.slice(a + 1, b).filter((v) => v === 2).length;
  };

  function prepare(p) {
    const { n, k, top, left } = p;
    p.lines = [];
    for (let r = 0; r < n; r++) p.lines.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), clue: left[r] });
    for (let c = 0; c < n; c++) p.lines.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), clue: top[c] });
    for (const L of p.lines) {
      L.ok = (vals) => vals.filter((v) => v === 3).length === 2 && vals.filter((v) => v === 2).length === k &&
        (L.clue < 0 || between(vals) === L.clue);
      L.ok.partial = (vals, i) => {
        const part = vals.slice(0, i + 1);
        return part.filter((v) => v === 3).length <= 2 && part.filter((v) => v === 2).length <= k;
      };
    }
    return p;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
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
      if (i < 0) { out.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3].filter((v) => cand[i] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[i] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p) => Int32Array.from({ length: p.n * p.n }, (_, i) => (p.given?.[i] ? 1 << p.given[i] : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const k = 1 + Math.floor(Math.random() * Math.max(1, Math.min(3, n - 3)));
      const p = prepare({ n, k, top: new Int8Array(n).fill(-1), left: new Int8Array(n).fill(-1) });
      const fill = solve(p, startCand(p), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      p.left = Int8Array.from({ length: n }, (_, r) => between(Array.from({ length: n }, (_, c) => sol[r * n + c])));
      p.top = Int8Array.from({ length: n }, (_, c) => between(Array.from({ length: n }, (_, r) => sol[r * n + c])));
      prepare(p);
      p.given = new Int8Array(N);
      const solved = () => { const c = startCand(p); return propagate(p, c) && c.every(one); };
      // Give figures where logic gets stuck, until logic solves it.
      for (let guard = 0; guard < N && !solved(); guard++) {
        const c = startCand(p);
        propagate(p, c);
        const open = [...new Array(N).keys()].filter((i) => !one(c[i]) && sol[i] > 1);
        if (!open.length) break;
        const i = open[Math.floor(Math.random() * open.length)];
        p.given[i] = sol[i];
      }
      if (!solved()) continue;
      for (const [side, i] of PuzzleShell.shuffle([...new Array(n).keys()].flatMap((i) => [['left', i], ['top', i]]))) {
        const keep = p[side][i];
        p[side][i] = -1;
        prepare(p);
        if (!solved()) { p[side][i] = keep; prepare(p); }
      }
      for (const i of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!p.given[i]) continue;
        const keep = p.given[i];
        p.given[i] = 0;
        if (!solved()) p.given[i] = keep;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  const NAME = ['', 'empty', 'a circle', 'a square'];

  function hints(p, entries) {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e && !p.given[i] && e !== p.solution[i]) return [{ cells: [i], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This figure is wrong.' }];
    }
    const cand = Int32Array.from(entries, (e, i) => {
      if (p.given[i]) return 1 << p.given[i];
      if (e) return 1 << e;
      return ALL;
    });
    propagate(p, cand);
    for (let i = 0; i < cand.length; i++) {
      if (entries[i] || p.given[i] || !one(cand[i])) continue;
      return [{ cells: [i], v: low(cand[i]), reason: `This cell must be ${NAME[low(cand[i])]}: anything else breaks a row or column.` }];
    }
    const i = [...entries.keys()].find((x) => !entries[x] && !p.given[x]);
    return i === undefined ? [] : [{ cells: [i], v: p.solution[i], reason: `No simple step is left. This cell is ${NAME[p.solution[i]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const W = n + 1;
    return PuzzleShell.gridBoard({
      rows: W, cols: W, cellPx: PuzzleShell.fitCell(W, 44), className: 'pz-board hm-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0) {
          el.className = 'clue';
          let v;
          if (r < 0 && c >= 0) v = p.top[c];
          else if (c < 0 && r >= 0) v = p.left[r];
          else v = -1;
          if (v >= 0) el.textContent = v;
          return;
        }
        const i = r * n + c;
        if (hintCells.has(i)) el.classList.add('hint');
        if (p.given[i]) { el.classList.add('given'); el.append(PuzzleShell.figure(p.given[i] === 3 ? 1 : 2)); return; }
        const v = result ? solution[i] : entries[i];
        if (v === 2) el.append(PuzzleShell.figure(2));
        if (v === 3) el.append(PuzzleShell.figure(1));
        if (v === 1 && !result) el.classList.add('hm-empty');
        if (result && entries[i]) el.classList.add(entries[i] === solution[i] ? 'ok' : 'bad');
        else if (result) el.classList.add('miss'); // not entered yet
      },
      onCell(K, ev) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0) return;
        const i = r * n + c;
        if (p.given[i]) return;
        const order = [0, 3, 2, 1];
        entries[i] = order[(order.indexOf(entries[i]) + (ev.button === 2 ? 3 : 1)) % 4];
        onChange();
      },
    });
  }

  const enc = (a) => Array.from(a, (v) => (v < 0 ? '.' : v.toString(36))).join('');
  const dec = (s, n) => {
    if (typeof s !== 'string' || s.length !== n) throw new Error('Invalid clues');
    return Int8Array.from(s, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36)));
  };

  PuzzleShell.start({
    id: 'hamusando',
    name: 'Hamusando',
    rules: 'Every row and every column holds exactly two squares (toast) and the same number of circles (ham) — that ' +
      'number is shown above the grid. A number at the edge tells how many circles lie between the two squares of that ' +
      'row or column. Some figures are given.',
    controls: 'Click a cell to cycle square, circle, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'A tasty sandwich — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, k: p.k, t: enc(p.top), l: enc(p.left), g: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (!Number.isInteger(d.k) || d.k < 0 || d.k > n - 2) throw new Error('Invalid circle count');
      const p = prepare({ n, k: d.k, top: dec(d.t, n), left: dec(d.l, n) });
      p.given = typeof d.g === 'string' && d.g.length === n * n && /^[0-3]+$/.test(d.g) ? Int8Array.from(d.g, Number) : new Int8Array(n * n);
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 4;
      return s;
    },
    render(p, s, opts) {
      const wrap = document.createElement('div');
      wrap.className = 'hm-wrap';
      const head = document.createElement('p');
      head.className = 'hm-count';
      head.textContent = `Each row and column: 2 squares, ${p.k} circle${p.k === 1 ? '' : 's'}`;
      wrap.append(head, render(p, s, opts));
      return wrap;
    },
    check: (p, s) => s.every((v, i) => (p.given[i] || v || 1) === p.solution[i]),
    hints,
    applyHint(p, s, h) { for (const i of h.cells) if (!p.given[i]) s[i] = h.v; },
  });
})();
