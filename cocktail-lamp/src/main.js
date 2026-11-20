// Cocktail Lamp. Shade some cells. In each room the shaded cells form one
// block (or there are none). A number tells how many cells its room
// has shaded. Cells next to each other across a room border are never
// both shaded. All blocks connect through their corners. No 2×2 block
// is all shaded. Built on the shared Binary game page (YES = shaded).
// p.room: room per cell; p.clues: number per room (-1 = none).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3,
        why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (const j of [c < C - 1 ? k + 1 : -1, r < R - 1 ? k + C : -1]) {
        if (j >= 0 && room[j] !== room[k]) cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Cells next to each other across a room border are never both shaded.' });
      }
    }
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    // True if all cells marked `want` can join, moving through cells
    // that pass `ok`, with the given neighbour steps.
    const joins = (want, ok, diag) => {
      const start = want.findIndex(Boolean);
      if (start < 0) return true;
      const seen = new Uint8Array(N);
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const k = stack.pop(), r = Math.floor(k / C), c = k % C;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if ((!dr && !dc) || (!diag && dr && dc)) continue;
          const a = r + dr, b = c + dc, j = a * C + b;
          if (a < 0 || b < 0 || a >= R || b >= C || seen[j] || !ok(k, j)) continue;
          seen[j] = 1;
          stack.push(j);
        }
      }
      return want.every((w, k) => !w || seen[k]);
    };
    function check(s) {
      // One block per room.
      for (const cells of rooms) {
        const inRoom = new Uint8Array(N);
        cells.forEach((k) => { inRoom[k] = 1; });
        const want = Array.from(s, (v, k) => inRoom[k] && v === YES);
        if (!joins(want, (k, j) => inRoom[j] && s[j] !== NO, false)) return false;
      }
      // All shaded cells connect through sides and corners.
      const want = Array.from(s, (v) => v === YES);
      if (!want.some(Boolean)) return true;
      return joins(want, (k, j) => s[j] !== NO, true);
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 4));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const count = Math.max(...room) + 1;
      const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
      const fill = Binary.randomFill(model(p), 0.45, 10);
      if (!fill) continue;
      const shaded = fill.filter((v) => v === YES).length;
      if (shaded < N / 5) continue;
      p.clues = new Int8Array(count);
      fill.forEach((v, k) => { if (v === YES) p.clues[room[k]]++; });
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'cocktail-lamp',
    name: 'Cocktail Lamp',
    rules: 'Shade some cells. In each room the shaded cells form one block, or the room stays white. ' +
      'A number tells how many cells its room has shaded. Two cells next to each other across a room border are never ' +
      'both shaded. All blocks connect to each other through their corners. No 2×2 block is all shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'Cheers, all lamps lit — nicely done.',
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
