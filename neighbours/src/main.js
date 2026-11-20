// Neighbours. Split the grid into pieces of equal size; each piece holds
// one clue. A number tells how many other pieces share a border with
// that piece ("?" can be anything). Built on the shared Pieces engine.
// Clue code: neighbour count + 1, or 35 for "?".

(() => {
  const Q = 35;
  const sizeFor = (n) => [4, 3, 5, 6].find((s) => (n * n) % s === 0) || 2;

  function neighbourCount(p, pieces, i) {
    const owner = new Int32Array(p.R * p.C).fill(-1);
    pieces.forEach((cells, j) => { for (const k of cells) owner[k] = j; });
    const around = new Set();
    for (const k of pieces[i]) for (const j of Pieces.neighbours(p.R, p.C, k)) if (owner[j] !== i) around.add(owner[j]);
    return around.size;
  }

  Pieces.startGame({
    id: 'neighbours',
    name: 'Neighbours',
    rules: 'Divide the grid into pieces that all have the same number of cells. Each piece holds exactly one clue. ' +
      'A number tells how many other pieces share a border with that piece. A "?" can be any number.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Good neighbours all around — nicely done.',
    prepare(p) {
      const clues = p.clues.filter((v) => v).length;
      p.size = Math.round((p.R * p.C) / clues);
    },
    sizeOf: (p) => p.size,
    final: (p, pieces) => pieces.every((cells, i) => {
      const k = cells.find((j) => p.clues[j]);
      return p.clues[k] === Q || neighbourCount(p, pieces, i) === p.clues[k] - 1;
    }),
    split: (R, C) => Pieces.randomTiling(R, C, () => sizeFor(R)),
    clueFor(p, cells, pieces) {
      const k = cells[Math.floor(Math.random() * cells.length)];
      const i = pieces.indexOf(cells);
      return [k, Math.random() < 0.2 ? Q : neighbourCount(p, pieces, i) + 1];
    },
    clueText: (v) => (v === Q ? '?' : v - 1),
  });
})();
