// Binairo entry point. Plugs the game into the shared shell.
// The menu size is half the board side (boards are always even).

PuzzleShell.start({
  id: 'binairo',
  name: 'Binairo',
  rules: 'Fill every cell with 0 or 1. No more than two equal digits may sit next to each other in a row or column. ' +
    'Each row and column has as many 0s as 1s. No two rows are the same, and no two columns are the same.',
  controls: 'Click a cell for 0, again for 1, again to clear. Right click cycles the other way.',
  size: { min: 3, max: 7, def: 4, text: (h) => `${2 * h}×${2 * h}` },
  generate: (h) => Generator.generate(2 * h),
  encode: (p) => ({ n: p.n, g: Array.from(p.given).join('') }),
  decode(d) {
    const n = d && d.n;
    if (!Number.isInteger(n) || n < 4 || n > 16 || n % 2) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[012]+$/.test(d.g)) throw new Error('Invalid givens');
    const p = { n, given: Uint8Array.from(d.g, Number) };
    // Logic first (generated boards need no more); search only if it stalls.
    const m = Rules.model(p);
    const t = Binary.logicSolve(m);
    if (t && !t.includes(Binary.UNKNOWN)) { p.solution = t; return p; }
    const res = Binary.solve(m, 2, 200000, t || undefined);
    if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
    p.solution = res.solutions[0];
    return p;
  },
  newState: (p) => new Uint8Array(p.n * p.n),
  saveState: (s) => Array.from(s).join(''),
  loadState(p, v) {
    const s = new Uint8Array(p.n * p.n);
    if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints(p, s) {
    const t = Uint8Array.from(s, (v, k) => p.given[k] || v);
    return Binary.hints(Rules.model(p), t, p.solution, '1', '0', (k) => PuzzleShell.cellName(k, p.n));
  },
  applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  solvedText: 'Perfect balance — nicely done.',
});
