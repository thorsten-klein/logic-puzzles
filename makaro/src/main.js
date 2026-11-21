// Makaro. Fill each room with the numbers 1 to its size. Numbers next to
// each other across a room border differ. A black cell with an arrow
// points at the biggest of the numbers around it (up, down, left, right);
// that number is bigger than all the others there. Some numbers are given.
// p.arrow: -1 white cell, 0..3 black cell with arrow (up, down, left,
// right), 4 plain black cell. Candidates are bitmasks (bit v).

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const GLYPH = ['↑︎', '↓︎', '←︎', '→︎', ''];

  function prepare(p) {
    const { n, room, arrow } = p;
    p.rooms = [];
    room.forEach((g, k) => { if (g >= 0) (p.rooms[g] = p.rooms[g] || []).push(k); });
    p.rooms = p.rooms.filter(Boolean);
    p.sizeOf = new Int32Array(n * n);
    for (const cells of p.rooms) for (const k of cells) p.sizeOf[k] = cells.length;
    p.side = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n;
      return STEP.map(([a, b]) => [r + a, c + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b);
    });
    // Arrow groups: the white neighbours of a black arrow cell, with the target.
    p.arrows = [];
    for (let k = 0; k < n * n; k++) {
      const d = arrow[k];
      if (d < 0 || d > 3) continue;
      const r = Math.floor(k / n) + STEP[d][0], c = (k % n) + STEP[d][1];
      const t = r * n + c;
      const cells = p.side[k].filter((j) => arrow[j] < 0);
      p.arrows.push({ cells, t: cells.indexOf(t) });
    }
    return p;
  }

  function propagate(p, cand) {
    const { n, room, arrow } = p;
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < n * n; k++) {
        if (arrow[k] >= 0 || !one(cand[k])) continue;
        for (const j of p.side[k]) if (arrow[j] < 0 && room[j] !== room[k]) cand[j] &= ~cand[k];
      }
      for (const cells of p.rooms) if (!Latin.filterGroup(cells, cand, () => true, true)) return false;
      for (const A of p.arrows) {
        const ok = (vals) => vals.every((v, i) => i === A.t || v < vals[A.t]);
        if (!Latin.filterGroup(A.cells, cand, ok, false)) return false;
      }
      if (cand.some((m, k) => arrow[k] < 0 && !m)) return false;
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
      const k = cand.findIndex((m, i) => p.arrow[i] < 0 && !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, (m, i) => (p.arrow[i] >= 0 ? 0 : low(m)))); return; }
      const vals = [];
      for (let v = 1; v < 10; v++) if (cand[k] & (1 << v)) vals.push(v);
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.n * p.n }, (_, k) => (p.arrow[k] >= 0 ? 0 : given[k] ? 1 << given[k] : ((1 << (p.sizeOf[k] + 1)) - 1) & ~1));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const arrow = new Int8Array(N).fill(-1);
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N * 0.12))) arrow[k] = 4;
      // Rooms of 1..5 white cells.
      const room = new Int32Array(N).fill(-1);
      let id = 0;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (arrow[k] >= 0 || room[k] >= 0) continue;
        const want = 1 + Math.floor(Math.random() * 5);
        const cells = [k];
        room[k] = id;
        for (let g = 0; g < 30 && cells.length < want; g++) {
          const x = cells[Math.floor(Math.random() * cells.length)], r = Math.floor(x / n), c = x % n;
          const opts = STEP.map(([a, b]) => [r + a, c + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && arrow[a * n + b] < 0 && room[a * n + b] < 0);
          if (!opts.length) continue;
          const [a, b] = opts[Math.floor(Math.random() * opts.length)];
          room[a * n + b] = id;
          cells.push(a * n + b);
        }
        id++;
      }
      let p = prepare({ n, room, arrow });
      const fill = solve(p, startCand(p, new Int8Array(N)), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      // Arrows point at the biggest neighbour (only where it is unique).
      for (let k = 0; k < N; k++) {
        if (arrow[k] !== 4) continue;
        const r = Math.floor(k / n), c = k % n;
        const around = STEP.map(([a, b], d) => [a + r, b + c, d]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && arrow[a * n + b] < 0);
        if (!around.length) continue;
        const best = Math.max(...around.map(([a, b]) => sol[a * n + b]));
        const top = around.filter(([a, b]) => sol[a * n + b] === best);
        if (top.length === 1) arrow[k] = top[0][2];
      }
      p = prepare({ n, room, arrow });
      const given = Int8Array.from(sol);
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every((m, k) => arrow[k] >= 0 || one(m)); };
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
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.arrow[k] >= 0 || val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${low(cand[k])} fits here: its room, its neighbours and the arrows leave no other choice.` }];
    }
    const k = [...val.keys()].find((i) => p.arrow[i] < 0 && !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, room, arrow, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board pz-regions mk-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, room, n, n);
        if (arrow[k] >= 0) { el.classList.add('mk-black'); if (arrow[k] < 4) el.append(PuzzleShell.arrowIcon([0, 4, 6, 2][arrow[k]])); return; }
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) el.textContent = entries[k] || '';
        else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: 5,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'makaro',
    name: 'Makaro',
    rules: 'Fill each outlined room with the numbers 1 to its size. Numbers next to each other across a room border are ' +
      'different. A black cell with an arrow points at the biggest of the numbers around it (up, down, left, right). ' +
      'Some numbers are given.',
    controls: 'Click a cell and type a number. Arrow keys move between cells.',
    size: { min: 4, max: 10, def: 6 },
    solvedText: 'Every arrow points true — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join(''),
      a: Array.from(p.arrow, (v) => (v < 0 ? '.' : v)).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n || typeof d.a !== 'string' || d.a.length !== n * n) throw new Error('Invalid puzzle');
      const room = Int32Array.from({ length: n * n }, (_, k) => { const t = d.g.slice(2 * k, 2 * k + 2); return t === '..' ? -1 : Number.parseInt(t, 36); });
      const p = prepare({ n, room, arrow: Int8Array.from(d.a, (ch) => (ch === '.' ? -1 : Number(ch))) });
      p.given = Int8Array.from(d.v, Number);
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) || 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.arrow[k] >= 0 || (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
