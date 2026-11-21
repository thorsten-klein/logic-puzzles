// Snake Pit. Divide the grid into snakes: paths one cell wide and at least
// two cells long. A snake never touches itself, not even at a corner
// (except where it turns). A circle is the end of a snake; a cross is
// never an end. A number is the length of its snake. Two snakes of the
// same length never share a side.
// Built on the Parts engine. Clues: 1 circle, 2 cross, 10 + v number v.

(() => {
  // Is this connected set a snake (or part of one)?
  function snakeLike(C, cells) {
    const set = new Set(cells);
    for (const k of cells) {
      const r = Math.floor(k / C), c = k % C;
      const side = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => b >= 0 && b < C && set.has(a * C + b)).length;
      if (side > 2) return false;
      // A corner touch needs a shared side neighbour (a turn).
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) {
        if (b < 0 || b >= C || !set.has(a * C + b)) continue;
        if (!set.has(r * C + b) && !set.has(a * C + c)) return false;
      }
    }
    // No loops: a path has one edge less than its cells.
    let edges = 0;
    for (const k of cells) { if (set.has(k + 1) && (k + 1) % C) edges++; if (set.has(k + C)) edges++; }
    return edges === cells.length - 1;
  }
  const ends = (C, cells) => {
    const set = new Set(cells);
    return cells.filter((k) => {
      const r = Math.floor(k / C), c = k % C;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => b >= 0 && b < C && set.has(a * C + b)).length < 2;
    });
  };

  Parts.startGame({
    id: 'snake-pit',
    name: 'Snake Pit',
    rules: 'Divide the grid into snakes by drawing walls: paths one cell wide and at least two cells long. A snake never ' +
      'touches itself, not even at a corner. A circle is the end of a snake; a cross is never an end. A number is the ' +
      'length of its snake. Two snakes of the same length never share a side.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'All snakes untangled — nicely done.',
    // A snake has at most all cells; numbers cap it further where present.
    maxSize: (p) => p.R * p.C,
    grow: (p, cells) => snakeLike(p.C, cells) && cells.every((k) => p.clues[k] < 10 || cells.length <= p.clues[k] - 10),
    region(p, cells) {
      if (cells.length < 2 || !snakeLike(p.C, cells)) return false;
      const e = new Set(ends(p.C, cells));
      return cells.every((k) => {
        const v = p.clues[k];
        if (v === 1) return e.has(k);
        if (v === 2) return !e.has(k);
        if (v >= 10) return v - 10 === cells.length;
        return true;
      });
    },
    final(p, id) {
      const size = new Map();
      id.forEach((g) => size.set(g, (size.get(g) || 0) + 1));
      for (let k = 0; k < id.length; k++) {
        if (k % p.C < p.C - 1 && id[k] !== id[k + 1] && size.get(id[k]) === size.get(id[k + 1])) return false;
        if (k + p.C < id.length && id[k] !== id[k + p.C] && size.get(id[k]) === size.get(id[k + p.C])) return false;
      }
      return true;
    },
    split(R, C) {
      const N = R * C;
      const used = new Int32Array(N).fill(-1);
      const snakes = [];
      const nb = (k) => { const r = Math.floor(k / C), c = k % C; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => a * C + b); };
      for (;;) {
        const free = [...new Array(N).keys()].filter((k) => used[k] < 0);
        if (!free.length) break;
        const deg = (k) => nb(k).filter((j) => used[j] < 0).length;
        const start = free.reduce((a, b) => (deg(b) < deg(a) || (deg(b) === deg(a) && Math.random() < 0.3) ? b : a), free[0]);
        const path = [start];
        used[start] = snakes.length;
        const want = 2 + Math.floor(Math.random() * 5);
        while (path.length < want) {
          const x = path.at(-1);
          const opts = PuzzleShell.shuffle(nb(x).filter((j) => used[j] < 0 && snakeLike(C, path.concat([j]))));
          if (!opts.length) break;
          const j = opts.reduce((a, b) => (deg(b) < deg(a) ? b : a));
          used[j] = snakes.length;
          path.push(j);
        }
        if (path.length < 2) return null;
        snakes.push(path);
      }
      const p = { R, C };
      return this.final(p, used) ? snakes : null;
    },
    clues(p, regions) {
      for (const cells of regions) {
        for (const k of ends(p.C, cells)) p.clues[k] = 1;
        const inner = cells.filter((k) => !p.clues[k]);
        if (inner.length && Math.random() < 0.5) p.clues[inner[Math.floor(Math.random() * inner.length)]] = 2;
        const free = cells.filter((k) => !p.clues[k]);
        const k = (free.length ? free : cells)[Math.floor(Math.random() * (free.length || cells.length))];
        p.clues[k] = 10 + cells.length;
      }
    },
    cellText: (p, k) => (p.clues[k] >= 10 ? String(p.clues[k] - 10) : p.clues[k] === 2 ? '×' : ''),
    decorate(p, k, g, x, y, s) {
      if (p.clues[k] !== 1) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'sp-ring');
      g.appendChild(o);
    },
  });
})();
