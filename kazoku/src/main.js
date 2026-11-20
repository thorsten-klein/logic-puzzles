// Kazoku (Family Photo). Split the grid into rectangles, each holding
// exactly one clue. A number tells how many black circles the rectangle
// holds; a "?" means at least one. Circles that touch by a side are in
// the same rectangle. Built on the shared Rects engine.
// Clue code: count + 1, or 35 for "?". p.circle marks black circles.

(() => {
  const Q = 35;
  const count = (p, cells) => cells.filter((k) => p.circle[k]).length;

  Rects.startGame({
    id: 'kazoku',
    name: 'Kazoku',
    rules: 'Divide the grid into rectangles, each holding exactly one number or "?". A number tells how many black ' +
      'circles the rectangle holds; a "?" means at least one. Black circles that touch by a side belong to the same rectangle.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Everyone in the photo — nicely done.',
    fits(p, k, rect) {
      const n = count(p, Rects.cellsOf(rect, p.C));
      return p.clues[k] === Q ? n >= 1 : n === p.clues[k] - 1;
    },
    final(p, rects) {
      const id = new Int32Array(p.R * p.C);
      rects.forEach((r, i) => { for (const k of Rects.cellsOf(r, p.C)) id[k] = i; });
      for (let k = 0; k < p.R * p.C; k++) {
        if (!p.circle[k]) continue;
        const r = Math.floor(k / p.C), c = k % p.C;
        if (c < p.C - 1 && p.circle[k + 1] && id[k + 1] !== id[k]) return false;
        if (r < p.R - 1 && p.circle[k + p.C] && id[k + p.C] !== id[k]) return false;
      }
      return true;
    },
    split: (R, C) => Rects.randomSplit(R, C, R <= 4 ? 3 : 4),
    prepare(p, rects) {
      p.circle = new Uint8Array(p.R * p.C);
      for (const rect of rects) for (const k of Rects.cellsOf(rect, p.C)) if (Math.random() < 0.15) p.circle[k] = 1;
    },
    clueFor(p, rect, cells) {
      const n = count(p, cells);
      return [cells[Math.floor(Math.random() * cells.length)], n >= 1 && Math.random() < 0.25 ? Q : n + 1];
    },
    clueText: (v) => (v === Q ? '?' : v - 1),
    encodeExtra: (p) => Array.from(p.circle).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== p.R * p.C || !/^[01]+$/.test(x)) throw new Error('Invalid circles');
      p.circle = Uint8Array.from(x, Number);
    },
    decorate(p, k, el) { if (p.circle[k]) el.classList.add('kz-circle'); },
  });
})();
