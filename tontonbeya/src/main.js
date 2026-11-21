// Tontonbeya. Put a square, circle or triangle in every cell. In each
// room, the figures of one kind form one connected block, and all kinds
// used in the room appear equally often. Each block touches exactly one
// block of the same kind in another room. Some figures are given.
// Values: 1 square, 2 circle, 3 triangle (0 = empty).

(() => {
  const FIG = ['', '■', '●', '▲'];

  function prepare(p) {
    const { n, room } = p;
    p.rooms = [];
    room.forEach((g, k) => { p.rooms[g] ??= []; p.rooms[g].push(k); });
    p.nb = Array.from({ length: n * n }, (_, k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b);
    });
    // Rooms touching each room.
    p.near = p.rooms.map((cells, g) => [...new Set(cells.flatMap((k) => p.nb[k].map((j) => room[j])))].filter((h) => h !== g));
    // Fill order: rooms in BFS order.
    const order = [], seen = new Uint8Array(p.rooms.length);
    const q = [0];
    seen[0] = 1;
    while (q.length) { const g = q.shift(); order.push(...p.rooms[g]); for (const h of p.near[g]) if (!seen[h]) { seen[h] = 1; q.push(h); } }
    p.order = order;
    return p;
  }

  // Region checks on a full room.
  function roomOk(p, v, g) {
    const cells = p.rooms[g];
    const cnt = [0, 0, 0, 0];
    for (const k of cells) cnt[v[k]]++;
    const used = cnt.filter((x, t) => t && x);
    if (used.some((x) => x !== used[0])) return false;
    for (let t = 1; t <= 3; t++) {
      if (!cnt[t]) continue;
      const start = cells.find((k) => v[k] === t);
      const seen = new Set([start]), st = [start];
      while (st.length) { const k = st.pop(); for (const j of p.nb[k]) if (!seen.has(j) && p.room[j] === g && v[j] === t) { seen.add(j); st.push(j); } }
      if (seen.size !== cnt[t]) return false;
    }
    return true;
  }
  // Block (room g, kind t) partners: other rooms whose block of kind t touches it.
  function partners(p, v, g, t) {
    const out = new Set();
    for (const k of p.rooms[g]) if (v[k] === t) for (const j of p.nb[k]) if (p.room[j] !== g && v[j] === t) out.add(p.room[j]);
    return out.size;
  }
  const full = (p, v, g) => p.rooms[g].every((k) => v[k]);
  function linksOk(p, v, g) {
    if (!full(p, v, g) || !p.near[g].every((h) => full(p, v, h))) return true;
    for (let t = 1; t <= 3; t++) if (p.rooms[g].some((k) => v[k] === t) && partners(p, v, g, t) !== 1) return false;
    return true;
  }

  function solve(p, given, stopAt = 2, maxNodes = 50000, random = false) {
    const N = p.n * p.n;
    const v = Int8Array.from(given);
    const out = [];
    let nodes = 0;
    (function rec(i) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (i === N) { out.push(Int8Array.from(v)); return; }
      const k = p.order[i], g = p.room[k];
      const vals = given[k] ? [given[k]] : random ? PuzzleShell.shuffle([1, 2, 3]) : [1, 2, 3];
      for (const x of vals) {
        v[k] = x;
        let ok = true;
        if (full(p, v, g)) ok = roomOk(p, v, g);
        if (ok) for (const h of [g, ...p.near[g]]) if (!linksOk(p, v, h)) { ok = false; break; }
        if (ok) rec(i + 1);
      }
      v[k] = given[k];
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const p = prepare({ n, room });
      const fill = solve(p, new Int8Array(N), 1, 20000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      const given = Int8Array.from(sol);
      const unique = () => { const r = solve(p, given, 2, 20000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        const keep = given[k];
        given[k] = 0;
        if (!unique()) given[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, s) {
    for (let k = 0; k < s.length; k++) if (s[k] && !p.given[k] && s[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This figure is wrong.' }];
    const k = p.order.find((i) => !p.given[i] && !s[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. A ${['', 'square', 'circle', 'triangle'][p.solution[k]]} goes here.` }];
  }

  function render(p, s, opts = {}) {
    const { n, room, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 46), className: 'pz-board pz-regions tt-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, room, n, n);
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = FIG[given[k]]; return; }
        if (result) { el.textContent = FIG[solution[k]]; el.classList.add(PuzzleShell.resultClass(s[k], solution[k])); return; }
        el.textContent = FIG[s[k]];
      },
      onCell(k, ev) {
        if (given[k]) return;
        s[k] = (s[k] + (ev.button === 2 ? 3 : 1)) % 4;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'tontonbeya',
    name: 'Tontonbeya',
    rules: 'Put a square, circle or triangle in every cell. In each outlined room, the figures of one kind form one ' +
      'connected block, and all kinds used in the room appear equally often. Each block touches exactly one block of the ' +
      'same kind in another room. Some figures are given.',
    controls: 'Click a cell to cycle: square, circle, triangle, empty. Right click cycles back.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Fair odds everywhere — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 10) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid puzzle');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const p = prepare({ n, room });
      p.given = Int8Array.from(d.v, Number);
      const res = solve(p, p.given, 2, 200000);
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
