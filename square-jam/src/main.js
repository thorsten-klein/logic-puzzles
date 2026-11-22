// Square Jam. Divide the grid into squares (1×1, 2×2, 3×3, ...). A number
// tells the side length of its square; squares may hold any number of
// numbers or none. No point is a corner of four squares.
// Built on the Parts engine.

(() => {
  const box = (p, cells) => {
    const rows = cells.map((k) => Math.floor(k / p.C)), cols = cells.map((k) => k % p.C);
    return [Math.min(...rows), Math.min(...cols), Math.max(...rows), Math.max(...cols)];
  };
  const MAXS = 3;
  Parts.startGame({
    id: 'square-jam',
    name: 'Square Jam',
    rules: 'Divide the grid into squares by drawing walls; here squares are at most 3×3. A number tells the side length of its square; ' +
      'a square may hold several numbers or none. No grid point may be the corner of four squares.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Perfectly squared — nicely done.',
    maxSize: () => MAXS * MAXS,
    grow(p, cells) {
      const [r1, c1, r2, c2] = box(p, cells);
      const side = Math.max(r2 - r1, c2 - c1) + 1;
      return side <= MAXS && cells.every((k) => !p.clues[k] || p.clues[k] >= side);
    },
    region(p, cells) {
      const [r1, c1, r2, c2] = box(p, cells);
      const side = r2 - r1 + 1;
      if (side !== c2 - c1 + 1 || cells.length !== side * side) return false;
      return cells.every((k) => !p.clues[k] || p.clues[k] === side);
    },
    final(p, id) {
      const { R, C } = p;
      for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
        const a = id[(r - 1) * C + c - 1], b = id[(r - 1) * C + c], x = id[r * C + c - 1], y = id[r * C + c];
        if (a !== b && a !== x && b !== y && x !== y) return false;
      }
      return true;
    },
    split(R, C) {
      // Random squares, largest first where they fit; check the corners.
      const id = new Int32Array(R * C).fill(-1);
      const regions = [];
      for (let k = 0; k < R * C; k++) {
        if (id[k] >= 0) continue;
        const r = Math.floor(k / C), c = k % C;
        let side = 1 + Math.floor(Math.random() * MAXS);
        const fits = (s) => r + s <= R && c + s <= C && [...new Array(s * s).keys()].every((i) => id[(r + Math.floor(i / s)) * C + c + (i % s)] < 0);
        while (side > 1 && !fits(side)) side--;
        const cells = [];
        for (let i = 0; i < side; i++) for (let j = 0; j < side; j++) { id[(r + i) * C + c + j] = regions.length; cells.push((r + i) * C + c + j); }
        regions.push(cells);
      }
      for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
        const a = id[(r - 1) * C + c - 1], b = id[(r - 1) * C + c], x = id[r * C + c - 1], y = id[r * C + c];
        if (a !== b && a !== x && b !== y && x !== y) return null;
      }
      return regions;
    },
    clues(p, regions) {
      for (const cells of regions) {
        const side = Math.round(Math.sqrt(cells.length));
        for (const k of cells) p.clues[k] = side;
      }
    },
    cellText: (p, k) => String(p.clues[k]),
  });
})();
