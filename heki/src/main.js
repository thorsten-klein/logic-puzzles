// Heki. Divide the grid into regions of exactly six cells. Each region
// holds exactly two numbers. A number tells how many of its four
// neighbours belong to the same region. Built on the Parts engine.

(() => {
  const inside = (p, cells, k) => {
    const set = new Set(cells);
    const r = Math.floor(k / p.C), c = k % p.C;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < p.R && b < p.C && set.has(a * p.C + b)).length;
  };
  Parts.startGame({
    id: 'heki',
    name: 'Heki',
    rules: 'Divide the grid into regions of exactly six cells by drawing walls. Each region holds exactly two numbers. ' +
      'A number tells how many of its four neighbours belong to the same region.',
    size: { min: 6, max: 6, def: 6 },
    solvedText: 'Six by six — nicely done.',
    maxSize: () => 6,
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 2,
    region: (p, cells) => cells.length === 6 && cells.filter((k) => p.clues[k]).length === 2 &&
      cells.every((k) => !p.clues[k] || inside(p, cells, k) === p.clues[k] - 1),
    split: (R, C) => ((R * C) % 6 ? null : Pieces.randomTiling(R, C, () => 6)),
    clues(p, regions) {
      for (const cells of regions) for (const k of PuzzleShell.shuffle(cells.slice()).slice(0, 2)) p.clues[k] = inside(p, cells, k) + 1;
    },
    thin: false,
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
