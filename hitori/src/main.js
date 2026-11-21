// Hitori entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'hitori',
  name: 'Hitori',
  rules: 'Shade some cells so that no number repeats in any row or column. ' +
    'Shaded cells may not touch side by side. All white cells must form one connected area.',
  controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
  size: { min: 5, max: 10, def: 7 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({
    n: p.n,
    g: Array.from(p.nums, (v) => v.toString(36)).join(''),
    b: Array.from(p.solution, (v) => (v === Rules.BLACK ? '1' : '0')).join(''),
  }),
  decode(d) {
    const n = d?.n;
    if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== n * n || typeof d.b !== 'string' || d.b.length !== n * n) {
      throw new Error('Invalid puzzle grid');
    }
    const nums = Int8Array.from(d.g, (ch) => Number.parseInt(ch, 36));
    if (nums.some((v) => !(v >= 1))) throw new Error('Invalid numbers');
    const solution = Uint8Array.from(d.b, (ch) => (ch === '1' ? Rules.BLACK : Rules.WHITE));
    if (!Rules.isSolved(nums, n, solution)) throw new Error('Puzzle solution is not valid');
    return { n, nums, solution };
  },
  newState: (p) => new Uint8Array(p.n * p.n),
  saveState: (s) => Array.from(s).join(''),
  loadState(p, v) {
    const s = new Uint8Array(p.n * p.n);
    if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p.nums, p.n, s),
  hints: (p, s) => Hint.findAll(p, s),
  applyHint(p, s, h) { s[h.k] = h.v; },
  solvedText: 'No repeats, no touching shades, one white area — nicely done.',
});
