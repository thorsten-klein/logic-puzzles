// Star Battle entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'star-battle',
  name: 'Star Battle',
  rules: 'Place stars so that every row, every column and every outlined region holds the same number of stars ' +
    '(1 star on small boards, 2 stars from size 8). Stars never touch, not even at a corner.',
  controls: 'Click a cell once to mark it with a dot (no star), twice to place a star. Right click cycles the other way.',
  size: { min: 5, max: 9, def: 6, text: (n) => `${n} (${n >= 8 ? 2 : 1}★)` },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, k: p.k, g: Array.from(p.region, (v) => v.toString(36)).join('') }),
  decode(d) {
    const n = d?.n, k = d?.k;
    if (!Number.isInteger(n) || n < 4 || n > 14 || !(k === 1 || k === 2 || k === 3)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid regions');
    const region = Int8Array.from(d.g, (ch) => Number.parseInt(ch, 36));
    if (region.some((v) => !(v >= 0 && v < n))) throw new Error('Invalid regions');
    const p = { n, k, region };
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
  hints: (p, s) => Binary.hints(Rules.model(p), s, p.solution, 'star', null, (k) => PuzzleShell.cellName(k, p.n)),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'All stars in place — nicely done.',
});
