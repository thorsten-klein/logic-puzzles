// Light Up entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'light-up',
  name: 'Light Up',
  rules: 'Place bulbs in white cells so every white cell is lit. A bulb lights its row and column ' +
    'up to the next black cell. No bulb may shine on another bulb. A number on a black cell tells ' +
    'how many bulbs touch it by a side.',
  controls: 'Click a white cell to place a bulb, click again to mark "no bulb". Right click cycles the other way.',
  size: { min: 5, max: 14, def: 8 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({
    r: p.R, c: p.C,
    g: Array.from(p.walls, (v) => (v === Rules.WHITE ? '.' : v === Rules.BLACK ? '#' : String(v))).join(''),
  }),
  decode(d) {
    const R = d?.r, C = d?.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 30)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.#0-4]+$/.test(d.g)) throw new Error('Invalid grid');
    const walls = Int8Array.from(d.g, (ch) => (ch === '.' ? Rules.WHITE : ch === '#' ? Rules.BLACK : Number(ch)));
    const p = Rules.prepare({ R, C, walls });
    const { solutions } = Solver.solve(p, 2);
    if (solutions.length !== 1) throw new Error('Puzzle has no unique solution');
    p.solution = solutions[0];
    return p;
  },
  newState: (p) => new Uint8Array(p.R * p.C),
  saveState: (s) => Array.from(s).join(''),
  loadState(p, v) {
    const s = new Uint8Array(p.R * p.C);
    if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints: (p, s) => Hint.findAll(p, s),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'Every cell is lit — nicely done.',
});
