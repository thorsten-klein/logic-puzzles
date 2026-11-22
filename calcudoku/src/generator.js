// Calcudoku generator. Random Latin square, random cages of 1 to 4
// cells, an operation per cage. Retries until the solver finds one
// solution. Exposes the global `Generator`.

const Generator = (() => {
  const shuffle = PuzzleShell.shuffle;

  // Cells next to k that are in no cage yet.
  function freeSides(n, cage, k) {
    const kr = Math.floor(k / n), kc = k % n, out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = kr + dr, nc = kc + dc;
      if (nr >= 0 && nc >= 0 && nr < n && nc < n && cage[nr * n + nc] < 0) out.push(nr * n + nc);
    }
    return out;
  }

  function makeCages(n) {
    const cage = new Int32Array(n * n).fill(-1);
    let id = 0;
    for (const start of shuffle([...new Array(n * n).keys()])) {
      if (cage[start] >= 0) continue;
      // Size 1 to 4; 2 and 3 are the most common.
      const r = Math.random();
      const size = 1 + [0.08, 0.5, 0.85].filter((x) => r >= x).length;
      const cells = [start];
      cage[start] = id;
      while (cells.length < size) {
        const opts = cells.flatMap((k) => freeSides(n, cage, k));
        if (!opts.length) break;
        const k = opts[Math.floor(Math.random() * opts.length)];
        cage[k] = id;
        cells.push(k);
      }
      id++;
    }
    return { cage, count: id };
  }

  function pickOp(vals) {
    if (vals.length === 1) return ['', vals[0]];
    if (vals.length === 2) {
      const [a, b] = vals[0] > vals[1] ? vals : [vals[1], vals[0]];
      const opts = ['-', '+', '*'];
      if (a % b === 0) opts.push('/', '/');
      const op = opts[Math.floor(Math.random() * opts.length)];
      return [op, Rules.value(op, vals)];
    }
    const op = Math.random() < 0.55 ? '+' : '*';
    return [op, Rules.value(op, vals)];
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sol = Latin.randomSquare(n);
      const { cage, count } = makeCages(n);
      const groups = Array.from({ length: count }, () => []);
      for (let k = 0; k < n * n; k++) groups[cage[k]].push(sol[k]);
      const ops = groups.map(pickOp);
      const p = { n, cage, ops, cages: Rules.cagesFrom(n, cage, ops), solution: sol };
      const res = Latin.solve(n, Latin.startCand(n), Rules.makePrune(p), 2, 5000);
      if (res.solutions.length === 1 && !res.capped) return p;
    }
    return null;
  }

  return { generate };
})();
