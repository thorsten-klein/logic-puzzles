// Light Up generator. Scatters black cells (mirror symmetric), places
// bulbs until all is lit and numbers the black cells. Then it removes
// numbers while the puzzle stays solvable by logic, so it is unique.
// Exposes the global `Generator`.

const Generator = (() => {
  const { BULB, NONE, WHITE, BLACK } = Rules;
  const shuffle = PuzzleShell.shuffle;

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const walls = new Int8Array(N).fill(WHITE);
    const rate = 0.18 + Math.random() * 0.06;
    for (let k = 0; k < N; k++) {
      const mirror = N - 1 - k;
      if (k <= mirror && Math.random() < rate) { walls[k] = BLACK; walls[mirror] = BLACK; }
    }
    const p = Rules.prepare({ R, C, walls });
    const sol = new Uint8Array(N);
    const lit = new Uint8Array(N);
    for (const k of shuffle([...new Array(N).keys()])) {
      if (walls[k] !== WHITE || lit[k]) continue;
      sol[k] = BULB;
      lit[k] = 1;
      for (const j of p.sight[k]) lit[j] = 1;
    }
    for (let k = 0; k < N; k++) {
      if (walls[k] === WHITE) { if (!sol[k]) { sol[k] = NONE; } continue; }
      walls[k] = p.nb[k].filter((j) => sol[j] === BULB).length;
    }
    const solvedByLogic = () => {
      const s = Solver.logicSolve(p);
      return s && !s.some((v, k) => !v && walls[k] === WHITE);
    };
    if (!solvedByLogic()) return null;
    for (const k of shuffle([...new Array(N).keys()])) {
      if (walls[k] < 0) continue;
      const keep = walls[k];
      walls[k] = BLACK;
      if (!solvedByLogic()) walls[k] = keep;
    }
    p.solution = sol;
    return p;
  }

  function generate(n) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const p = tryOnce(n);
      if (p) return p;
    }
    return null;
  }

  return { generate };
})();
