// LITS. Shade exactly four connected cells in every room, forming an L, I,
// T or S tetromino (turned or mirrored). Two equal tetrominoes in
// neighbouring rooms never share a side. All shaded cells connect, and no
// 2×2 block is all shaded.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Tetromino type: 'L', 'I', 'T', 'S' (O and others: null).
  function kind(C, cells) {
    if (cells.length !== 4) return null;
    const pts = cells.map((k) => [Math.floor(k / C), k % C]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let a = r, b = c;
        if (t & 1) [a, b] = [b, -a];
        if (t & 2) [a, b] = [-a, -b];
        if (t & 4) b = -b;
        return [a, b];
      });
      const r0 = Math.min(...q.map((x) => x[0])), c0 = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - r0},${b - c0}`).sort().join(' '));
    }
    const key = keys.reduce((min, k) => (k.localeCompare(min) < 0 ? k : min), keys[0]);
    return { '0,0 0,1 0,2 0,3': 'I', '0,0 0,1 0,2 1,0': 'L', '0,0 0,1 0,2 1,1': 'T', '0,0 0,1 1,1 1,2': 'S' }[key] || null;
  }

  function model(p) {
    const { R, C, room } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = rooms.map((cells) => ({ cells, min: 4, max: 4, at: cells[0], why: (v) => (v === YES ? 'Each room needs four shaded cells.' : 'This room already has its four shaded cells.') }));
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    // Every way to put an L, I, T or S into each room.
    const place = rooms.map((cells) => {
      const set = new Set(cells), out = [];
      for (const k of cells) for (const sh of SHAPES) {
        const r0 = Math.floor(k / C), c0 = k % C;
        const pc = sh.map(([a, b]) => [r0 + a, c0 + b]);
        if (pc.some(([a, b]) => a < 0 || b < 0 || a >= R || b >= C || !set.has(a * C + b))) continue;
        const ks = pc.map(([a, b]) => a * C + b).sort((x, y) => x - y);
        // No 2×2 square inside a tetromino (only O has one, and it is not listed).
        out.push(ks);
      }
      const seen = new Set();
      return out.filter((ks) => { const key = ks.join(','); if (seen.has(key)) { return false; } seen.add(key); return true; });
    });
    // A room's cells: shaded if in every fitting placement, white if in none.
    function propagate(s, log) {
      let set = 0;
      for (let g = 0; g < rooms.length; g++) {
        const fit = place[g].filter((ks) => {
          const on = new Set(ks);
          return rooms[g].every((k) => {
            if (s[k] === YES) return on.has(k);
            if (s[k] === NO) return !on.has(k);
            return true;
          });
        });
        if (!fit.length) return -1;
        for (const k of rooms[g]) {
          if (s[k] !== UNKNOWN) continue;
          const inAll = fit.every((ks) => ks.includes(k)), inNone = fit.every((ks) => !ks.includes(k));
          if (!inAll && !inNone) continue;
          s[k] = inAll ? YES : NO;
          set++;
          if (log) { log.push({ cells: [k], v: s[k], reason: inAll ? 'Every L, I, T or S that still fits this room covers this cell.' : 'No L, I, T or S that still fits this room covers this cell.' }); return set; }
        }
      }
      return set;
    }
    function check(s, done) {
      const type = new Array(rooms.length).fill(null);
      for (let g = 0; g < rooms.length; g++) {
        const black = rooms[g].filter((k) => s[k] === YES);
        // Shaded cells in a room must be able to join inside the room.
        if (black.length > 1) {
          const ok = new Set(rooms[g].filter((k) => s[k] !== NO));
          const seen = new Set([black[0]]), st = [black[0]];
          while (st.length) { const k = st.pop(); for (const j of [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1]) if (ok.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (black.some((k) => !seen.has(k))) return false;
        }
        if (black.length === 4) {
          type[g] = kind(C, black);
          if (!type[g]) return false;
          const set = new Set(black), st = [black[0]], seen = new Set(st);
          while (st.length) { const k = st.pop(); for (const j of [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1]) if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (seen.size !== 4) return false;
        }
      }
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        for (const j of [k % C < C - 1 ? k + 1 : -1, k + C < N ? k + C : -1]) {
          if (j < 0 || s[j] !== YES || room[j] === room[k]) continue;
          if (type[room[k]] && type[room[k]] === type[room[j]]) return false;
        }
      }
      return Binary.canConnect(R, C, s, YES);
    }
    return { N, cons, check, propagate };
  }

  // Shapes of L, I, T, S in all turns.
  const BASE = [[[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]]];
  const SHAPES = [];
  for (const b of BASE) for (let t = 0; t < 8; t++) {
    SHAPES.push(b.map(([r, c]) => {
      let a = r, d = c;
      if (t & 1) [a, d] = [d, -a];
      if (t & 2) [a, d] = [-a, -d];
      if (t & 4) d = -d;
      return [a, d];
    }));
  }

  function checkPieceTouching(N, C, ks, owner, pieces, t) {
    for (const k of ks) for (const j of [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1]) {
      if (j >= 0 && j < N && owner[j] >= 0 && kind(C, pieces[owner[j]]) === t) return true;
    }
    return false;
  }

  function has2x2Block(black, R, C) {
    for (let r = 0; r + 1 < R; r++) for (let c = 0; c + 1 < C; c++) {
      if (black[r * C + c] && black[r * C + c + 1] && black[(r + 1) * C + c] && black[(r + 1) * C + c + 1]) return true;
    }
    return false;
  }

  function tryAddPiece(ctx, anchor) {
    const { R, C, N, black, owner, pieces } = ctx;
    for (const sh of PuzzleShell.shuffle(SHAPES.slice())) {
      const [ar, ac] = sh[Math.floor(Math.random() * 4)];
      const r0 = Math.floor(anchor / C) - ar, c0 = (anchor % C) - ac;
      const cells = sh.map(([a, b]) => [r0 + a, c0 + b]);
      if (cells.some(([a, b]) => a < 0 || b < 0 || a >= R || b >= C || black[a * C + b])) continue;
      const ks = cells.map(([a, b]) => a * C + b);
      ks.forEach((k) => { black[k] = 1; });
      const bad = has2x2Block(black, R, C) || checkPieceTouching(N, C, ks, owner, pieces, kind(C, ks));
      if (bad) { ks.forEach((k) => { black[k] = 0; }); continue; }
      ks.forEach((k) => { owner[k] = pieces.length; });
      pieces.push(ks);
      return true;
    }
    return false;
  }

  function tryMoveCell(cand, p, N, C) {
    for (const x of cand) {
      const g = p.room[x];
      const to = [x - C, x + C, x % C ? x - 1 : -1, (x + 1) % C ? x + 1 : -1].filter((j) => j >= 0 && j < N && p.room[j] !== g);
      if (!to.length) continue;
      const rest = [...new Array(N).keys()].filter((k) => p.room[k] === g && k !== x);
      const set = new Set(rest), seen = new Set([rest[0]]), st = [rest[0]];
      while (st.length) {
        const k = st.pop();
        for (const j of [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1]) {
          if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); }
        }
      }
      if (seen.size !== rest.length) continue;
      p.room[x] = p.room[to[Math.floor(Math.random() * to.length)]];
      return true;
    }
    return false;
  }

  function repairRooms(ctx, deadline) {
    const { p, N, C, sol } = ctx;
    let unique = false;
    for (let fix = 0; fix < 30 && !unique && Date.now() < deadline; fix++) {
      const r = Binary.solve(model(p), 2, 20000);
      if (r.capped || !r.solutions.length) break;
      const other = r.solutions.find((x) => x.some((v, k) => v !== sol[k]));
      if (!other) { unique = true; break; }
      const cand = PuzzleShell.shuffle([...new Array(N).keys()].filter((k) => other[k] === YES && sol[k] === NO));
      if (!tryMoveCell(cand, p, N, C) || model(p).check(sol, true) === false) break;
    }
    return unique;
  }

  function generate(n) {
    const deadline = Date.now() + (n > 5 ? 14000 : 8000);
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const black = new Uint8Array(N);
      const owner = new Int32Array(N).fill(-1);
      const pieces = [];
      const ctx = { R, C, N, black, owner, pieces };
      if (!tryAddPiece(ctx, Math.floor(Math.random() * N))) continue;
      for (let t = 0; t < 600 && pieces.length * 4 < N * 0.6; t++) {
        const edge = [];
        for (let k = 0; k < N; k++) if (!black[k] && [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1].some((j) => j >= 0 && j < N && black[j])) edge.push(k);
        if (!edge.length) break;
        tryAddPiece(ctx, edge[Math.floor(Math.random() * edge.length)]);
      }
      const room = PuzzleShell.growRegions(R, C, pieces);
      if (!room) continue;
      const p = { R, C, room };
      const sol = Uint8Array.from(black, (v) => (v ? YES : NO));
      if (model(p).check(sol, true) === false) continue;
      if (!repairRooms({ p, N, C, sol }, deadline)) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  // The four shapes for the rules: cells as [row, col].
  const PICTURES = [
    ['L', [[0, 0], [1, 0], [2, 0], [2, 1]]],
    ['I', [[0, 0], [1, 0], [2, 0], [3, 0]]],
    ['T', [[0, 0], [0, 1], [0, 2], [1, 1]]],
    ['S', [[0, 1], [0, 2], [1, 0], [1, 1]]],
  ];

  // Small pictures of L, I, T and S under the rules.
  function shapesInfo() {
    const box = document.createElement('div');
    box.className = 'lits-shapes';
    for (const [letter, cells] of PICTURES) {
      const R = Math.max(...cells.map(([r]) => r)) + 1, C = Math.max(...cells.map(([, c]) => c)) + 1;
      const grid = document.createElement('div');
      grid.className = 'lits-shape';
      grid.style.gridTemplateColumns = `repeat(${C}, 16px)`;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const cell = document.createElement('span');
          if (cells.some(([a, b]) => a === r && b === c)) cell.className = `on lits-${letter}`;
          grid.append(cell);
        }
      }
      const fig = document.createElement('figure');
      const cap = document.createElement('figcaption');
      cap.textContent = letter;
      fig.append(grid, cap);
      box.append(fig);
    }
    const note = document.createElement('p');
    note.className = 'lits-note';
    note.textContent = 'Turned and mirrored shapes count too. So a Z is an S, mirrored.';
    const wrap = document.createElement('div');
    wrap.append(box, note);
    return wrap;
  }

  Binary.startGame({
    id: 'lits',
    name: 'LITS',
    rules: 'Shade exactly four connected cells in every outlined room, forming an L, I, T or S shape (turned or mirrored). ' +
      'Two equal shapes in neighbouring rooms never share a side. All shaded cells connect, and no 2×2 block is all shaded.',
    info: shapesInfo,
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'All tetrominoes in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      return { R, C, room: Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) };
    },
    model,
    draw(p, k, el, v, shown) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (v !== YES) return;
      // A fully shaded 2×2 block breaks a rule: frame it in red with a "!".
      const r = Math.floor(k / p.C), c = k % p.C;
      if (r < p.R - 1 && c < p.C - 1 && [k + 1, k + p.C, k + p.C + 1].every((j) => shown[j] === YES)) {
        const frame = document.createElement('span');
        frame.className = 'lits-block';
        frame.title = 'No 2×2 block may be all shaded.';
        el.append(frame);
      }
      // Color a room's shaded cells by their shape once they form one.
      const shapeOf = (g) => {
        const cells = [];
        p.room.forEach((h, j) => { if (h === g && shown[j] === YES) cells.push(j); });
        return kind(p.C, cells);
      };
      const t = shapeOf(p.room[k]);
      if (!t) return;
      el.classList.add(`lits-${t}`);
      // Equal shapes of two rooms touch: red line on the border with a "!".
      // Checked to the right and below, so each border is marked once.
      for (const [j, side] of [[c < p.C - 1 ? k + 1 : -1, 'r'], [r < p.R - 1 ? k + p.C : -1, 'b']]) {
        if (j < 0 || shown[j] !== YES || p.room[j] === p.room[k] || shapeOf(p.room[j]) !== t) continue;
        const line = document.createElement('span');
        line.className = `lits-touch lits-touch-${side}`;
        line.title = 'Two equal shapes in neighbouring rooms never share a side.';
        el.append(line);
      }
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions ck-board',
  });
})();
