// Renkatsu. The grid is full of numbers. Divide it into regions so that
// each region holds the numbers 1 to its size, each exactly once.
// Built on the Parts engine.

(() => {
  Parts.startGame({
    id: 'renkatsu',
    name: 'Renkatsu',
    rules: 'The grid is full of numbers. Divide it into regions by drawing walls, so that each region holds the numbers ' +
      '1 up to its size, each exactly once (a region of three cells holds 1, 2 and 3).',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Everything counted out — nicely done.',
    // A region of size s holds the numbers 1..s, so s is at most the biggest number.
    maxSize: (p) => Math.max(...p.clues),
    grow(p, cells) {
      const v = cells.map((k) => p.clues[k]);
      return new Set(v).size === v.length;
    },
    region(p, cells) {
      const v = cells.map((k) => p.clues[k]);
      return new Set(v).size === v.length && v.every((x) => x >= 1 && x <= cells.length);
    },
    split: (R, C) => Parts.randomSplit(R, C, () => 2 + Math.floor(Math.random() * 4)),
    clues(p, regions) {
      for (const cells of regions) {
        const vals = PuzzleShell.shuffle(Array.from({ length: cells.length }, (_, i) => i + 1));
        cells.forEach((k, i) => { p.clues[k] = vals[i]; });
      }
    },
    thin: false,
    reroll(p, cells) {
      const vals = PuzzleShell.shuffle(Array.from({ length: cells.length }, (_, i) => i + 1));
      cells.forEach((k, i) => { p.clues[k] = vals[i]; });
    },
    cellText: (p, k) => String(p.clues[k]),
  });
})();
