// Tents entry point. Plugs the game into the shared shell.

PuzzleShell.start({
  id: 'tents',
  name: 'Tents',
  rules: 'Place tents in the grid. Each tree has exactly one tent of its own, right next to it (not diagonal). ' +
    'Tents never touch each other, not even at a corner. The numbers tell how many tents are in each row and column.',
  controls: 'Click a cell to place a tent, click again to mark grass. Right click cycles the other way.',
  size: { min: 5, max: 12, def: 8 },
  generate: (n) => Generator.generate(n),
  encode: (p) => ({ n: p.n, t: Array.from(p.trees).join(''), r: p.rows.join(','), c: p.cols.join(',') }),
  decode(d) {
    const n = d && d.n;
    if (!Number.isInteger(n) || n < 3 || n > 20) throw new Error('Invalid board size');
    if (typeof d.t !== 'string' || d.t.length !== n * n || !/^[01]+$/.test(d.t)) throw new Error('Invalid trees');
    const nums = (s) => String(s).split(',').map(Number);
    const p = { n, trees: Uint8Array.from(d.t, Number), rows: nums(d.r), cols: nums(d.c) };
    if (p.rows.length !== n || p.cols.length !== n || [...p.rows, ...p.cols].some((x) => !(x >= 0 && x <= n))) {
      throw new Error('Invalid counts');
    }
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
    for (let k = 0; k < s.length; k++) if (p.trees[k]) s[k] = 0;
    return s;
  },
  render: (p, s, opts) => UI.render(p, s, opts),
  check: (p, s) => Rules.isSolved(p, s),
  hints(p, s) {
    // Tree cells are never marked by the player; treat them as settled.
    const t = Uint8Array.from(s, (v, k) => (p.trees[k] ? Binary.NO : v));
    return Binary.hints(Rules.model(p), t, p.solution, 'tent', null, (k) => PuzzleShell.cellName(k, p.n));
  },
  applyHint(p, s, h) { for (const k of h.cells) if (!p.trees[k]) s[k] = h.v; },
  solvedText: 'Every tree has its tent — nicely done.',
});
