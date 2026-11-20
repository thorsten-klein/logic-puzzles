// Furisuri (Free Three). Place blocks of exactly three cells. Each block
// holds exactly one circle, and every circle is in a block. Every block
// can slide by one cell in at least one direction, onto empty cells inside
// the grid. Black cells belong to no block. Other cells stay empty.
// Built on the Parts engine. Clues: 1 circle; p.black: black cells.

(() => {
  // Can the block slide one cell somewhere? free(v) says if a cell is free.
  function canSlide(p, id, cells, free) {
    const { R, C } = p;
    const set = new Set(cells);
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => cells.every((x) => {
      const r = Math.floor(x / C) + dr, c = (x % C) + dc;
      if (r < 0 || c < 0 || r >= R || c >= C) return false;
      const j = r * C + c;
      return set.has(j) || (!p.black[j] && free(id[j]));
    }));
  }
  const blocksOf = (id) => {
    const m = new Map();
    id.forEach((g, k) => { if (g >= 0) { if (!m.has(g)) m.set(g, []); m.get(g).push(k); } });
    return [...m.values()];
  };

  Parts.startGame({
    id: 'furisuri',
    name: 'Furisuri',
    rules: 'Place blocks of exactly three cells by drawing walls. Each block holds exactly one circle, and every circle ' +
      'is in a block. Every block can slide by one cell in at least one direction, onto empty cells. Black cells belong ' +
      'to no block. Wall in each empty cell on its own.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Every block free to move — nicely done.',
    maxSize: () => 3,
    blocked: (p, k) => p.black[k] === 1,
    skip: (p, k) => !p.clues[k],
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    // Every placed block must still be able to slide (open cells may be empty).
    region: (p, cells, id) => cells.length === 3 && cells.filter((k) => p.clues[k]).length === 1 &&
      blocksOf(id).every((b) => canSlide(p, id, b, (v) => v < 0)),
    final: (p, id) => blocksOf(id).every((b) => canSlide(p, id, b, (v) => v === -2)),
    split(R, C) {
      for (let t = 0; t < 20; t++) {
        const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.4 ? 1 : 3));
        if (!pieces) continue;
        const blocks = pieces.filter((c) => c.length === 3);
        const id = new Int32Array(R * C).fill(-2);
        blocks.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
        if (blocks.some((cells) => !canSlide({ R, C, black: new Uint8Array(R * C) }, id, cells, (v) => v === -2))) continue;
        blocks.singles = pieces.filter((c) => c.length === 1).map((c) => c[0]);
        return blocks;
      }
      return null;
    },
    clues(p, regions) {
      p.black = new Uint8Array(p.R * p.C);
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * 3)]] = 1;
      // Black cells among the empty ones, until the answer is unique; then drop extra ones.
      const cfg = this;
      const unique = () => { const r = Parts.solve(cfg, p, 2, 20000); return r.solutions.length === 1 && !r.capped; };
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
