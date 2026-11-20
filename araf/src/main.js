// Araf. Divide the grid into regions. Each region holds exactly two
// numbers, and its size lies strictly between them (with 2 and 5 the
// region has 3 or 4 cells). Built on the shared Parts engine.

(() => {
  const nums = (p, cells) => cells.filter((k) => p.clues[k]).map((k) => p.clues[k]);

  Parts.startGame({
    id: 'araf',
    name: 'Araf',
    rules: 'Divide the grid into regions by drawing walls. Each region holds exactly two numbers, and its size lies ' +
      'strictly between them: with 2 and 5 the region has 3 or 4 cells.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Everything in between — nicely done.',
    maxSize: (p) => Math.max(...p.clues) - 1,
    grow(p, cells) {
      const n = nums(p, cells);
      if (n.length > 2) return false;
      if (n.length && cells.length >= Math.max(...n) && n.length === 2) return false;
      return true;
    },
    region(p, cells) {
      const n = nums(p, cells);
      if (n.length !== 2) return false;
      const [a, b] = n.sort((x, y) => x - y);
      return cells.length > a && cells.length < b;
    },
    split: (R, C) => Parts.randomSplit(R, C, () => 2 + Math.floor(Math.random() * 4)),
    clues(p, regions) {
      for (const cells of regions) {
        if (cells.length < 2) return false;
        const [x, y] = PuzzleShell.shuffle(cells.slice()).slice(0, 2);
        p.clues[x] = Math.max(1, cells.length - 1 - Math.floor(Math.random() * 2));
        p.clues[y] = cells.length + 1 + Math.floor(Math.random() * 2);
      }
      return true;
    },
    thin: false,
    cellText: (p, k) => String(p.clues[k]),
  });
})();
