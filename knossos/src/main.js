// Knossos. Divide the grid into rooms. Each room holds exactly one
// number: the length of the room's border (its outline, counted in cell
// sides). Built on the Parts engine.

(() => {
  const outline = (p, cells) => {
    const set = new Set(cells);
    let n = 0;
    for (const k of cells) {
      const r = Math.floor(k / p.C), c = k % p.C;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (a < 0 || b < 0 || a >= p.R || b >= p.C || !set.has(a * p.C + b)) n++;
    }
    return n;
  };
  Parts.startGame({
    id: 'knossos',
    name: 'Knossos',
    rules: 'Divide the grid into rooms by drawing walls. Each room holds exactly one number, which tells the length ' +
      'of the room\'s outline, counted in cell sides.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Out of the labyrinth — nicely done.',
    // A room with an outline of P cell sides has at most (P/4)² cells.
    maxSize: (p) => Math.max(1, Math.floor((Math.max(...p.clues) / 4) ** 2)),
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    region(p, cells) {
      const nums = cells.filter((k) => p.clues[k]);
      return nums.length === 1 && outline(p, cells) === p.clues[nums[0]];
    },
    split: (R, C) => Pieces.randomTiling(R, C, () => 1 + Math.floor(Math.random() * 6)),
    clues(p, regions) { for (const cells of regions) p.clues[cells[Math.floor(Math.random() * cells.length)]] = outline(p, cells); },
    thin: false,
    moveClues: true,
    cellText: (p, k) => String(p.clues[k]),
  });
})();
