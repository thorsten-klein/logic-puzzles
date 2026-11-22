// Dosun-Fuwari. Put one balloon (white circle) and one iron ball (black
// circle) into every room. Balloons float: a balloon sits in the top row,
// or right under a black cell or another balloon. Iron balls sink: an
// iron ball sits in the bottom row, or right on top of a black cell or
// another iron ball. Black cells belong to no room.
// Values: 1 empty, 2 balloon, 3 iron. Candidates are bitmasks.
// Player entries: 0 blank, 1 marked empty, 2 balloon, 3 iron.

(() => {
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const ALL = 0b1110;

  function prepare(p) {
    const { room } = p;
    p.rooms = [];
    room.forEach((g, k) => { if (g >= 0) { p.rooms[g] ??= []; p.rooms[g].push(k); } });
    p.rooms = p.rooms.filter(Boolean);
    p.roomOk = (vals) => vals.filter((v) => v === 2).length === 1 && vals.filter((v) => v === 3).length === 1;
    p.roomOk.partial = (vals, i) => vals.slice(0, i + 1).filter((v) => v === 2).length <= 1 && vals.slice(0, i + 1).filter((v) => v === 3).length <= 1;
    return p;
  }

  function stepGravity(n, room, cand, k) {
    const r = Math.floor(k / n);
    // A balloon needs a roof: top row, black cell or balloon above.
    if (r > 0 && room[k - n] >= 0 && !(cand[k - n] & 4)) cand[k] &= ~4;
    // An iron ball needs a floor: bottom row, black cell or iron below.
    if (r < n - 1 && room[k + n] >= 0 && !(cand[k + n] & 8)) cand[k] &= ~8;
    // A balloon below a sure balloon-free cell can not float there, and
    // a cell above a sure balloon must hold a balloon or be a roof.
    if (r < n - 1 && room[k + n] >= 0 && cand[k + n] === 4) cand[k] &= 4;
    if (r > 0 && room[k - n] >= 0 && cand[k - n] === 8) cand[k] &= 8;
  }

  function propagate(p, cand) {
    const { n, room } = p;
    for (let guard = 0; guard < 100; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < n * n; k++) {
        if (room[k] >= 0) stepGravity(n, room, cand, k);
      }
      for (const cells of p.rooms) if (!Latin.filterGroup(cells, cand, p.roomOk, false)) return false;
      if (cand.some((m, k) => room[k] >= 0 && !m)) return false;
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
      const k = cand.findIndex((m, i) => p.room[i] >= 0 && !one(m));
      if (k < 0) { out.push(Int8Array.from(cand, (m, i) => (p.room[i] < 0 ? 0 : low(m)))); return; }
      const vals = [1, 2, 3].filter((v) => cand[k] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p) => Int32Array.from({ length: p.n * p.n }, (_, k) => (p.room[k] < 0 ? 0 : ALL));

  function growRoom(n, room, black, start, id) {
    const want = 2 + Math.floor(Math.random() * 4);
    const cells = [start];
    room[start] = id;
    for (let g = 0; g < 30 && cells.length < want; g++) {
      const x = cells[Math.floor(Math.random() * cells.length)];
      const r = Math.floor(x / n), c = x % n;
      const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !black[a * n + b] && room[a * n + b] < 0);
      if (!opts.length) continue;
      const [a, b] = opts[Math.floor(Math.random() * opts.length)];
      room[a * n + b] = id;
      cells.push(a * n + b);
    }
    if (cells.length < 2) {
      room[start] = -1;
      black[start] = 1;
      return false;
    }
    return true;
  }

  function generateRooms(n, black) {
    const N = n * n;
    const room = new Int32Array(N).fill(-1);
    let id = 0;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (black[k] || room[k] >= 0) continue;
      if (growRoom(n, room, black, k, id)) id++;
    }
    return room;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const black = new Uint8Array(N);
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N * 0.12))) black[k] = 1;
      const room = generateRooms(n, black);
      const p = prepare({ n, room });
      const res = solve(p, startCand(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = res.solutions[0];
      return p;
    }
    return null;
  }

  const NAME = ['', 'empty', 'a balloon', 'an iron ball'];

  function hints(p, entries) {
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e && p.room[k] >= 0 && e !== p.solution[k]) return [{ cells: [k], v: 0, reason: e === 1 ? 'This cell is not empty.' : 'This is wrong here.' }];
    }
    const cand = Int32Array.from(entries, (e, k) => {
      if (p.room[k] < 0) return 0;
      if (e) return 1 << e;
      return ALL;
    });
    propagate(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (entries[k] || p.room[k] < 0 || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `This cell must be ${NAME[low(cand[k])]}: balloons float up, iron balls sink, and each room has one of each.` }];
    }
    const k = [...entries.keys()].find((i) => !entries[i] && p.room[i] >= 0);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${NAME[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, room, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board pz-regions df-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, room, n, n);
        if (room[k] < 0) { el.classList.add('df-black'); return; }
        if (hintCells.has(k)) el.classList.add('hint');
        const v = result ? solution[k] : entries[k];
        if (v === 2 || v === 3) { const o = document.createElement('span'); o.className = 'rt-fig ' + (v === 2 ? 'rabbit' : 'tree'); el.append(o); }
        if (v === 1 && !result) el.classList.add('rt-empty');
        if (result && entries[k]) el.classList.add(entries[k] === solution[k] ? 'ok' : 'bad');
        else if (result && (solution[k] === 2 || solution[k] === 3)) el.classList.add('miss'); // not entered yet
      },
      onCell(k, ev) {
        if (room[k] < 0) return;
        const order = [0, 2, 3, 1];
        entries[k] = order[(order.indexOf(entries[k]) + (ev.button === 2 ? 3 : 1)) % 4];
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'dosun-fuwari',
    name: 'Dosun-Fuwari',
    rules: 'Put one balloon (white circle) and one iron ball (black circle) into every outlined room. Balloons float: a ' +
      'balloon sits in the top row, or right under a black cell or another balloon. Iron balls sink: an iron ball sits in ' +
      'the bottom row, or right on a black cell or another iron ball. Black cells belong to no room.',
    controls: 'Click a cell to cycle balloon, iron ball, empty mark, blank. Right click cycles back.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Up and down, all in place — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: n * n }, (_, k) => { const t = d.g.slice(2 * k, 2 * k + 2); return t === '..' ? -1 : Number.parseInt(t, 36); });
      const p = prepare({ n, room });
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
    check: (p, s) => s.every((v, k) => p.room[k] < 0 || (v || 1) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (p.room[k] >= 0) s[k] = h.v; },
  });
})();
