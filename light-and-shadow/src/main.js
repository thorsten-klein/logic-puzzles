// Light and Shadow. Split the grid into pieces, each holding exactly one
// number equal to its size. A number on grey belongs to a grey piece, a
// number on white to a white piece. Pieces of the same colour never
// share an edge. Built on the shared Pieces engine.
// Clue code: size for white, size + 17 for grey.

(() => {
  const GREY = 17;
  const sizeOf = (p, k) => (p.clues[k] > GREY ? p.clues[k] - GREY : p.clues[k]);
  const grey = (code) => code > GREY;

  // Random two-colour pattern; each one-colour patch becomes a piece.
  function split(R, C) {
    const N = R * C;
    for (let t = 0; t < 50; t++) {
      const col = Uint8Array.from({ length: N }, () => (Math.random() < 0.5 ? 1 : 0));
      const seen = new Uint8Array(N);
      const pieces = [];
      let ok = true;
      for (let k = 0; k < N && ok; k++) {
        if (seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) {
          for (const j of Pieces.neighbours(R, C, cells[i])) if (!seen[j] && col[j] === col[k]) { seen[j] = 1; cells.push(j); }
        }
        if (cells.length > 9) ok = false;
        cells.sort((a, b) => a - b);
        cells.grey = col[k] === 1;
        pieces.push(cells);
      }
      if (ok) return pieces;
    }
    return null;
  }

  Pieces.startGame({
    id: 'light-and-shadow',
    name: 'Light and Shadow',
    rules: 'Divide the grid into pieces. Each piece holds exactly one number, and has that many cells. ' +
      'A number on grey belongs to a grey piece, a number on white to a white piece. ' +
      'Two pieces of the same colour never share an edge.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Light and shadow in balance — nicely done.',
    sizeOf,
    final(p, pieces) {
      const owner = new Int32Array(p.R * p.C).fill(-1);
      const colour = pieces.map((cells) => grey(p.clues[cells.find((k) => p.clues[k])]));
      pieces.forEach((cells, i) => { for (const k of cells) owner[k] = i; });
      for (let k = 0; k < p.R * p.C; k++) {
        for (const j of Pieces.neighbours(p.R, p.C, k)) if (owner[j] !== owner[k] && colour[owner[j]] === colour[owner[k]]) return false;
      }
      return true;
    },
    split,
    clueFor: (p, cells) => [cells[Math.floor(Math.random() * cells.length)], cells.length + (cells.grey ? GREY : 0)],
    clueText: (v) => (v > GREY ? v - GREY : v),
    decorate(p, k, el) { if (grey(p.clues[k])) el.classList.add('grey-clue'); },
  });
})();
