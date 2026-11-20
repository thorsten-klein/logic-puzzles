// Meadows. Split the grid into squares; each square holds exactly one
// circle. Built on the shared Rects engine (clue code 1 = circle).

Rects.startGame({
  id: 'meadows',
  name: 'Meadows',
  rules: 'Divide the grid into squares. Each square holds exactly one circle.',
  size: { min: 5, max: 12, def: 7 },
  solvedText: 'Neat square meadows — nicely done.',
  fits: (p, k, [r1, c1, r2, c2]) => r2 - r1 === c2 - c1,
  split: (R, C) => Rects.randomSplit(R, C, 4, (h, w) => { const s = Math.min(h, w); return [s, s]; }),
  clueFor: (p, rect, cells) => [cells[Math.floor(Math.random() * cells.length)], 1],
  clueText: () => '●',
  className: 'md-board',
});
