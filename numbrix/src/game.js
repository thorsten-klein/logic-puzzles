// Decode and state helpers shared by Numbrix and Hidato pages.
// Exposes the global `Game`.

const Game = (() => {
  function decode(d, diag) {
    const R = d && d.r, C = d && d.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 15)) throw new Error('Invalid board size');
    const given = Int32Array.from(String(d.g).split(','), Number);
    if (given.length !== R * C || given.some((v) => !(v >= 0 && v <= R * C))) throw new Error('Invalid givens');
    const res = NumberPath.solve(R, C, diag, given, 2);
    if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
    return { R, C, diag, given, solution: res.solutions[0] };
  }

  function loadState(p, v) {
    const s = new Int32Array(p.R * p.C);
    const parts = String(v).split(',');
    if (parts.length === s.length) parts.forEach((x, k) => { const n = Number(x); if (n >= 0 && n <= s.length) s[k] = n; });
    return s;
  }

  return { decode, loadState };
})();
