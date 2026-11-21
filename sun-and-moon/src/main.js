// Sun and Moon. Put exactly one star and one cloud (dark square) into
// every row and every column. Planets sit in some cells. A star shines
// along its row and column until a planet or cloud stops it. A lit half
// of a planet means a star shines on it from that side; a dark half means
// no star does. Values: 1 empty, 2 star, 3 cloud, 0 planet.
// Planets: p.lit[k] = -1 none, else bits 1 up, 2 right, 4 down, 8 left.
// Player entries: 0 blank, 1 marked empty, 2 star, 3 cloud.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  function prepare(p) {
    const { n, lit } = p;
    p.lines = [];
    // Rows: planets see left (8) and right (2); columns: up (1) and down (4).
    for (let r = 0; r < n; r++) p.lines.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), before: 8, after: 2 });
    for (let c = 0; c < n; c++) p.lines.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), before: 1, after: 4 });
    for (const L of p.lines) L.planets = L.cells.map((k, i) => (lit[k] >= 0 ? i : -1)).filter((i) => i >= 0);
    return p;
  }

  // Layouts [star, cloud] of a line that fit the candidates and planets.
  function layouts(p, L, cand) {
    const { cells, planets } = L;
    const out = [];
    for (let a = 0; a < cells.length; a++) {
      if (!(cand[cells[a]] & 4)) continue;
      for (let b = 0; b < cells.length; b++) {
        if (a === b || !(cand[cells[b]] & 8)) continue;
        if (cells.some((k, i) => i !== a && i !== b && p.lit[k] < 0 && !(cand[k] & 2))) continue;
        let ok = true;
        for (const i of planets) {
          const bits = p.lit[cells[i]];
          // The star lights this planet from one side if nothing blocks.
          const blocked = (from, to) => planets.some((j) => j > Math.min(from, to) && j < Math.max(from, to)) || (b > Math.min(from, to) && b < Math.max(from, to));
          const litBefore = a < i && !blocked(a, i), litAfter = a > i && !blocked(a, i);
          if (litBefore !== !!(bits & L.before) || litAfter !== !!(bits & L.after)) { ok = false; break; }
        }
        if (ok) out.push([a, b]);
      }
    }
    return out;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (const L of p.lines) {
        const opts = layouts(p, L, cand);
        if (!opts.length) return false;
        const keep = new Int32Array(L.cells.length);
        for (const [a, b] of opts) L.cells.forEach((_, i) => { keep[i] |= i === a ? 4 : i === b ? 8 : 2; });
        L.cells.forEach((k, i) => { if (p.lit[k] < 0) cand[k] &= keep[i]; });
      }
      if (cand.some((m, k) => p.lit[k] < 0 && !m)) return false;
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
      const i = cand.findIndex((m, k) => p.lit[k] < 0 && !one(m));
      if (i < 0) { out.push(Int8Array.from(cand, (m, k) => (p.lit[k] >= 0 ? 0 : low(m)))); return; }
      const vals = [1, 2, 3].filter((v) => cand[i] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[i] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p) => Int32Array.from({ length: p.n * p.n }, (_, k) => (p.lit[k] >= 0 ? 0 : ALL));

  // Light bits for every planet, from a full answer.
  function lightOf(n, lit, sol) {
    const out = Int8Array.from(lit);
    for (let k = 0; k < n * n; k++) {
      if (lit[k] < 0) continue;
      const r = Math.floor(k / n), c = k % n;
      let bits = 0;
      [[-1, 0, 1], [0, 1, 2], [1, 0, 4], [0, -1, 8]].forEach(([dr, dc, bit]) => {
        for (let a = r + dr, b = c + dc; a >= 0 && b >= 0 && a < n && b < n; a += dr, b += dc) {
          const j = a * n + b;
          if (lit[j] >= 0 || sol[j] === 3) break;
          if (sol[j] === 2) { bits |= bit; break; }
        }
      });
      out[k] = bits;
    }
    return out;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const lit = new Int8Array(N).fill(-1);
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N * 0.18))) lit[k] = 0;
      const free = prepare({ n, lit: Int8Array.from(lit, (v) => (v >= 0 ? 15 : -1)) });
      // Fill ignoring light, then set the light bits from the answer.
      free.lines.forEach((L) => { L.planets = []; });
      const fill = solve(free, startCand(free), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const p = prepare({ n, lit: lightOf(n, lit, sol) });
      const solved = () => { const c = startCand(p); return propagate(p, c) && c.every((m, k) => p.lit[k] >= 0 || one(m)); };
      if (!solved()) continue;
      // Drop planets while logic still solves it.
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (p.lit[k] < 0) continue;
        const keep = Int8Array.from(p.lit);
        const test = Int8Array.from(p.lit, (v) => v);
        test[k] = -1;
        // Without the planet the cell is empty in the answer.
        const sol2 = Int8Array.from(sol, (v, j) => (j === k ? 1 : v));
        if ([...new Array(n).keys()].some((r) => ![...new Array(n).keys()].some((c) => sol2[r * n + c] === 2))) continue;
        p.lit = lightOf(n, test, sol2);
        prepare(p);
        if (solved()) sol.set(sol2); else { p.lit = keep; prepare(p); }
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  const NAME = ['', 'empty', 'a star', 'a cloud'];

  function hints(p, entries) {
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && p.lit[k] < 0 && e !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This is wrong here.' }];
    }
    const cand = Int32Array.from(entries, (e, k) => (p.lit[k] >= 0 ? 0 : e ? 1 << e : ALL));
    propagate(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || p.lit[k] >= 0 || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `This cell must be ${NAME[low(cand[k])]}: anything else breaks a row, a column or a planet's light.` }];
    }
    const k = [...entries.keys()].find((i) => !entries[i] && p.lit[i] < 0);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${NAME[p.solution[k]]}.` }];
  }

  // A planet: a circle with its lit halves in yellow.
  function planet(bits) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-12 -12 24 24');
    svg.setAttribute('class', 'sm-planet');
    const half = { 1: 'M-10 0A10 10 0 0 1 10 0Z', 2: 'M0 -10A10 10 0 0 1 0 10Z', 4: 'M10 0A10 10 0 0 1 -10 0Z', 8: 'M0 10A10 10 0 0 1 0 -10Z' };
    const base = document.createElementNS(NS, 'circle');
    base.setAttribute('r', 10); base.setAttribute('class', 'sm-dark');
    svg.append(base);
    for (const b of [1, 2, 4, 8]) {
      if (!(bits & b)) continue;
      const h = document.createElementNS(NS, 'path');
      h.setAttribute('d', half[b]); h.setAttribute('class', 'sm-lit');
      svg.append(h);
    }
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', 10); ring.setAttribute('class', 'sm-ring');
    svg.append(ring);
    return svg;
  }

  function render(p, entries, opts = {}) {
    const { n, lit, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board sm-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (lit[k] >= 0) { el.classList.add('given'); el.append(planet(lit[k])); return; }
        const v = result ? solution[k] : entries[k];
        if (v === 2) { const s = document.createElement('span'); s.className = 'sm-star'; s.textContent = '★'; el.append(s); }
        if (v === 3) el.classList.add('sm-cloud');
        if (v === 1 && !result) el.classList.add('sm-empty');
        if (result && entries[k]) el.classList.add(entries[k] === solution[k] ? 'ok' : 'bad');
        else if (result && solution[k]) el.classList.add('miss'); // not entered yet
      },
      onCell(k, ev) {
        if (lit[k] >= 0) return;
        const order = [0, 2, 3, 1];
        entries[k] = order[(order.indexOf(entries[k]) + (ev.button === 2 ? 3 : 1)) % 4];
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'sun-and-moon',
    name: 'Sun and Moon',
    rules: 'Put exactly one star and one cloud (dark square) into every row and every column. A star shines along its ' +
      'row and column until a planet or a cloud stops the light. A yellow half of a planet means a star shines on it from ' +
      'that side; a dark half means no star does.',
    controls: 'Click a cell to cycle star, cloud, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'The sky is in order — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.lit, (v) => (v < 0 ? '.' : v.toString(16))).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[.0-9a-f]+$/.test(d.g)) throw new Error('Invalid planets');
      const p = prepare({ n, lit: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 16))) });
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
    check: (p, s) => s.every((v, k) => p.lit[k] >= 0 || (v || 1) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (p.lit[k] < 0) s[k] = h.v; },
  });
})();
