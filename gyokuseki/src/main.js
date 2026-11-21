// Gyokuseki. Put circles into the grid: each row and each column holds
// exactly one black circle ("gem") and any number of white circles
// ("stones"). A number at the edge counts the circles seen from there,
// up to and including the black circle.
// Values: 1 empty, 2 white, 3 black. Candidates are bitmasks (bit v).
// Player entries: 0 blank, 1 marked empty, 2 white, 3 black.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  // Circles seen from the start of a line up to the black one.
  // (Every full line holds exactly one black stone.)
  const seen = (vals) => vals.slice(0, vals.indexOf(3) + 1).filter((v) => v > 1).length;

  // Lines: { cells, a, b } with clues a (from the start) and b (from the end).
  function lines(p) {
    const { n, top, bottom, left, right } = p;
    const out = [];
    for (let r = 0; r < n; r++) out.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), a: left[r], b: right[r] });
    for (let c = 0; c < n; c++) out.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), a: top[c], b: bottom[c] });
    return out;
  }

  function lineOk(L) {
    const ok = (vals) => {
      if (vals.filter((v) => v === 3).length !== 1) return false;
      if (L.a >= 0 && seen(vals) !== L.a) return false;
      if (L.b >= 0 && seen(vals.slice().reverse()) !== L.b) return false;
      return true;
    };
    ok.partial = (vals, i) => vals.slice(0, i + 1).filter((v) => v === 3).length <= 1;
    return ok;
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

  function solve(p, stopAt = 2, maxNodes = 20000, random = false) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      const k = cand.findIndex((m) => !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(new Int32Array(p.n * p.n).fill(ALL));
    return { solutions: out, capped: nodes > maxNodes };
  }

  function prepare(p) {
    p.lines = lines(p);
    for (const L of p.lines) L.ok = lineOk(L);
    return p;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      // Black circles: a random permutation. White circles at random.
      const perm = PuzzleShell.shuffle([...new Array(n).keys()]);
      const sol = Int8Array.from({ length: N }, () => (Math.random() < 0.45 ? 2 : 1));
      perm.forEach((c, r) => { sol[r * n + c] = 3; });
      const row = (r) => Array.from({ length: n }, (_, c) => sol[r * n + c]);
      const col = (c) => Array.from({ length: n }, (_, r) => sol[r * n + c]);
      const p = { n,
        left: Int8Array.from({ length: n }, (_, r) => seen(row(r))), right: Int8Array.from({ length: n }, (_, r) => seen(row(r).reverse())),
        top: Int8Array.from({ length: n }, (_, c) => seen(col(c))), bottom: Int8Array.from({ length: n }, (_, c) => seen(col(c).reverse())) };
      prepare(p);
      const solved = () => { const c = new Int32Array(N).fill(ALL); return propagate(p, c) && c.every(one); };
      if (!solved()) continue;
      const slots = [];
      for (const side of ['left', 'right', 'top', 'bottom']) for (let i = 0; i < n; i++) slots.push([side, i]);
      for (const [side, i] of PuzzleShell.shuffle(slots)) {
        const keep = p[side][i];
        p[side][i] = -1;
        prepare(p);
        if (!solved()) { p[side][i] = keep; prepare(p); }
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && e !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This circle is wrong.' }];
    }
    const cand = Int32Array.from(entries, (e) => (e ? 1 << e : ALL));
    propagate(p, cand);
    const name = ['', 'empty', 'a white circle', 'a black circle'];
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `This cell must be ${name[low(cand[k])]}: anything else breaks a row or column clue.` }];
    }
    const k = entries.findIndex((e) => !e);
    return k < 0 ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${name[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const W = n + 2;
    return PuzzleShell.gridBoard({
      rows: W, cols: W, cellPx: PuzzleShell.fitCell(W, 42), className: 'pz-board gy-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0 || r >= n || c >= n) {
          el.className = 'clue';
          let v = -1;
          if (r < 0 && c >= 0 && c < n) v = p.top[c];
          else if (r >= n && c >= 0 && c < n) v = p.bottom[c];
          else if (c < 0 && r >= 0 && r < n) v = p.left[r];
          else if (c >= n && r >= 0 && r < n) v = p.right[r];
          if (v >= 0) el.textContent = v;
          return;
        }
        const k = r * n + c;
        if (hintCells.has(k)) el.classList.add('hint');
        const v = result ? solution[k] : entries[k];
        if (v === 2) el.classList.add('gy-white');
        if (v === 3) el.classList.add('gy-black');
        if (v === 1 && !result) el.classList.add('gy-empty');
        if (result && entries[k]) el.classList.add(entries[k] === solution[k] ? 'ok' : 'bad');
        else if (result && solution[k] > 1) el.classList.add('miss'); // not entered yet
      },
      onCell(K, ev) {
        const r = Math.floor(K / W) - 1, c = (K % W) - 1;
        if (r < 0 || c < 0 || r >= n || c >= n) return;
        const k = r * n + c;
        const order = [0, 2, 3, 1];
        const i = order.indexOf(entries[k]);
        entries[k] = order[(i + (ev.button === 2 ? 3 : 1)) % 4];
        onChange();
      },
    });
  }

  const side = (s, n) => {
    if (typeof s !== 'string' || s.length !== n) throw new Error('Invalid clues');
    return Int8Array.from(s, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36)));
  };
  const enc = (a) => Array.from(a, (v) => (v < 0 ? '.' : v.toString(36))).join('');

  PuzzleShell.start({
    id: 'gyokuseki',
    name: 'Gyokuseki',
    rules: 'Put circles into the grid. Each row and each column holds exactly one black circle and any number of white ' +
      'circles. A number at the edge tells how many circles you see from there, up to and including the black circle.',
    controls: 'Click a cell to cycle white circle, black circle, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Gems among the stones — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, t: enc(p.top), b: enc(p.bottom), l: enc(p.left), r: enc(p.right) }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const p = prepare({ n, top: side(d.t, n), bottom: side(d.b, n), left: side(d.l, n), right: side(d.r, n) });
      const res = solve(p, 2, 50000);
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
    check: (p, s) => s.every((v, k) => (v || 1) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
