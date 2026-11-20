// Mubunanba (Move Number). Place blocks of exactly three cells. Each
// block holds exactly one digit, and every digit is in a block. The digit
// tells in how many of the four directions the block could slide by one
// cell (onto empty cells inside the grid). Other cells stay empty.
// Built on the Parts engine.

(() => {
  // Directions a block can slide by one cell; free(v) says if a cell is free.
  function dirs(p, id, cells, free = (v) => v === -2) {
    const { R, C } = p;
    const set = new Set(cells);
    let n = 0;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ok = cells.every((x) => {
        const r = Math.floor(x / C) + dr, c = (x % C) + dc;
        if (r < 0 || c < 0 || r >= R || c >= C) return false;
        const j = r * C + c;
        return set.has(j) || free(id[j]);
      });
      if (ok) n++;
    }
    return n;
  }
  const blocksOf = (id) => {
    const m = new Map();
    id.forEach((g, k) => { if (g >= 0) { if (!m.has(g)) m.set(g, []); m.get(g).push(k); } });
    return [...m.values()];
  };

  Parts.startGame({
    id: 'mubunanba',
    name: 'Mubunanba',
    rules: 'Place blocks of exactly three cells by drawing walls. Each block holds exactly one digit, and every digit is ' +
      'in a block. The digit tells in how many of the four directions the block could slide by one cell onto empty ' +
      'cells. Wall in each empty cell on its own.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Every block can move just right — nicely done.',
    maxSize: () => 3,
    skip: (p, k) => !p.clues[k],
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    region(p, cells, id) {
      if (cells.length !== 3 || cells.filter((k) => p.clues[k]).length !== 1) return false;
      for (const b of blocksOf(id)) {
        const want = p.clues[b.find((x) => p.clues[x])] - 1;
        if (dirs(p, id, b) > want || dirs(p, id, b, (v) => v < 0) < want) return false;
      }
      return true;
    },
    final(p, id) {
      return blocksOf(id).every((b) => dirs(p, id, b) === p.clues[b.find((x) => p.clues[x])] - 1);
    },
    split(R, C) {
      const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.35 ? 1 : 3));
      if (!pieces) return null;
      const blocks = pieces.filter((c) => c.length === 3);
      const id = new Int32Array(R * C).fill(-2);
      blocks.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
      blocks.id = id;
      return blocks;
    },
    clues(p, regions) {
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * 3)]] = dirs(p, regions.id, cells) + 1;
    },
    thin: false,
    moveClues: true,
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
