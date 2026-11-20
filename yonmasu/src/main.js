// Yonmasu. Split the grid into pieces of exactly four cells; each piece
// holds exactly one circle. Built on the shared Pieces engine.

Pieces.startGame({
  id: 'yonmasu',
  name: 'Yonmasu',
  rules: 'Divide the grid into pieces of exactly four cells. Each piece holds exactly one circle.',
  size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
  solvedText: 'Four by four — nicely done.',
  sizeOf: () => 4,
  split: (R, C) => Pieces.randomTiling(R, C, () => 4),
  clueFor: (p, cells) => [cells[Math.floor(Math.random() * cells.length)], 1],
  clueText: () => '●',
  generateSize: (h) => 2 * h,
});
