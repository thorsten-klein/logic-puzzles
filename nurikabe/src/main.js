// Nurikabe entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'nurikabe',
  name: 'Nurikabe',
  rules: 'Shade the sea. Each number belongs to one white island of exactly that many cells, and every island has one number. ' +
    'All sea cells are connected. The sea may not fill any 2×2 block.',
  controls: 'Click a cell to shade it as sea, click again to mark it island. Right click cycles the other way.',
  size: { min: 5, max: 8, def: 7 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, g: Array.from(p.clues, (v) => v.toString(36)).join('') }),
  decode(d) {
    const n = d?.n;
    if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid clues');
    const clues = Int8Array.from(d.g, (ch) => Number.parseInt(ch, 36));
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
    return Binary.hints(Rules.model(p), t, p.solution, 'sea cell', 'island cell', (k) => PuzzleShell.cellName(k, p.n));
  },
  applyHint(p, s, h) { for (const k of h.cells) if (!p.clues[k]) s[k] = h.v; },
  solvedText: 'Islands and sea in place — nicely done.',
});
