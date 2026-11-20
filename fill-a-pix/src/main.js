// Fill-a-Pix entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'fill-a-pix',
  name: 'Fill-a-Pix',
  rules: 'Fill some cells to reveal a picture. Each number tells how many of the nine cells ' +
    'around it (the cell itself included) are filled.',
  controls: 'Click a cell to fill it, click again to mark it empty. Right click cycles the other way.',
  size: { min: 5, max: 15, def: 10 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({
    r: p.R, c: p.C,
    g: Array.from(p.clues, (v) => (v < 0 ? '.' : String(v))).join(''),
  }),
  decode(d) {
    const R = d && d.r, C = d && d.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 30)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-9]+$/.test(d.g)) throw new Error('Invalid clues');
    const p = { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
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
  solvedText: 'The picture is complete — nicely done.',
});
