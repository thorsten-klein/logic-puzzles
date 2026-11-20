// Slitherlink entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'slitherlink',
  name: 'Slitherlink',
  rules: 'Draw one closed loop along the dotted lines. The loop never crosses or touches itself. ' +
    'A number tells how many sides of its cell are part of the loop.',
  controls: 'Click an edge to draw a line, click again for a cross (no line), again to clear. Right click cycles the other way.',
  size: { min: 5, max: 10, def: 7 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({
    r: p.R, c: p.C,
    g: Array.from(p.clues, (v) => (v < 0 ? '.' : String(v))).join(''),
    s: Array.from(p.solution).join(''),
  }),
  decode(d) {
    const R = d && d.r, C = d && d.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
    if (typeof d.s !== 'string' || d.s.length !== Rules.edgeCount(R, C) || !/^[01]+$/.test(d.s)) throw new Error('Invalid solution');
    const p = {
      R, C,
      clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))),
      solution: Uint8Array.from(d.s, Number),
    };
    if (!Rules.isSolved(p, p.solution)) throw new Error('Puzzle solution is not valid');
    return p;
  },
  newState: (p) => new Uint8Array(Rules.edgeCount(p.R, p.C)),
  saveState: (s) => Array.from(s).join(''),
  loadState(p, v) {
    const s = new Uint8Array(Rules.edgeCount(p.R, p.C));
    if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints: (p, s) => Hint.findAll(p, s),
  applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; },
  solvedText: 'One clean loop — nicely done.',
});
