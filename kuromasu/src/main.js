// Kuromasu entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'kuromasu',
  name: 'Kuromasu',
  rules: 'Shade some cells. Numbered cells stay white. A number tells how many white cells it sees in its row and column, ' +
    'itself included — the view stops at a shaded cell. Shaded cells never touch by a side, and all white cells are connected.',
  controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
  size: { min: 5, max: 11, def: 7 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, g: Array.from(p.clues, (v) => v.toString(36)).join('') }),
  decode(d) {
    const n = d && d.n;
    if (!Number.isInteger(n) || n < 3 || n > 18) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid clues');
    const clues = Int8Array.from(d.g, (ch) => parseInt(ch, 36));
    if (clues.some((v) => !(v >= 0))) throw new Error('Invalid clues');
    const p = { n, clues };
    const res = Binary.solveFull(Rules.model(p));
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
    const t = Uint8Array.from(s, (v, k) => (p.clues[k] ? Binary.NO : v));
    return Binary.hints(Rules.model(p), t, p.solution, 'shaded cell', 'white cell', (k) => PuzzleShell.cellName(k, p.n));
  },
  applyHint(p, s, h) { for (const k of h.cells) if (!p.clues[k]) s[k] = h.v; },
  solvedText: 'Every view counts out — nicely done.',
});
