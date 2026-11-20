// Sashikaku. Split the grid into rectangles, each holding exactly one
// number: the difference between the rectangle's width and height.
// Built on the shared Rects engine (code = difference + 1).

(() => {
  const diff = ([r1, c1, r2, c2]) => Math.abs((r2 - r1) - (c2 - c1));
  Rects.startGame({
    id: 'sashikaku',
    name: 'Sashikaku',
    rules: 'Divide the grid into rectangles (squares count too). Each rectangle holds exactly one number, ' +
      'and that number is the difference between its width and its height.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'Every difference right — nicely done.',
    movable: true,
    fits: (p, k, rect) => diff(rect) === p.clues[k] - 1,
    split: (R, C) => Rects.randomSplit(R, C, 4),
    clueFor: (p, rect, cells) => [cells[Math.floor(Math.random() * cells.length)], diff(rect) + 1],
    clueText: (v) => v - 1,
  });
})();
