// Fill-a-Pix generator. Makes a random blobby picture, writes every
// clue, then drops clues while the puzzle stays solvable by logic alone
// (see Solver.logicSolve), so it is unique and hints always help.
// Exposes the global `Generator`.

const Generator = (() => {
  const { FILLED, EMPTY, block } = Rules;

  // Random noise smoothed a few times gives blob shapes.
  function picture(R, C) {
    let g = Array.from({ length: R * C }, () => Math.random() < 0.5 ? 1 : 0);
    for (let round = 0; round < 2; round++) {
      g = g.map((_, k) => {
        const b = block(k, R, C);
        const sum = b.reduce((a, j) => a + g[j], 0);
        if (sum * 2 > b.length) return 1;
        if (sum * 2 < b.length) return 0;
        return g[k];
      });
    }
    return g;
  }

  function generate(n) {
    const R = n, C = n, N = R * C;
    const img = picture(R, C);
    const solution = Uint8Array.from(img, (v) => (v ? FILLED : EMPTY));
    const clues = new Int8Array(N);
    for (let k = 0; k < N; k++) clues[k] = block(k, R, C).filter((j) => img[j]).length;
    const p = { R, C, clues, solution };
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      const keep = clues[k];
      clues[k] = -1;
      const s = Solver.logicSolve(p);
      if (!s || s.includes(0)) clues[k] = keep;
    }
    return p;
  }

  return { generate };
})();
