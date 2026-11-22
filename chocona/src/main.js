// Chocona (Chocolate). Shade some cells so the shaded cells form
// rectangles (any size, across room borders). Rectangles never share a
// side. A number tells how many cells its room has shaded; rooms without
// a number may have any amount.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { YES, NO } = Binary;

  // Checks that the box of shaded cells contains no white cell.
  function boxShaded(cells, s, C) {
    const rs = cells.map((x) => Math.floor(x / C)), cs = cells.map((x) => x % C);
    const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cs), c1 = Math.max(...cs);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (s[r * C + c] === NO) return false;
    return true;
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = [];
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    function check(s) {
      return Binary.areas(R, C, s).list.every((cells) => boxShaded(cells, s, C));
    }
    return { N, cons, check };
  }

  // True if a rectangle of size w x h at (r0, c0) can be placed without
  // sharing a side with any existing rectangle.
  function canPlaceRect(sol, R, C, r0, c0, h, w) {
    for (let r = r0 - 1; r <= r0 + h; r++) for (let c = c0 - 1; c <= c0 + w; c++) {
      if (r < 0 || c < 0 || r >= R || c >= C) continue;
      const corner = (r === r0 - 1 || r === r0 + h) && (c === c0 - 1 || c === c0 + w);
      if (!corner && sol[r * C + c] === YES) return false;
    }
    return true;
  }

  // Places random rectangles that never share a side.
  function placeRectangles(R, C) {
    const sol = new Uint8Array(R * C).fill(NO);
    for (let t = 0; t < 40; t++) {
      const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
      const r0 = Math.floor(Math.random() * (R - h + 1)), c0 = Math.floor(Math.random() * (C - w + 1));
      if (!canPlaceRect(sol, R, C, r0, c0, h, w)) continue;
      for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) sol[r * C + c] = YES;
    }
    return sol;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = placeRectangles(R, C);
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const count = Math.max(...room) + 1;
      const clues = new Int8Array(count);
      sol.forEach((v, k) => { if (v === YES) clues[room[k]]++; });
      const p = { R, C, room, clues };
      const unique = () => Binary.isUnique(model(p));
      if (!unique()) continue;
      for (const g of PuzzleShell.shuffle([...new Array(count).keys()])) {
        const keep = clues[g];
        clues[g] = -1;
        if (!unique()) clues[g] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'chocona',
    name: 'Chocona',
    rules: 'Shade some cells so the shaded cells form rectangles (of any size, also across room borders). Rectangles ' +
      'never share a side. A number tells how many cells its outlined room has shaded; rooms without a number may have ' +
      'any amount.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'All chocolate bars squared away — nicely done.',
    generate,
    encode: Binary.encodeRoomClues,
    decode: Binary.decodeRoomClues,
    model,
    draw: Binary.drawRoomClues,
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions ck-board',
  });
})();
