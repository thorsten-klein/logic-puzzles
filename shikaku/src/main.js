// Shikaku entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'shikaku',
  name: 'Shikaku',
  rules: 'Divide the grid into rectangles. Each rectangle holds exactly one number, and that number is its area (in cells).',
  controls: 'Drag from corner to corner to draw a rectangle. Click or right click a rectangle to remove it.',
  size: { min: 5, max: 15, def: 8 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v ? v.toString(36) : '.')).join('') }),
  decode(d) {
    const R = d && d.r, C = d && d.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 30)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
    const clues = Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : parseInt(ch, 36)));
    const p = { R, C, clues };
    const res = Solver.countSolutions(p);
    if (res.count !== 1) throw new Error('Puzzle has no unique solution');
    p.solution = res.first;
    return p;
  },
  newState: () => [],
  saveState: (s) => s,
  loadState: (p, v) => (Array.isArray(v) ? v.filter((r) => Array.isArray(r) && r.length === 4) : []),
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints: (p, s) => Hint.findAll(p, s),
  applyHint(p, s, h) {
    if (h.remove !== undefined) s.splice(h.remove, 1);
    if (h.add) s.push(h.add);
  },
  solvedText: 'Every rectangle fits — nicely done.',
});
