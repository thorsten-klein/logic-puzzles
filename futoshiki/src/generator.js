// Futoshiki generator. Random Latin square with every sign shown,
// adds givens only if needed, then removes signs and givens while
// the puzzle stays unique. Exposes the global `Generator`.

const Generator = (() => {
  function solutions(p) {
    return Latin.solve(p.n, Latin.startCand(p.n, p.given), Rules.makePrune(p), 2, 30000);
  }

  function unique(p) {
    const res = solutions(p);
    return res.solutions.length === 1 && !res.capped;
  }

  function generate(n) {
    const sol = Latin.randomSquare(n);
    const h = [], v = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) h.push(sol[r * n + c] < sol[r * n + c + 1] ? '<' : '>');
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) v.push(sol[r * n + c] < sol[(r + 1) * n + c] ? '^' : 'v');
    const p = { n, h, v, given: new Int8Array(n * n), solution: sol };
    // All signs are not always enough. Then give a cell where two
    // solutions differ, until unique.
    for (let guard = 0; guard < n * n; guard++) {
      const res = solutions(p);
      if (res.solutions.length === 1 && !res.capped) break;
      const other = res.solutions.find((x) => x.some((val, k) => val !== sol[k]));
      const diff = [...new Array(n * n).keys()].filter((k) => !p.given[k] && (other?.[k] !== sol[k]));
      const k = diff[Math.floor(Math.random() * diff.length)];
      p.given[k] = sol[k];
    }
    // Drop signs (keep at least ~30 %), then givens, while unique.
    const signs = [...h.map((_, i) => ['h', i]), ...v.map((_, i) => ['v', i])];
    let left = signs.length;
    const minSigns = Math.round(signs.length * 0.3);
    for (const [arr, i] of PuzzleShell.shuffle(signs)) {
      if (left <= minSigns) break;
      const keep = p[arr][i];
      p[arr][i] = '.';
      if (unique(p)) left--;
      else p[arr][i] = keep;
    }
    for (let k = 0; k < n * n; k++) {
      if (!p.given[k]) continue;
      p.given[k] = 0;
      if (!unique(p)) p.given[k] = sol[k];
    }
    p.h = p.h.join('');
    p.v = p.v.join('');
    return p;
  }

  return { generate };
})();
