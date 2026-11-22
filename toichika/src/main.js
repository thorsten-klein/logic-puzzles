// Toichika. Put exactly one arrow in each region. Arrows come in pairs
// that point at each other along a row or column, with no other arrow
// between them. Paired arrows sit in regions that do not touch by a side.
// Some arrows are given.
// A pair option: cells a (pointing toward b) and b (pointing toward a).

(() => {
  const GLYPH = { u: '↑', d: '↓', l: '←', r: '→' };

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { out[g] ??= []; out[g].push(k); });
    return out;
  }

  function prepare(p) {
    const { R, C, region } = p;
    const list = groups(region);
    const touch = list.map(() => new Set());
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      if (c < C - 1 && region[k] !== region[k + 1]) { touch[region[k]].add(region[k + 1]); touch[region[k + 1]].add(region[k]); }
      if (r < R - 1 && region[k] !== region[k + C]) { touch[region[k]].add(region[k + C]); touch[region[k + C]].add(region[k]); }
    }
    p.opts = [];
    for (let a = 0; a < R * C; a++) {
      const r = Math.floor(a / C), c = a % C;
      for (const [dr, dc, da, db] of [[0, 1, 'r', 'l'], [1, 0, 'd', 'u']]) {
        const between = [];
        for (let t = 1; ; t++) {
          const nr = r + dr * t, nc = c + dc * t;
          if (nr >= R || nc >= C) break;
          const b = nr * C + nc;
          const ra = region[a], rb = region[b];
          if (ra !== rb && !touch[ra].has(rb)) p.opts.push({ a, b, da, db, ra, rb, between: between.slice() });
          between.push(b);
        }
      }
    }
    p.byRegion = list.map(() => []);
    p.opts.forEach((o, i) => { p.byRegion[o.ra].push(i); p.byRegion[o.rb].push(i); });
    p.list = list;
    return p;
  }

  // Two options clash if they share a region or one's arrow sits between the other's.
  const clash = (x, y) => x.ra === y.ra || x.ra === y.rb || x.rb === y.ra || x.rb === y.rb ||
    x.between.includes(y.a) || x.between.includes(y.b) || y.between.includes(x.a) || y.between.includes(x.b);

  function settle(p, st, log) {
    for (let changed = true; changed;) {
      changed = false;
      for (let g = 0; g < p.list.length; g++) {
        const used = p.byRegion[g].filter((i) => st[i] === 1), open = p.byRegion[g].filter((i) => st[i] === 0);
        if (used.length > 1 || (!used.length && !open.length)) return false;
        if (!used.length && open.length === 1) {
          st[open[0]] = 1;
          changed = true;
          if (log) { log.push({ opts: open, reason: 'This region can only get its arrow from this pair.' }); return true; }
        }
      }
      for (let i = 0; i < st.length; i++) {
        if (st[i] !== 1) continue;
        for (let j = 0; j < st.length; j++) {
          if (j === i || st[j] === 2 || !clash(p.opts[i], p.opts[j])) continue;
          if (st[j] === 1) return false;
          st[j] = 2;
          changed = true;
        }
      }
    }
    return true;
  }

  // Givens fix an arrow (cell + direction): options must match them.
  function startState(p) {
    const st = new Uint8Array(p.opts.length);
    p.opts.forEach((o, i) => {
      for (const [k, d] of [[o.a, o.da], [o.b, o.db]]) {
        const g = p.region[k];
        const fixed = p.given.find((x) => p.region[x.k] === g);
        if (fixed && (fixed.k !== k || fixed.d !== d)) st[i] = 2;
      }
    });
    return st;
  }

  function solve(p, stopAt = 2, random = false) {
    const out = [];
    let nodes = 0;
    (function rec(st) {
      if (out.length >= stopAt || ++nodes > 30000) return;
      if (!settle(p, st)) return;
      // Branch on the region with the fewest open options.
      let best = -1, bestN = 1e9;
      for (let g = 0; g < p.list.length; g++) {
        if (p.byRegion[g].some((i) => st[i] === 1)) continue;
        const n = p.byRegion[g].filter((i) => st[i] === 0).length;
        if (n < bestN) { bestN = n; best = g; }
      }
      if (best < 0) { out.push(Uint8Array.from(st, (v) => (v === 1 ? 1 : 0))); return; }
      let opts = p.byRegion[best].filter((i) => st[i] === 0);
      if (random) opts = PuzzleShell.shuffle(opts);
      for (const i of opts) { const t = Uint8Array.from(st); t[i] = 1; rec(t); }
    })(startState(p));
    return { solutions: out, capped: nodes > 30000 };
  }

  const arrowsOf = (p, sol) => {
    const out = new Map();
    sol.forEach((v, i) => { if (v) { const o = p.opts[i]; out.set(o.a, o.da); out.set(o.b, o.db); } });
    return out;
  };

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, 2 * Math.round(N / 10));
      const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const p = prepare({ R, C, region, given: [] });
      const fill = solve(p, 1, true);
      if (!fill.solutions.length) continue;
      const truth = arrowsOf(p, fill.solutions[0]);
      // Give arrows where another answer differs, until unique.
      // At most one round per entry.
      const rounds = p.list.length;
      for (let guard = 0; guard < rounds; guard++) {
        const res = solve(p, 2);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.map((x) => arrowsOf(p, x)).find((m) => [...truth].some(([k, d]) => m.get(k) !== d));
        const cand = [...truth].filter(([k, d]) => !p.given.some((x) => x.k === k) && (!other || other.get(k) !== d));
        if (!cand.length) break;
        const [k, d] = cand[Math.floor(Math.random() * cand.length)];
        p.given.push({ k, d });
      }
      const res = solve(p, 2);
      if (res.solutions.length !== 1 || res.capped) continue;
      for (const g of PuzzleShell.shuffle(p.given.slice())) {
        p.given = p.given.filter((x) => x !== g);
        const r2 = solve(p, 2);
        if (r2.solutions.length !== 1 || r2.capped) p.given.push(g);
      }
      p.solution = solve(p, 1).solutions[0];
      return p;
    }
    return null;
  }

  function render(p, state, opts = {}) {
    const { R, C, region, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const truth = arrowsOf(p, solution);
    const mine = new Map(Object.entries(state).map(([k, d]) => [Number(k), d]));
    const given = new Map(p.given.map((x) => [x.k, x.d]));
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions tc-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, region, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        const TURN = { u: 0, r: 2, d: 4, l: 6 };
        if (given.has(k)) { el.classList.add('given'); el.append(PuzzleShell.arrowIcon(TURN[given.get(k)])); return; }
        const d = result ? truth.get(k) : mine.get(k);
        if (d) el.append(PuzzleShell.arrowIcon(TURN[d]));
        if (result && mine.has(k)) el.classList.add(mine.get(k) === truth.get(k) ? 'ok' : 'bad');
        if (result && !mine.has(k) && truth.has(k)) el.classList.add('show');
      },
      onCell(k, ev) {
        if (given.has(k)) return;
        const order = ['', 'u', 'r', 'd', 'l'];
        const i = order.indexOf(state[k] || '');
        const next = order[(i + (ev.button === 2 ? 4 : 1)) % 5];
        if (next) state[k] = next; else delete state[k];
        onChange();
      },
    });
  }

  function hints(p, state) {
    const truth = arrowsOf(p, p.solution);
    for (const [k, d] of Object.entries(state)) if (truth.get(Number(k)) !== d) return [{ cells: [Number(k)], set: [[Number(k), '']], reason: 'This arrow is wrong.' }];
    const given = new Map(p.given.map((x) => [x.k, x.d]));
    const st = startState(p);
    p.opts.forEach((o, i) => {
      const ok = (k, d) => (state[k] || given.get(k)) === d;
      if (ok(o.a, o.da) && ok(o.b, o.db)) st[i] = 1;
    });
    for (let guard = 0; guard < 100; guard++) {
      const log = [];
      if (!settle(p, st, log) || !log.length) break;
      const o = p.opts[log[0].opts[0]];
      if (!state[o.a] && !given.has(o.a) || !state[o.b] && !given.has(o.b)) {
        return [{ cells: [o.a, o.b], set: [[o.a, o.da], [o.b, o.db]], reason: log[0].reason }];
      }
    }
    const k = [...truth.keys()].find((x) => !state[x] && !given.has(x));
    return k === undefined ? [] : [{ cells: [k], set: [[k, truth.get(k)]], reason: 'No simple step is left. Here is one arrow.' }];
  }

  PuzzleShell.start({
    id: 'toichika',
    name: 'Toichika',
    rules: 'Put exactly one arrow in each region. Arrows come in pairs that point at each other along a row or column, ' +
      'with no other arrow between them. Two paired arrows are in regions that do not touch by a side.',
    controls: 'Click a cell to cycle ↑, →, ↓, ←, empty. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every arrow found its partner — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), v: p.given.map((x) => x.k + x.d).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      const given = String(d.v || '').split(',').filter(Boolean).map((t) => ({ k: Number.parseInt(t, 10), d: t.slice(-1) }));
      if (given.some((x) => !(x.k >= 0 && x.k < n * n) || !GLYPH[x.d])) throw new Error('Invalid arrows');
      const p = prepare({ R: n, C: n, region: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)), given });
      const res = solve(p, 2);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: () => ({}),
    saveState: (s) => s,
    loadState: (p, v) => (v && typeof v === 'object' ? { ...v } : {}),
    render,
    check(p, s) {
      const truth = arrowsOf(p, p.solution);
      const given = new Set(p.given.map((x) => x.k));
      const mine = Object.keys(s).map(Number);
      return mine.every((k) => truth.get(k) === s[k]) && [...truth.keys()].every((k) => given.has(k) || s[k] === truth.get(k));
    },
    hints,
    applyHint(p, s, h) { for (const [k, d] of h.set) { if (d) s[k] = d; else delete s[k]; } },
  });
})();
