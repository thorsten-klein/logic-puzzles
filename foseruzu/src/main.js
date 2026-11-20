// Foseruzu (Four Cells). Divide the grid into regions of exactly four
// cells. A number tells how many of its cell's four sides are region
// borders (the grid edge counts as a border). Built on the Parts engine.

(() => {
  const borders = (p, cells, k) => {
    const set = new Set(cells);
    const r = Math.floor(k / p.C), c = k % p.C;
    let n = 0;
    for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (a < 0 || b < 0 || a >= p.R || b >= p.C || !set.has(a * p.C + b)) n++;
    return n;
  };
  Parts.startGame({
    id: 'foseruzu',
    name: 'Foseruzu',
    rules: 'Divide the grid into regions of exactly four cells by drawing walls. A number tells how many of its cell\'s ' +
      'four sides are region borders; the edge of the grid counts as a border.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Four by four by four — nicely done.',
    maxSize: () => 4,
    region: (p, cells) => cells.length === 4 && cells.every((k) => !p.clues[k] || borders(p, cells, k) === p.clues[k] - 1),
    split: (R, C) => ((R * C) % 4 ? null : Pieces.randomTiling(R, C, () => 4)),
    clues(p, regions) { for (const cells of regions) for (const k of cells) p.clues[k] = borders(p, cells, k) + 1; },
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
