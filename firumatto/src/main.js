// Firumatto (Fillmat). Divide the grid into straight pieces one cell
// wide and 1 to 4 cells long. A number tells the length of its piece.
// Pieces of the same length never touch by a side, and no grid point is
// the corner of four pieces. Built on the Parts engine.

(() => {
  const straight = (p, cells) => new Set(cells.map((k) => Math.floor(k / p.C))).size === 1 || new Set(cells.map((k) => k % p.C)).size === 1;
  const sizeOf = (id, g) => { let n = 0; for (const x of id) { if (x === g) { n++; } } return n; };
  const fourCorner = (p, id) => {
    for (let r = 1; r < p.R; r++) for (let c = 1; c < p.C; c++) {
      const a = id[(r - 1) * p.C + c - 1], b = id[(r - 1) * p.C + c], x = id[r * p.C + c - 1], y = id[r * p.C + c];
      if (a >= 0 && b >= 0 && x >= 0 && y >= 0 && a !== b && a !== x && b !== y && x !== y) return true;
    }
    return false;
  };
  function straightOptions(R, C, id, r, c) {
    const opts = [];
    for (let len = 1; len <= 4; len++) for (const horiz of [true, false]) {
      const cells = Array.from({ length: len }, (_, i) => (horiz ? [r, c + i] : [r + i, c]));
      if (cells.some(([a, b]) => a >= R || b >= C || id[a * C + b] >= 0)) continue;
      opts.push(cells.map(([a, b]) => a * C + b));
    }
    return opts;
  }

  function canPlacePiece(R, C, id, regions, cells) {
    cells.forEach((x) => { id[x] = regions.length; });
    const touch = cells.some((x) => Parts.nbs(R, C, x).some((j) => id[j] >= 0 && id[j] !== regions.length && regions[id[j]].length === cells.length));
    if (touch || fourCorner({ R, C }, id)) {
      cells.forEach((x) => { id[x] = -1; });
      return false;
    }
    return true;
  }

  Parts.startGame({
    id: 'firumatto',
    name: 'Firumatto',
    rules: 'Divide the grid into straight pieces, one cell wide and 1 to 4 cells long, by drawing walls. A number tells ' +
      'the length of its piece. Two pieces of the same length never touch by a side, and no grid point is the corner ' +
      'of four pieces.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'A perfect mat — nicely done.',
    maxSize: () => 4,
    grow: (p, cells) => straight(p, cells) && cells.every((k) => !p.clues[k] || p.clues[k] >= cells.length),
    region(p, cells, id) {
      if (!cells.every((k) => !p.clues[k] || p.clues[k] === cells.length)) return false;
      const me = id[cells[0]];
      for (const k of cells) for (const j of Parts.nbs(p.R, p.C, k)) {
        if (id[j] >= 0 && id[j] !== me && sizeOf(id, id[j]) === cells.length) return false;
      }
      return !fourCorner(p, id);
    },
    final: (p, id) => !fourCorner(p, id),
    split(R, C) {
      for (let t = 0; t < 40; t++) {
        const id = new Int32Array(R * C).fill(-1);
        const regions = [];
        for (let k = 0; k < R * C; k++) {
          if (id[k] >= 0) continue;
          const r = Math.floor(k / C), c = k % C;
          const opts = straightOptions(R, C, id, r, c);
          const ok = PuzzleShell.shuffle(opts).find((cells) => canPlacePiece(R, C, id, regions, cells));
          if (!ok) break;
          regions.push(ok);
        }
        if (id.every((x) => x >= 0)) return regions;
      }
      return null;
    },
    clues(p, regions) { for (const cells of regions) for (const k of cells) p.clues[k] = cells.length; },
    cellText: (p, k) => String(p.clues[k]),
  });
})();
