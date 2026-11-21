// Sukima (Space between Blocks). Place blocks of exactly three cells.
// Each block holds exactly one circle, and every circle is in a block.
// Every 2×2 square keeps at least one cell outside all blocks. Black cells
// belong to no block. Other cells stay empty.
// Built on the Parts engine. Clues: 1 circle; p.black: black cells.

(() => {
  const full2x2 = (p, id, cells) => {
    const { R, C } = p;
    for (const x of cells) {
      const r = Math.floor(x / C), c = x % C;
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
        if (a < 0 || b < 0 || a + 1 >= R || b + 1 >= C) continue;
        const sq = [a * C + b, a * C + b + 1, (a + 1) * C + b, (a + 1) * C + b + 1];
        if (sq.every((k) => id[k] >= 0)) return true;
      }
    }
    return false;
  };

  Parts.startGame({
    id: 'sukima',
    name: 'Sukima',
    rules: 'Place blocks of exactly three cells by drawing walls. Each block holds exactly one circle, and every circle ' +
      'is in a block. Every 2×2 square keeps at least one cell outside all blocks. Black cells belong to no block. Wall ' +
      'in each empty cell on its own.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Room to breathe everywhere — nicely done.',
    maxSize: () => 3,
    blocked: (p, k) => p.black[k] === 1,
    skip: (p, k) => !p.clues[k],
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    region: (p, cells, id) => cells.length === 3 && cells.filter((k) => p.clues[k]).length === 1 && !full2x2(p, id, cells),
    split(R, C) {
      for (let t = 0; t < 20; t++) {
        const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.4 ? 1 : 3));
        if (!pieces) continue;
        const blocks = pieces.filter((c) => c.length === 3);
        const id = new Int32Array(R * C).fill(-2);
        blocks.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
        if (blocks.some((cells) => full2x2({ R, C }, id, cells))) continue;
        blocks.singles = pieces.filter((c) => c.length === 1).map((c) => c[0]);
        return blocks;
      }
      return null;
    },
    clues(p, regions) {
      p.black = new Uint8Array(p.R * p.C);
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * 3)]] = 1;
      // Black cells among the empty ones, until the answer is unique; then drop extra ones.
      const unique = () => { const r = Parts.solve(this, p, 2, 20000); return r.solutions.length === 1 && !r.capped; };
      const singles = PuzzleShell.shuffle(regions.singles.slice());
      for (const k of singles) { if (unique()) break; p.black[k] = 1; }
      if (!unique()) return false;
      for (const k of singles) {
        if (!p.black[k]) continue;
        p.black[k] = 0;
        if (!unique()) p.black[k] = 1;
      }
      return true;
    },
    thin: false,
    encodeExtra: (p) => Array.from(p.black).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== p.R * p.C || !/^[01]+$/.test(x)) throw new Error('Invalid black cells');
      p.black = Uint8Array.from(x, Number);
    },
    decorate(p, k, g, x, y, s) {
      if (!p.black[k]) return;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2); r.setAttribute('width', s); r.setAttribute('height', s);
      r.setAttribute('class', 'rn-black');
      g.appendChild(r);
    },
    cellText: () => '○',
  });
})();
