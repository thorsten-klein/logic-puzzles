// Kapetto (Set Carpets). Divide some of the grid into rectangles. Each
// rectangle holds exactly one number: its area. Cells without a number
// may stay outside all rectangles. Built on the Parts engine.

(() => {
  const box = (p, cells) => {
    const rows = cells.map((k) => Math.floor(k / p.C)), cols = cells.map((k) => k % p.C);
    return [Math.min(...rows), Math.min(...cols), Math.max(...rows), Math.max(...cols)];
  };
  Parts.startGame({
    id: 'kapetto',
    name: 'Kapetto',
    rules: 'Draw rectangles (squares count too) by drawing walls around them. Each rectangle holds exactly one number, ' +
      'its area. Cells without a number may stay outside all rectangles; wall them in as single cells.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'All carpets laid — nicely done.',
    maxSize: (p) => Math.max(...p.clues),
    skip: (p, k) => !p.clues[k],
    grow(p, cells) {
      const nums = cells.filter((k) => p.clues[k]);
      if (nums.length > 1) return false;
      return !nums.length || cells.length <= p.clues[nums[0]];
    },
    region(p, cells) {
      const nums = cells.filter((k) => p.clues[k]);
      if (nums.length !== 1 || cells.length !== p.clues[nums[0]]) return false;
      const [r1, c1, r2, c2] = box(p, cells);
      return (r2 - r1 + 1) * (c2 - c1 + 1) === cells.length;
    },
    split(R, C) {
      const id = new Int32Array(R * C).fill(-1);
      const regions = [];
      for (let t = 0; t < R * C * 4; t++) {
        const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
        const r = Math.floor(Math.random() * (R - h + 1)), c = Math.floor(Math.random() * (C - w + 1));
        const cells = [];
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) cells.push((r + i) * C + c + j);
        if (cells.some((k) => id[k] >= 0)) continue;
        cells.forEach((k) => { id[k] = regions.length; });
        regions.push(cells);
      }
      return regions;
    },
    clues(p, regions) { for (const cells of regions) p.clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length; },
    thin: false,
    cellText: (p, k) => String(p.clues[k]),
  });
})();
