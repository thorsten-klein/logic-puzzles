// Aqre. Shade some cells. A number tells how many cells its room has
// shaded; rooms without a number may have any amount. All shaded cells
// connect. No row or column has four or more cells of the same colour in
// a row. Built on the shared Binary game page (YES = shaded).
// p.room: room per cell; p.clues: count per room (-1 = none).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const cons = [];
    // Any four in a line: 1 to 3 shaded.
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (c + 3 < C) cons.push({ cells: [0, 1, 2, 3].map((i) => r * C + c + i), min: 1, max: 3, why: (v) => (v === YES ? 'Four white cells in a row are not allowed.' : 'Four shaded cells in a row are not allowed.') });
      if (r + 3 < R) cons.push({ cells: [0, 1, 2, 3].map((i) => (r + i) * C + c), min: 1, max: 3, why: (v) => (v === YES ? 'Four white cells in a column are not allowed.' : 'Four shaded cells in a column are not allowed.') });
    }
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    const check = (s) => Binary.canConnect(R, C, s, YES);
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const count = Math.max(...room) + 1;
      const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
      const fill = Binary.randomFill(model(p), 0.5, 10);
      if (!fill) continue;
      p.clues = new Int8Array(count);
      fill.forEach((v, k) => { if (v === YES) p.clues[room[k]]++; });
      // Unique: by logic alone, else proven by the full solver.
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const g of PuzzleShell.shuffle([...Array(count).keys()])) {
        const keep = p.clues[g];
        p.clues[g] = -1;
        if (!unique()) p.clues[g] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'aqre',
    name: 'Aqre',
    rules: 'Shade some cells. A number tells how many cells its outlined room has shaded; rooms without a number may have ' +
      'any amount. All shaded cells connect by their sides. No row or column may have four or more cells of the same ' +
      'colour in a row.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'No long runs anywhere — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: R * C }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
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
