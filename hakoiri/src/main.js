// Hakoiri. Put one square, one circle and one triangle into each room.
// Equal figures never touch, not even at a corner. All figures connect
// by their sides. Some figures are given.
// Values: 0 empty, 1 square, 2 circle, 3 triangle. Candidates are
// bitmasks (bit v). Player entries: 4 = marked empty.

(() => {
  const SHAPES = ['', '■', '⬤', '▲'];
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function prepare(p) {
    const { R, C, room } = p;
    p.rooms = [];
    room.forEach((g, k) => { (p.rooms[g] = p.rooms[g] || []).push(k); });
    p.near = Array.from({ length: R * C }, (_, k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if ((dr || dc) && a >= 0 && b >= 0 && a < R && b < C) out.push(a * C + b);
      }
      return out;
    });
    return p;
  }

  // All figure cells can still join through cells that may hold figures.
  function linked(p, cand) {
    const { R, C } = p, N = R * C;
    const sure = (k) => !(cand[k] & 1);
    const maybe = (k) => cand[k] & 0b1110;
    const start = [...new Array(N).keys()].find(sure);
    if (start === undefined) return true;
    const seen = new Uint8Array(N);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop(), r = Math.floor(k / C), c = k % C;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const j = a * C + b;
        if (a >= 0 && b >= 0 && a < R && b < C && !seen[j] && maybe(j)) { seen[j] = 1; stack.push(j); }
      }
    }
    return [...new Array(N).keys()].every((k) => !sure(k) || seen[k]);
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < cand.length; k++) {
        if (!one(cand[k]) || cand[k] === 1) continue;
        for (const j of p.near[k]) cand[j] &= ~cand[k];
      }
      for (const cells of p.rooms) {
        for (let v = 1; v <= 3; v++) {
          const bit = 1 << v;
          const fixed = cells.filter((k) => cand[k] === bit);
          if (fixed.length > 1) return false;
          if (fixed.length === 1) for (const k of cells) if (k !== fixed[0]) cand[k] &= ~bit;
          const where = cells.filter((k) => cand[k] & bit);
          if (!where.length) return false;
          if (where.length === 1) cand[where[0]] = bit;
        }
        // Cells that can hold no figure left are empty.
      }
      if (cand.some((m) => !m)) return false;
      if (!linked(p, cand)) return false;
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
      if (k < 0) {
        const sol = Int8Array.from(cand, low);
        // Final check: figures connect (all decided now).
        if (linked(p, cand)) out.push(sol);
        return;
      }
      const vals = [0, 1, 2, 3].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => (given[k] ? 1 << given[k] : 0b1111));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 6));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const p = prepare({ R, C, room });
      if (p.rooms.some((cells) => !cells || cells.length < 3)) continue;
      const fill = solve(p, startCand(p, new Int8Array(N)), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      // Givens: start from all figures, drop while logic still solves it.
      const given = Int8Array.from(sol);
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every(one); };
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!given[k]) continue;
        const v = given[k];
        given[k] = 0;
        if (!solved()) given[k] = v;
      }
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || (v === 4 ? 0 : v));
    for (let k = 0; k < val.length; k++) {
      const e = entries[k];
      if (!e || p.given[k]) continue;
      if ((e === 4 ? 0 : e) !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 4 ? 'This cell is not empty.' : 'This figure is wrong.' }];
    }
    const cand = Int32Array.from(startCand(p, Int8Array.from(val)), (m, k) => (entries[k] === 4 ? 1 : m));
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.given[k] || entries[k] || !one(cand[k])) continue;
      const v = low(cand[k]);
      return [{ cells: [k], v: v || 4, reason: v ? `Only ${SHAPES[v]} fits here: each room needs one of each, and equal figures may not touch.` : 'No figure fits here any more. This cell stays empty.' }];
    }
    const k = [...val.keys()].find((i) => !p.given[i] && !entries[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k] || 4, reason: p.solution[k] ? `No simple step is left. This cell holds ${SHAPES[p.solution[k]]}.` : 'No simple step is left. This cell stays empty.' }];
  }

  function render(p, entries, opts = {}) {
    const { R, C, room, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions hk-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, room, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.append(PuzzleShell.figure(given[k])); return; }
        const e = entries[k];
        if (result) {
          if (solution[k]) el.append(PuzzleShell.figure(solution[k]));
          const mine = e === 4 ? 0 : e;
          if (e) el.classList.add(mine === solution[k] ? 'ok' : 'bad');
          else if (solution[k]) el.classList.add('show');
          return;
        }
        if (e === 4) el.classList.add('hk-empty');
        else if (e) el.append(PuzzleShell.figure(e));
      },
      onCell(k, ev) {
        if (given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'hakoiri',
    name: 'Hakoiri',
    rules: 'Put exactly one square, one circle and one triangle into each outlined room. Equal figures never touch, ' +
      'not even at a corner. All figures connect by their sides. Some figures are given.',
    controls: 'Click a cell to cycle square, circle, triangle, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Everything boxed in — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      if (typeof d.v !== 'string' || d.v.length !== n * n || !/^[0-3]+$/.test(d.v)) throw new Error('Invalid givens');
      const p = prepare({ R: n, C: n, room: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) });
      if (p.rooms.some((cells) => !cells)) throw new Error('Invalid rooms');
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
    check: (p, s) => s.every((v, k) => (p.given[k] || (v === 4 ? 0 : v)) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
