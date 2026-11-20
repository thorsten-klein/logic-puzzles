// Skyscrapers generator. Random Latin square with all edge clues,
// then removes clues (and adds givens only if needed) while unique.
// Exposes the global `Generator`.

const Generator = (() => {
  function solutions(p) {
    return Latin.solve(p.n, Latin.startCand(p.n, p.given), Rules.makePrune(p), 2, 15000);
  }

  function unique(p) {
    const res = solutions(p);
    return res.solutions.length === 1 && !res.capped;
  }

  function generate(n) {
    const sol = Latin.randomSquare(n);
    const p = { n, clues: Rules.cluesFor(n, sol), given: new Int8Array(n * n), solution: sol };
    for (let guard = 0; guard < n * n && !unique(p); guard++) {
      const other = solutions(p).solutions.find((x) => x.some((v, k) => v !== sol[k]));
      const diff = [...Array(n * n).keys()].filter((k) => !p.given[k] && (!other || other[k] !== sol[k]));
      const k = diff[Math.floor(Math.random() * diff.length)];
      p.given[k] = sol[k];
    }
    for (const i of PuzzleShell.shuffle([...Array(4 * n).keys()])) {
      const keep = p.clues[i];
      p.clues[i] = 0;
      if (!unique(p)) p.clues[i] = keep;
    }
    for (let k = 0; k < n * n; k++) {
      if (!p.given[k]) continue;
      p.given[k] = 0;
      if (!unique(p)) p.given[k] = sol[k];
    }
    return p;
  }

  return { generate };
})();
