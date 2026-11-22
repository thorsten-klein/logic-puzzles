// Area Division. Every cell holds a letter. Split the grid into pieces
// that each hold every letter of the range exactly once. Built on the
// shared Pieces engine: the "A" cells act as the clue of each piece.

(() => {
  const L = (v) => String.fromCodePoint(64 + v);
  const sizeFor = (n) => [4, 5, 3, 6].find((s) => (n * n) % s === 0) || 2;

  Pieces.startGame({
    id: 'area-division',
    name: 'Area Division',
    rules: 'Every cell holds a letter. Divide the grid into pieces so that each piece holds every letter of the range ' +
      '(A to the last letter used) exactly once.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every set complete — nicely done.',
    prepare(p, pieces) {
      if (pieces) {
        p.letters = new Int8Array(p.R * p.C);
        for (const cells of pieces) PuzzleShell.shuffle(cells.map((_, i) => i + 1)).forEach((v, i) => { p.letters[cells[i]] = v; });
        p.clues = Int8Array.from(p.letters, (v) => (v === 1 ? 1 : 0));
      }
      p.m = Math.max(...p.letters);
    },
    sizeOf: (p) => p.m,
    fits: (p, k, cells) => new Set(cells.map((j) => p.letters[j])).size === cells.length,
    split: (R, C) => Pieces.randomTiling(R, C, () => sizeFor(R)),
    clueFor: (p, cells) => [cells[0], 1],
    moveClue(p, from, to) {
      // Swap the letters: the A moves, the other letter takes its place.
      [p.letters[from], p.letters[to]] = [p.letters[to], p.letters[from]];
      p.clues[from] = 0;
      p.clues[to] = 1;
    },
    encodeExtra: (p) => Array.from(p.letters).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== p.R * p.C || !/^[1-9]+$/.test(x)) throw new Error('Invalid letters');
      p.letters = Int8Array.from(x, Number);
      p.clues = Int8Array.from(p.letters, (v) => (v === 1 ? 1 : 0));
    },
    clueText: () => 'A',
    cellText: (p, k) => L(p.letters[k]),
  });
})();
