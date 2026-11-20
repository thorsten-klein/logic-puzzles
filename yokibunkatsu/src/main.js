// Yokibunkatsu (Container Dividing). Divide the white cells into regions
// of exactly five cells, each holding one star. Every region folds into an
// open box (a cube without its lid) with the star at the bottom. Black
// cells belong to no region. Built on the Parts engine.

(() => {
  // Roll a cube from the star cell over the region; faces: 0 bottom,
  // 1 top, 2 north, 3 south, 4 west, 5 east. True if the five cells get
  // five different faces and none is the top (the lid).
  function folds(C, cells, star) {
    const set = new Set(cells);
    const face = new Map([[star, [0, 1, 2, 3, 4, 5]]]); // [down, up, n, s, w, e]
    const queue = [star];
    const roll = (o, d) => {
      const [dn, up, n, s, w, e] = o;
      if (d === 0) return [n, s, up, dn, w, e]; // roll north
      if (d === 1) return [s, n, dn, up, w, e]; // roll south
      if (d === 2) return [w, e, n, s, up, dn]; // roll west
      return [e, w, n, s, dn, up]; // roll east
    };
    while (queue.length) {
      const k = queue.shift(), r = Math.floor(k / C), c = k % C;
      [[r - 1, c, 0], [r + 1, c, 1], [r, c - 1, 2], [r, c + 1, 3]].forEach(([a, b, d]) => {
        const j = a * C + b;
        if (b < 0 || b >= C || !set.has(j) || face.has(j)) return;
        face.set(j, roll(face.get(k), d));
        queue.push(j);
      });
    }
    const down = cells.map((k) => face.get(k)[0]);
    return new Set(down).size === 5 && !down.includes(1);
  }

  Parts.startGame({
    id: 'yokibunkatsu',
    name: 'Yokibunkatsu',
    rules: 'Divide the white cells into regions of exactly five cells by drawing walls. Each region holds one star and ' +
      'folds into an open box — a cube without its lid — with the star at the bottom. Black cells belong to no region.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Every box folded — nicely done.',
    maxSize: () => 5,
    blocked: (p, k) => p.black[k] === 1,
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    region(p, cells) {
      if (cells.length !== 5) return false;
      const stars = cells.filter((k) => p.clues[k]);
      return stars.length === 1 && folds(p.C, cells, stars[0]);
    },
    split(R, C) {
      for (let t = 0; t < 20; t++) {
        const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.2 ? 1 : 5));
        if (!pieces) continue;
        const blocks = pieces.filter((c) => c.length === 5);
        // Each block must fold with some star cell.
        const stars = blocks.map((cells) => PuzzleShell.shuffle(cells.slice()).find((k) => folds(C, cells, k)));
        if (stars.some((k) => k === undefined)) continue;
        blocks.black = new Uint8Array(R * C);
        pieces.filter((c) => c.length === 1).forEach(([k]) => { blocks.black[k] = 1; });
        blocks.stars = stars;
        return blocks;
      }
      return null;
    },
    clues(p, regions) {
      p.black = regions.black;
      for (const k of regions.stars) p.clues[k] = 1;
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
    cellText: () => '★',
  });
})();
