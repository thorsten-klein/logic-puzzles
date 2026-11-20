// Rekuto. Split the grid into rectangles; each holds exactly one number,
// equal to the rectangle's width plus height. Built on the Rects engine.

Rects.startGame({
  id: 'rekuto',
  name: 'Rekuto',
  rules: 'Divide the grid into rectangles (squares count too). Each rectangle holds exactly one number, ' +
    'and that number is its width plus its height.',
  size: { min: 5, max: 12, def: 7 },
  solvedText: 'Every rectangle measured — nicely done.',
  fits: (p, k, [r1, c1, r2, c2], code) => r2 - r1 + 1 + c2 - c1 + 1 === p.clues[k],
  split: (R, C) => Rects.randomSplit(R, C, 4),
  clueFor: (p, [r1, c1, r2, c2], cells) => [cells[Math.floor(Math.random() * cells.length)], r2 - r1 + 1 + c2 - c1 + 1],
  clueText: (v) => v,
});
