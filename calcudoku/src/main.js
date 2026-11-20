// Calcudoku entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'calcudoku',
  name: 'Calcudoku',
  rules: 'Fill the grid with the numbers 1 to N so each row and column holds every number once. ' +
    'The numbers in each outlined cage must give the target with the shown operation. ' +
    'For − and ÷ take the bigger number minus or divided by the smaller one; their places in the cage do not matter. A number may repeat in a cage if not in the same row or column.',
  controls: 'Click a cell and type a number. Arrow keys move between cells.',
  size: { min: 4, max: 8, def: 5 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({
    n: p.n,
    c: Array.from(p.cage, (v) => v.toString(36).padStart(2, '0')).join(''),
    o: p.ops.map(([op, t]) => `${op || '='}${t}`).join(','),
  }),
  decode(d) {
    const n = d && d.n;
    if (!Number.isInteger(n) || n < 3 || n > 9) throw new Error('Invalid board size');
    if (typeof d.c !== 'string' || d.c.length !== 2 * n * n || typeof d.o !== 'string') throw new Error('Invalid cages');
    const cage = Int32Array.from({ length: n * n }, (_, k) => parseInt(d.c.slice(2 * k, 2 * k + 2), 36));
    const ops = d.o.split(',').map((s) => {
      const m = s.match(/^([+\-*/=])(\d+)$/);
      if (!m) throw new Error('Invalid cage rule');
      return [m[1] === '=' ? '' : m[1], Number(m[2])];
    });
    if (cage.some((v) => !(v >= 0 && v < ops.length))) throw new Error('Invalid cages');
    const p = { n, cage, ops, cages: Rules.cagesFrom(n, cage, ops) };
    const res = Latin.solve(n, Latin.startCand(n), Rules.makePrune(p), 2, 50000);
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
  hints: (p, s) => Latin.hints(p.n, s, p.solution, Rules.makePrune(p), (k) => {
    const [op, t] = p.ops[p.cage[k]];
    return `its ${t}${Rules.SYMBOL[op]} cage`;
  }),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'All cages add up — nicely done.',
});
