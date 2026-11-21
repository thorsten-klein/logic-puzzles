// Futoshiki entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'futoshiki',
  name: 'Futoshiki',
  rules: 'Fill the grid with the numbers 1 to N so that each row and each column holds every number once. ' +
    'The signs between cells must hold: the open side of < points at the bigger number.',
  controls: 'Click a cell and type a number. Arrow keys move between cells.',
  size: { min: 4, max: 8, def: 5 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, h: p.h, v: p.v, g: Array.from(p.given).join('') }),
  decode(d) {
    const n = d?.n;
    if (!Number.isInteger(n) || n < 3 || n > 9) throw new Error('Invalid board size');
    if (typeof d.h !== 'string' || d.h.length !== n * (n - 1) || !/^[.<>]*$/.test(d.h)) throw new Error('Invalid signs');
    if (typeof d.v !== 'string' || d.v.length !== n * (n - 1) || !/^[.^v]*$/.test(d.v)) throw new Error('Invalid signs');
    if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[0-9]+$/.test(d.g)) throw new Error('Invalid givens');
    const p = { n, h: d.h, v: d.v, given: Int8Array.from(d.g, Number) };
    const res = Latin.solve(n, Latin.startCand(n, p.given), Rules.makePrune(p), 2, 50000);
    if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
    p.solution = res.solutions[0];
    return p;
  },
  newState: (p) => new Int8Array(p.n * p.n),
  saveState: (s) => Array.from(s).join(','),
  loadState(p, val) {
    const s = new Int8Array(p.n * p.n);
    const parts = String(val).split(',');
    if (parts.length === s.length) parts.forEach((x, k) => { const v = Number(x); if (v >= 0 && v <= p.n) s[k] = v; });
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints: (p, s) => Latin.hints(p.n, Rules.merged(p, s), p.solution, Rules.makePrune(p), 'the signs'),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'Every row, column and sign checks out — nicely done.',
});
