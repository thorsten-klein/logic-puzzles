// Tatamibari. Split the grid into rectangles, one symbol in each:
// "+" a square, "−" wider than tall, "|" taller than wide. No grid dot
// may be a corner of four rectangles. Built on the Rects engine.
// Clue codes: 1 = +, 2 = −, 3 = |.

(() => {
  const shapeCode = ([r1, c1, r2, c2]) => {
    const h = r2 - r1 + 1, w = c2 - c1 + 1;
    if (h === w) return 1;
    if (w > h) return 2;
    return 3;
  };
  Rects.startGame({
    id: 'tatamibari',
    name: 'Tatamibari',
    rules: 'Divide the grid into rectangles, each holding exactly one symbol. A "+" rectangle is a square, ' +
      'a "−" rectangle is wider than tall, and a "|" rectangle is taller than wide. ' +
      'No point of the grid may be a corner of four rectangles.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'The tatami fit — nicely done.',
    fits: (p, k, rect) => shapeCode(rect) === p.clues[k],
    final: (p, rects) => Rects.noFourCorners(p, rects),
    split: (R, C) => Rects.randomSplit(R, C, 4),
    clueFor: (p, rect, cells) => [cells[Math.floor(Math.random() * cells.length)], shapeCode(rect)],
    clueText: (v) => ['', '+', '−', '|'][v],
  });
})();
