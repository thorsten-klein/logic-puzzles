// Nawabari. Split the grid into rectangles, each holding exactly one
// digit. A digit tells how many sides of its cell lie on region borders
// (the grid edge counts). Built on the Rects engine; code = digit + 1.

(() => {
  const sides = (p, k, [r1, c1, r2, c2]) => {
    const r = Math.floor(k / p.C), c = k % p.C;
    return (r === r1) + (r === r2) + (c === c1) + (c === c2);
  };
  Rects.startGame({
    id: 'nawabari',
    name: 'Nawabari',
    rules: 'Divide the grid into rectangles, each holding exactly one digit. ' +
      'A digit tells how many of its cell\'s four sides lie on a border (the edge of the grid counts).',
    size: { min: 4, max: 10, def: 6 },
    solvedText: 'Every territory marked — nicely done.',
    fits: (p, k, rect) => sides(p, k, rect) === p.clues[k] - 1,
    split: (R, C) => Rects.randomSplit(R, C, 4),
    clueFor: (p, rect, cells) => {
      const k = cells[Math.floor(Math.random() * cells.length)];
      return [k, sides(p, k, rect) + 1];
    },
    clueText: (v) => v - 1,
  });
})();
