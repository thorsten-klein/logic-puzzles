// Skyscrapers entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'skyscrapers',
  name: 'Skyscrapers',
  rules: 'Fill the grid with buildings of height 1 to N. Each row and column holds every height once. ' +
    'A number outside the grid tells how many buildings you see from there — taller buildings hide smaller ones behind them.',
  controls: 'Click a cell and type a height. Arrow keys move between cells.',
  size: { min: 4, max: 7, def: 5 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, c: p.clues.join(''), g: Array.from(p.given).join('') }),
  decode(d) {
    const n = d && d.n;
    if (!Number.isInteger(n) || n < 3 || n > 9) throw new Error('Invalid board size');
    if (typeof d.c !== 'string' || d.c.length !== 4 * n || !/^[0-9]+$/.test(d.c)) throw new Error('Invalid clues');
    if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[0-9]+$/.test(d.g)) throw new Error('Invalid givens');
    const p = { n, clues: Array.from(d.c, Number), given: Int8Array.from(d.g, Number) };
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
  hints: (p, s) => Latin.hints(p.n, Rules.merged(p, s), p.solution, Rules.makePrune(p), 'the view clues'),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'Every view adds up — nicely done.',
});
