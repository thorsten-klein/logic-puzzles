// Marutaringu (Maltese Ring). Shade cells to form one ring, one cell
// thick: every shaded cell has exactly two shaded neighbours, and all
// shaded cells connect. In every room the shaded cells form exactly one
// rectangle (on a thin ring: one straight piece), with at least one cell.
// A number tells how many cells its room has shaded.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'The ring is one cell thick: no 2×2 block is all shaded.' });
    }
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
      else cons.push({ cells, min: 1, max: cells.length, why: () => 'Every room needs at least one shaded cell.' });
    });
    function propagate(s, log) {
      // A shaded cell has exactly two shaded neighbours.
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        const n = nb(k);
        const yes = n.filter((j) => s[j] === YES), open = n.filter((j) => s[j] === UNKNOWN);
        if (yes.length > 2 || yes.length + open.length < 2) return false;
        if (!open.length) continue;
        let v = 0;
        if (yes.length === 2) v = NO;
        else if (yes.length + open.length === 2) v = YES;
        if (!v) continue;
        open.forEach((j) => { s[j] = v; });
        if (log) log.push({ cells: open, v, reason: v === NO ? 'This shaded cell already has its two ring neighbours.' : 'The ring goes on through these cells: no other way is open.' });
        return open.length;
      }
      return 0;
    }
    function check(s, done) {
      // Shaded cells of a room: one straight piece.
      for (const cells of rooms) {
        const yes = cells.filter((k) => s[k] === YES);
        if (!yes.length) continue;
        const rows = yes.map((k) => Math.floor(k / C)), cols = yes.map((k) => k % C);
        const r1 = Math.min(...rows), r2 = Math.max(...rows), c1 = Math.min(...cols), c2 = Math.max(...cols);
        if (r1 !== r2 && c1 !== c2) return false;
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (s[r * C + c] === NO) return false;
      }
      if (!Binary.canConnect(R, C, s, YES)) return false;
      return true;
    }
    return { N, cons, propagate, check };
  }

  // Rooms: each piece as it is, then free cells join a neighbouring room.
  function grow(n, groups) {
    const N = n * n;
    const room = new Int32Array(N).fill(-1);
    groups.forEach((cells, id) => cells.forEach((k) => { room[k] = id; }));
    for (let open = room.filter((x) => x < 0).length, guard = 0; open > 0 && guard < N * 4; guard++) {
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (room[k] >= 0) continue;
        const r = Math.floor(k / n), c = k % n;
        const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && room[a * n + b] >= 0).map(([a, b]) => room[a * n + b]);
        if (!near.length) continue;
        room[k] = near[Math.floor(Math.random() * near.length)];
        open--;
      }
    }
    return room;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const loop = Loop.randomLoop(n, n, 0.4);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const on = new Uint8Array(N);
      for (let k = 0; k < N; k++) if (g.cellEdges[k].some((e) => e >= 0 && loop[e] === Loop.LINE)) on[k] = 1;
      // The ring must not touch itself: exactly two ring neighbours each.
      const nb = (k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };
      if ([...on.keys()].some((k) => on[k] && nb(k).filter((j) => on[j]).length !== 2)) continue;
      // Walk the ring, cut it into straight pieces of 1–3 cells.
      const start = on.indexOf(1);
      const order = [start];
      let prev = -1, x = start;
      for (;;) {
        const nx = nb(x).find((j) => on[j] && j !== prev);
        if (nx === start || nx === undefined) break;
        order.push(nx);
        prev = x; x = nx;
      }
      const pieces = [];
      let cur = [order[0]];
      for (let i = 1; i < order.length; i++) {
        const k = order[i];
        const straight = cur.length < 2 || (k - cur.at(-1)) === (cur.at(-1) - cur.at(-2));
        if (straight && cur.length < 2 + Math.floor(Math.random() * 2)) cur.push(k);
        else { pieces.push(cur); cur = [k]; }
      }
      pieces.push(cur);
      // Pieces must be straight lines (also the first one after the wrap).
      const okPiece = (cells) => new Set(cells.map((k) => Math.floor(k / n))).size === 1 || new Set(cells.map((k) => k % n)).size === 1;
      if (!pieces.every(okPiece)) continue;
      const room = grow(n, pieces);
      if (room.some((v) => v < 0)) continue;
      const sol = Uint8Array.from(on, (v) => (v ? YES : NO));
      const p = { R: n, C: n, room, clues: Int8Array.from(pieces, (cells) => cells.length) };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const r of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[r];
        p.clues[r] = -1;
        if (!unique()) p.clues[r] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'marutaringu',
    name: 'Marutaringu',
    rules: 'Shade cells to form one ring, one cell thick: every shaded cell has exactly two shaded neighbours, and all ' +
      'shaded cells connect. In every outlined room the shaded cells form exactly one rectangle (here: one straight ' +
      'piece), and every room has at least one shaded cell. A number tells how many cells its room has shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'The ring is closed — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = Int8Array.from(String(d.n).split(','), Number);
      if (room.some((v) => !(v >= 0 && v < clues.length))) throw new Error('Invalid rooms');
      return { R, C, room, clues };
    },
    model,
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (p.room.indexOf(p.room[k]) === k && p.clues[p.room[k]] >= 0) {
        const lab = document.createElement('span');
        lab.className = 'room-clue';
        lab.textContent = p.clues[p.room[k]];
        el.appendChild(lab);
      }
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions ck-board',
  });
})();
