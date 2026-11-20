// Numbrix entry point. Uses the shared NumberPath engine (no diagonals).

PuzzleShell.start({
  id: 'numbrix',
  name: 'Numbrix',
  rules: 'Fill the grid with the numbers 1 to N (N = number of cells). Each next number must sit right next to ' +
    'the one before it — up, down, left or right, never diagonal.',
  controls: 'Click a cell and type a number. Arrow keys move between cells.',
  size: { min: 4, max: 9, def: 6 },
  generate: (n) => NumberPath.makePuzzle(n, n, false, 0.1),
  encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.given).join(',') }),
  decode: (d) => Game.decode(d, false),
  newState: (p) => new Int32Array(p.R * p.C),
  saveState: (s) => Array.from(s).join(','),
  loadState: (p, v) => Game.loadState(p, v),
  render: (p, s, opts) => NumberPath.render(p, s, opts),
  check: (p, s) => NumberPath.isSolved(p, s),
  hints: (p, s) => NumberPath.hints(p, s),
  applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  solvedText: 'One unbroken path — nicely done.',
});
