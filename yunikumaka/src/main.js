// Yunikumaka (Unique Marker). Divide the white cells into tetrominoes
// (four cells). Each tetromino holds exactly one dot. A dot sits in a cell
// or on the border between two cells; a dot on a border between two
// different tetrominoes does not count. Black cells belong to no piece.
// Built on the Parts engine. p.black marks black cells, p.cdot cell dots,
// p.edot edge dots (edge numbering like Loop.grid).

(() => {
  const edgeCells = (p, e) => {
    const { R, C } = p;
    if (e < R * (C - 1)) { const r = Math.floor(e / (C - 1)), c = e % (C - 1); return [r * C + c, r * C + c + 1]; }
    const f = e - R * (C - 1), r = Math.floor(f / C), c = f % C;
    return [r * C + c, (r + 1) * C + c];
  };
  const dotsIn = (p, cells) => {
    const set = new Set(cells);
    let n = cells.filter((k) => p.cdot[k]).length;
    for (const e of p.edot) { const [a, b] = edgeCells(p, e); if (set.has(a) && set.has(b)) n++; }
    return n;
  };

  Parts.startGame({
    id: 'yunikumaka',
    name: 'Yunikumaka',
    rules: 'Divide the white cells into pieces of four cells (tetrominoes) by drawing walls. Each piece holds exactly ' +
      'one dot. A dot sits in a cell or on the border between two cells; a dot on a border between two different ' +
      'pieces does not count. Black cells belong to no piece.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'One mark each — nicely done.',
    maxSize: () => 4,
    blocked: (p, k) => p.black[k] === 1,
    grow: (p, cells) => dotsIn(p, cells) <= 1,
    region: (p, cells) => cells.length === 4 && dotsIn(p, cells) === 1,
    split(R, C) {
      const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.15 ? 1 : 4));
      if (!pieces) return null;
      const blocks = pieces.filter((c) => c.length === 4);
      blocks.black = new Uint8Array(R * C);
      pieces.filter((c) => c.length === 1).forEach(([k]) => { blocks.black[k] = 1; });
      return blocks;
    },
    clues(p, regions) {
      const { R, C } = p;
      p.black = regions.black;
      p.cdot = new Uint8Array(R * C);
      p.edot = [];
      const id = new Int32Array(R * C).fill(-1);
      regions.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
      const E = R * (C - 1) + (R - 1) * C;
      // One counted dot per piece: in a cell or on an inside border.
      for (const cells of regions) {
        const inner = [];
        for (let e = 0; e < E; e++) { const [a, b] = edgeCells(p, e); if (cells.includes(a) && cells.includes(b)) inner.push(e); }
        if (Math.random() < 0.5 && inner.length) p.edot.push(inner[Math.floor(Math.random() * inner.length)]);
        else p.cdot[cells[Math.floor(Math.random() * 4)]] = 1;
      }
      // A few dots on borders between pieces (they do not count).
      for (let e = 0; e < E; e++) {
        const [a, b] = edgeCells(p, e);
        if (id[a] >= 0 && id[b] >= 0 && id[a] !== id[b] && Math.random() < 0.12) p.edot.push(e);
      }
      p.edot.sort((x, y) => x - y);
    },
    thin: false,
    encodeExtra: (p) => ({ b: Array.from(p.black).join(''), c: Array.from(p.cdot).join(''), e: p.edot.join(',') }),
    decodeExtra(p, x) {
      const n = p.R * p.C;
      if (!x || typeof x.b !== 'string' || x.b.length !== n || typeof x.c !== 'string' || x.c.length !== n) throw new Error('Invalid dots');
      p.black = Uint8Array.from(x.b, Number);
      p.cdot = Uint8Array.from(x.c, Number);
      p.edot = String(x.e || '').split(',').filter((t) => t !== '').map(Number);
    },
    decorate(p, k, g, x, y, s) {
      const NS = 'http://www.w3.org/2000/svg';
      const dot = (cx, cy) => {
        const o = document.createElementNS(NS, 'circle');
        o.setAttribute('cx', cx); o.setAttribute('cy', cy); o.setAttribute('r', s * 0.12);
        o.setAttribute('class', 'yk-dot');
        g.appendChild(o);
      };
      if (p.black[k]) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2); r.setAttribute('width', s); r.setAttribute('height', s);
        r.setAttribute('class', 'rn-black');
        g.appendChild(r);
      }
      if (p.cdot[k]) dot(x, y);
      // Edge dots: draw those whose first cell is k.
      for (const e of p.edot) {
        const [a, b] = edgeCells(p, e);
        if (a !== k) continue;
        if (b === a + 1) dot(x + s / 2, y); else dot(x, y + s / 2);
      }
    },
    cellText: () => '',
  });
})();
