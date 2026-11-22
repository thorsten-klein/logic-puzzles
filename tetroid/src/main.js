// Tetroid. Divide the white cells into tetrominoes: L, I, T, S or O shapes
// of four cells (turned or mirrored). Two tetrominoes of the same kind
// never touch by a side. Black cells belong to no tetromino.
// Built on the Parts engine. p.black marks black cells.

(() => {
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
    return keys.find((k) => keys.every((o) => k <= o));
  }
  const cellsOf = (id, g) => { const out = []; id.forEach((x, k) => { if (x === g) out.push(k); }); return out; };
  // Same-kind neighbours (only regions that are complete: 4 cells).
  const clash = (p, cells, id) => {
    const me = id[cells[0]], kind = kindOf(cells, p.C);
    const near = new Set();
    for (const k of cells) for (const j of Parts.nbs(p.R, p.C, k)) if (id[j] >= 0 && id[j] !== me) near.add(id[j]);
    for (const g of near) {
      const other = cellsOf(id, g);
      if (other.length === 4 && kindOf(other, p.C) === kind) return true;
    }
    return false;
  };

  Parts.startGame({
    id: 'tetroid',
    name: 'Tetroid',
    rules: 'Divide the white cells into tetrominoes by drawing walls: L, I, T, S or O shapes of four cells, turned or ' +
      'mirrored. Two tetrominoes of the same kind never touch by a side. Black cells belong to no tetromino.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'All pieces fit — nicely done.',
    maxSize: () => 4,
    blocked: (p, k) => p.black[k] === 1,
    region: (p, cells, id) => cells.length === 4 && !clash(p, cells, id),
    split(R, C) {
      const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.2 ? 1 : 4));
      if (!pieces) return null;
      const blocks = pieces.filter((c) => c.length === 4);
      // Check the same-kind rule on the answer.
      const id = new Int32Array(R * C).fill(-1);
      blocks.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
      for (const cells of blocks) if (clash({ R, C }, cells, id)) return null;
      blocks.black = new Uint8Array(R * C);
      pieces.filter((c) => c.length === 1).forEach(([k]) => { blocks.black[k] = 1; });
      return blocks;
    },
    clues(p, regions) { p.black = regions.black; },
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
    cellText: () => '',
  });
})();
