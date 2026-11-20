// Binairo generator. Fills a random valid grid, then removes givens
// while logic alone still solves it. Exposes the global `Generator`.

const Generator = (() => {
  const { UNKNOWN, YES, NO } = Binary;

  function randomGrid(n) {
    const s = Binary.randomFill(Rules.model({ n, given: new Uint8Array(n * n) }));
    return s && Rules.isSolved({ n, given: s }, s) ? s : null;
  }

  function generate(n) {
    const sol = randomGrid(n);
    if (!sol) return null;
    const p = { n, given: Uint8Array.from(sol) };
    for (const k of PuzzleShell.shuffle([...Array(n * n).keys()])) {
      p.given[k] = 0;
      const s = Binary.logicSolve(Rules.model(p));
      if (!s || s.includes(UNKNOWN)) p.given[k] = sol[k];
    }
    p.solution = sol;
    return p;
  }

  return { generate };
})();
