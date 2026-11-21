// Roma. Put an arrow (up, down, left or right) in every empty cell. The
// arrows in a region are all different. Starting anywhere and following
// the arrows always ends at a black circle. Some arrows are given.
// Values: 1 up, 2 down, 3 left, 4 right; candidates are bitmasks (bit v).

(() => {
  const GLYPH = ['', '↑', '↓', '←', '→'];
  const STEP = [null, [-1, 0], [1, 0], [0, -1], [0, 1]];
  const ALL = 0b11110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function prepare(p) {
    const { R, C, region, circle } = p;
    p.groups = [];
    region.forEach((g, k) => { if (!circle[k]) (p.groups[g] = p.groups[g] || []).push(k); });
    p.groups = p.groups.filter(Boolean);
    return p;
  }

  const target = (p, k, v) => {
    const r = Math.floor(k / p.C) + STEP[v][0], c = (k % p.C) + STEP[v][1];
    return r >= 0 && c >= 0 && r < p.R && c < p.C ? r * p.C + c : -1;
  };

  function propagate(p, cand) {
    const N = p.R * p.C;
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < N; k++) {
        if (p.circle[k]) continue;
        for (let v = 1; v <= 4; v++) if ((cand[k] & (1 << v)) && target(p, k, v) < 0) cand[k] &= ~(1 << v);
        // Two cells may not point at each other.
        for (let v = 1; v <= 4; v++) {
          if (!(cand[k] & (1 << v))) continue;
          const t = target(p, k, v);
          if (!p.circle[t] && one(cand[t]) && target(p, t, low(cand[t])) === k) cand[k] &= ~(1 << v);
        }
        if (!cand[k]) return false;
      }
      for (const cells of p.groups) {
        for (const k of cells) if (one(cand[k])) for (const j of cells) if (j !== k) cand[j] &= ~cand[k];
        for (let v = 1; v <= 4; v++) {
          const where = cells.filter((k) => cand[k] & (1 << v));
          if (where.length === 1 && cells.length === 4) cand[where[0]] = 1 << v;
        }
        if (cells.some((k) => !cand[k])) return false;
      }
      // An arrow may only point at a cell that can still reach a circle.
      const good = Uint8Array.from(p.circle);
      for (let changed = true; changed;) {
        changed = false;
        for (let k = 0; k < N; k++) {
          if (good[k]) continue;
          for (let v = 1; v <= 4; v++) {
            if (!(cand[k] & (1 << v))) continue;
            const t = target(p, k, v);
            if (t >= 0 && good[t]) { good[k] = 1; changed = true; break; }
          }
        }
      }
      for (let k = 0; k < N; k++) {
        if (p.circle[k]) continue;
        for (let v = 1; v <= 4; v++) {
          if (!(cand[k] & (1 << v))) continue;
          const t = target(p, k, v);
          if (t < 0 || !good[t]) cand[k] &= ~(1 << v);
        }
        if (!cand[k]) return false;
      }
      // No loops among fixed arrows.
      for (let k = 0; k < N; k++) {
        if (p.circle[k] || !one(cand[k])) continue;
        let x = k;
        for (let step = 0; step <= N; step++) {
          if (p.circle[x]) break;
          if (!one(cand[x])) break;
          x = target(p, x, low(cand[x]));
          if (x === k) return false;
        }
      }
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      const k = cand.findIndex((m, i) => !p.circle[i] && !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, (m, i) => (p.circle[i] ? 0 : low(m)))); return; }
      for (let v = 1; v <= 4; v++) {
        if (!(cand[k] & (1 << v))) continue;
        const t = Int32Array.from(cand); t[k] = 1 << v; rec(t);
      }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => (p.circle[k] ? 0 : given[k] ? 1 << given[k] : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const circle = new Uint8Array(N);
      const count = Math.max(2, Math.round(N / 6));
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, count)) circle[k] = 1;
      // Random arrow forest: grow out from the circles.
      const arrow = new Int8Array(N);
      const done = Uint8Array.from(circle);
      let front = [...new Array(N).keys()].filter((k) => circle[k]);
      while (front.length) {
        const k = front[Math.floor(Math.random() * front.length)];
        const r = Math.floor(k / C), c = k % C;
        const opts = [[r - 1, c, 2], [r + 1, c, 1], [r, c - 1, 4], [r, c + 1, 3]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && !done[a * C + b]);
        if (!opts.length) { front = front.filter((x) => x !== k); continue; }
        const [a, b, v] = opts[Math.floor(Math.random() * opts.length)];
        arrow[a * C + b] = v;
        done[a * C + b] = 1;
        front.push(a * C + b);
      }
      // Regions of up to 4 cells with different arrows (circles alone).
      const region = new Int32Array(N).fill(-1);
      let id = 0;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (region[k] >= 0) continue;
        region[k] = id;
        if (!circle[k]) {
          const cells = [k], used = new Set([arrow[k]]);
          for (let t = 0; t < 40 && cells.length < 4; t++) {
            const opts = [];
            for (const x of cells) {
              const r = Math.floor(x / C), c = x % C;
              for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
                const j = a * C + b;
                if (a >= 0 && b >= 0 && a < R && b < C && region[j] < 0 && !circle[j] && !used.has(arrow[j])) opts.push(j);
              }
            }
            if (!opts.length) break;
            const j = opts[Math.floor(Math.random() * opts.length)];
            region[j] = id;
            cells.push(j);
            used.add(arrow[j]);
          }
        }
        id++;
      }
      const p = prepare({ R, C, region, circle });
      const given = new Int8Array(N);
      for (let guard = 0; guard < N; guard++) {
        const res = solve(p, startCand(p, given), 2, 5000);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, k) => v !== arrow[k]));
        const diff = [...new Array(N).keys()].filter((k) => !circle[k] && !given[k] && (!other || other[k] !== arrow[k]));
        if (!diff.length) break;
        const k = diff[Math.floor(Math.random() * diff.length)];
        given[k] = arrow[k];
      }
      const unique = () => { const r = solve(p, startCand(p, given), 2, 30000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!given[k]) continue;
        const keep = given[k];
        given[k] = 0;
        if (!unique()) given[k] = keep;
      }
      p.given = given;
      p.solution = arrow;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This arrow is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.circle[k] || val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${GLYPH[low(cand[k])]} fits here: its region needs different arrows, and arrows may not leave the grid or run in a loop.` }];
    }
    const k = [...val.keys()].find((i) => !p.circle[i] && !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This arrow is ${GLYPH[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { R, C, region, circle, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions rm-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, region, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        if (circle[k]) { el.classList.add('goal'); return; }
        const TURN = [0, 0, 4, 6, 2];
        if (given[k]) { el.classList.add('given'); el.append(PuzzleShell.arrowIcon(TURN[given[k]])); return; }
        const v = result ? solution[k] : entries[k];
        if (v) el.append(PuzzleShell.arrowIcon(TURN[v]));
        if (result) el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
      },
      onCell(k, ev) {
        if (circle[k] || given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'roma',
    name: 'Roma',
    rules: 'Put an arrow (up, down, left or right) in every empty cell. The arrows in one outlined region are all different. ' +
      'Starting from any cell and following the arrows, you always end at a black circle. Some arrows are given.',
    controls: 'Click a cell to cycle ↑, ↓, ←, →, empty. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'All roads lead to Rome — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), o: Array.from(p.circle).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      if (typeof d.o !== 'string' || d.o.length !== n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid grid');
      const p = prepare({ R: n, C: n, region: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)), circle: Uint8Array.from(d.o, Number) });
      p.given = Int8Array.from(d.v, Number);
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.R * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.R * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 5;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.circle[k] || (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
