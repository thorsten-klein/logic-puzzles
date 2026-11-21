// Patchwork (Tatami). The grid is split into rooms of three cells in a
// straight line. Each room holds 1, 2 and 3 once. Equal digits never touch
// by a side. Every row and every column holds each digit equally often.
// Some digits are given. Candidates are bitmasks (bit v).

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  function prepare(p) {
    const { n, room } = p;
    p.rooms = [];
    room.forEach((g, k) => { p.rooms[g] ??= []; p.rooms[g].push(k); });
    const each = n / 3;
    p.lines = [];
    for (let i = 0; i < n; i++) {
      p.lines.push(Array.from({ length: n }, (_, c) => i * n + c), Array.from({ length: n }, (_, r) => r * n + i));
    }
    p.lineOk = (vals) => [1, 2, 3].every((v) => vals.filter((x) => x === v).length === each);
    p.lineOk.partial = (vals, i) => [1, 2, 3].every((v) => vals.slice(0, i + 1).filter((x) => x === v).length <= each);
    p.side = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b);
    });
    return p;
  }

  function propagate(p, cand) {
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < cand.length; k++) if (one(cand[k])) for (const j of p.side[k]) cand[j] &= ~cand[k];
      for (const cells of p.rooms) if (!Latin.filterGroup(cells, cand, () => true, true)) return false;
      for (const cells of p.lines) if (!Latin.filterGroup(cells, cand, p.lineOk, false)) return false;
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
      const vals = [1, 2, 3].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.n * p.n }, (_, k) => (given[k] ? 1 << given[k] : ALL));

  // Rooms: straight strips of three cells covering the grid.
  function strips(n) {
    for (let t = 0; t < 100; t++) {
      const room = new Int32Array(n * n).fill(-1);
      let id = 0, ok = true;
      for (let k = 0; k < n * n && ok; k++) {
        if (room[k] >= 0) continue;
        const r = Math.floor(k / n), c = k % n;
        const opts = [];
        if (c + 2 < n && room[k + 1] < 0 && room[k + 2] < 0) opts.push([k, k + 1, k + 2]);
        if (r + 2 < n) opts.push([k, k + n, k + 2 * n]);
        if (!opts.length) { ok = false; break; }
        const cells = opts[Math.floor(Math.random() * opts.length)];
        cells.forEach((x) => { room[x] = id; });
        id++;
      }
      if (ok && room.every((x) => x >= 0)) return room;
    }
    return null;
  }

  function generate(third) {
    const n = 3 * third;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const room = strips(n);
      if (!room) continue;
      const p = prepare({ n, room });
      const fill = solve(p, startCand(p, new Int8Array(n * n)), 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const given = Int8Array.from(sol);
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every(one); };
      for (const k of PuzzleShell.shuffle([...new Array(n * n).keys()])) {
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
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This digit is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${low(cand[k])} fits here: its room, its neighbours and the digit counts of its row and column leave no other choice.` }];
    }
    const k = [...val.keys()].find((i) => !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, room, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board pz-regions pw-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, room, n, n);
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        } else if (readonly) el.textContent = entries[k] || '';
        else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: 3,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'patchwork',
    name: 'Patchwork',
    rules: 'The grid is split into rooms of three cells in a line. Fill each room with 1, 2 and 3. Equal digits never ' +
      'touch by a side. Every row and every column holds each digit equally often. Some digits are given.',
    controls: 'Click a cell and type a digit. Arrow keys move between cells.',
    size: { min: 2, max: 3, def: 2, text: (t) => `${3 * t}×${3 * t}` },
    solvedText: 'A neat patchwork — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n % 3 || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      if (typeof d.v !== 'string' || d.v.length !== n * n || !/^[0-3]+$/.test(d.v)) throw new Error('Invalid givens');
      const p = prepare({ n, room: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) });
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
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 4;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
