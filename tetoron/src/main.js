// Tetoron. Divide the grid into tetrominoes (shapes of four cells). Each
// tetromino holds exactly two different letters. Tetrominoes of the same
// shape (turned or mirrored) hold the same two letters.
// Built on the Parts engine. Clues: 1..5 = letters A..E.

(() => {
  const LETTERS = ' ABCDE';
  function kindOf(cells, C) {
    const pts = cells.map((k) => [Math.floor(k / C), k % C]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let [a, b] = t & 4 ? [c, r] : [r, c];
        if (t & 1) a = -a;
        if (t & 2) b = -b;
        return [a, b];
      });
      const ma = Math.min(...q.map((x) => x[0])), mb = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - ma},${b - mb}`).sort().join(' '));
    }
    return keys.sort()[0];  // smallest key
  }
  const letters = (p, cells) => cells.filter((k) => p.clues[k]).map((k) => p.clues[k]).sort().join('');

  Parts.startGame({
    id: 'tetoron',
    name: 'Tetoron',
    rules: 'Divide the grid into tetrominoes (shapes of four cells) by drawing walls. Each tetromino holds exactly two ' +
      'different letters. Tetrominoes of the same shape — turned or mirrored — hold the same two letters.',
    // The menu size is half the board side (the cell count must divide by 4).
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    boardSize: (h) => 2 * h,
    solvedText: 'Every shape has its pair — nicely done.',
    maxSize: () => 4,
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 2,
    region(p, cells) {
      if (cells.length !== 4) return false;
      const l = letters(p, cells);
      return l.length === 2 && l[0] !== l[1];
    },
    final(p, id) {
      const regions = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!regions.has(g)) { regions.set(g, []); } regions.get(g).push(k); } });
      const pairOf = new Map();
      for (const cells of regions.values()) {
        const kind = kindOf(cells, p.C), l = letters(p, cells);
        if (pairOf.has(kind) && pairOf.get(kind) !== l) return false;
        pairOf.set(kind, l);
      }
      return true;
    },
    split: (R, C) => ((R * C) % 4 ? null : Pieces.randomTiling(R, C, () => 4)),
    clues(p, regions) {
      // Each shape gets its own pair of letters.
      const pairOf = new Map();
      for (const cells of regions) {
        const kind = kindOf(cells, p.C);
        if (!pairOf.has(kind)) pairOf.set(kind, PuzzleShell.shuffle([1, 2, 3, 4, 5]).slice(0, 2));
        const [a, b] = PuzzleShell.shuffle(cells.slice()).slice(0, 2);
        const [x, y] = pairOf.get(kind);
        p.clues[a] = x;
        p.clues[b] = y;
      }
    },
    thin: false,
    cellText: (p, k) => LETTERS[p.clues[k]],
  });
})();
