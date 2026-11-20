// Raneko (Cat Habitat Map). Divide the white cells into regions. Each
// region holds exactly one circle ("cat"); the number in the circle is
// the region's size. Black cells belong to no region; the number in a
// black cell tells how many different regions touch it by a side.
// Built on the Parts engine. p.black: -1 none, else the black cell number.

(() => {
  Parts.startGame({
    id: 'raneko',
    name: 'Raneko',
    rules: 'Divide the white cells into regions by drawing walls. Each region holds exactly one circle, and the number ' +
      'in the circle is the size of the region. Black cells belong to no region; a number in a black cell tells how ' +
      'many different regions touch it by a side.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every cat has its home — nicely done.',
    maxSize: (p) => Math.max(...p.clues),
    blocked: (p, k) => p.black[k] >= 0,
    grow(p, cells) {
      const cats = cells.filter((k) => p.clues[k]);
      return cats.length <= 1 && (!cats.length || cells.length <= p.clues[cats[0]]);
    },
    region(p, cells) {
      const cats = cells.filter((k) => p.clues[k]);
      return cats.length === 1 && cells.length === p.clues[cats[0]];
    },
    final(p, id) {
      for (let k = 0; k < p.R * p.C; k++) {
        if (p.black[k] < 0) continue;
        const near = new Set(Parts.nbs(p.R, p.C, k).filter((j) => id[j] >= 0).map((j) => id[j]));
        if (near.size !== p.black[k]) return false;
      }
      return true;
    },
    split(R, C) {
      const N = R * C;
      const black = new Uint8Array(N);
      for (const k of PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N * 0.12))) black[k] = 1;
      const id = new Int32Array(N).fill(-1);
      const regions = [];
      for (let k = 0; k < N; k++) {
        if (black[k] || id[k] >= 0) continue;
        const want = 1 + Math.floor(Math.random() * 5);
        const cells = [k];
        id[k] = regions.length;
        for (let g = 0; g < 30 && cells.length < want; g++) {
          const x = cells[Math.floor(Math.random() * cells.length)];
          const opts = Parts.nbs(R, C, x).filter((j) => id[j] < 0 && !black[j]);
          if (!opts.length) continue;
          const j = opts[Math.floor(Math.random() * opts.length)];
          id[j] = regions.length;
          cells.push(j);
        }
        regions.push(cells);
      }
      regions.black = black;
      regions.id = id;
      return regions;
    },
    clues(p, regions) {
      p.black = new Int8Array(p.R * p.C).fill(-1);
      for (let k = 0; k < p.R * p.C; k++) {
        if (!regions.black[k]) continue;
        p.black[k] = new Set(Parts.nbs(p.R, p.C, k).filter((j) => regions.id[j] >= 0).map((j) => regions.id[j])).size;
      }
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
    },
    thin: false,
    encodeExtra: (p) => Array.from(p.black, (v) => (v < 0 ? '.' : v)).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== p.R * p.C || !/^[.0-4]+$/.test(x)) throw new Error('Invalid black cells');
      p.black = Int8Array.from(x, (ch) => (ch === '.' ? -1 : Number(ch)));
    },
    decorate(p, k, g, x, y, s) {
      const NS = 'http://www.w3.org/2000/svg';
      if (p.black[k] >= 0) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2); r.setAttribute('width', s); r.setAttribute('height', s);
        r.setAttribute('class', 'rn-black');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.42);
        t.setAttribute('class', 'pt-clue rn-on-black');
        t.textContent = p.black[k];
        g.appendChild(t);
        return;
      }
      if (!p.clues[k]) return;
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.34);
      o.setAttribute('class', 'll-white');
      g.appendChild(o);
    },
    cellText: (p, k) => String(p.clues[k]),
  });
})();
