// Hakyuu (Ripple Effect). Regions hold 1..size; two equal numbers v in
// a row or column need at least v other cells between them.
// Uses the shared RegionNum engine.

RegionNum.startGame({
  id: 'hakyuu',
  name: 'Hakyuu',
  rules: 'Fill each outlined room with the numbers 1 to its size. If the same number N appears twice in a row ' +
    'or column, at least N other cells must sit between them.',
  size: { min: 5, max: 10, def: 7 },
  maxSize: 5,
  what: 'the ripple rule',
  solvedText: 'Ripples spread out nicely — well done.',
  ok(val, region, k, R, C) {
    const v = val[k], r = Math.floor(k / C), c = k % C;
    for (let d = 1; d <= v; d++) {
      for (const [nr, nc] of [[r - d, c], [r + d, c], [r, c - d], [r, c + d]]) {
        if (nr >= 0 && nc >= 0 && nr < R && nc < C && val[nr * C + nc] === v) return false;
      }
    }
    return true;
  },
  rule(p, cand) {
    const { R, C } = p;
    for (let k = 0; k < R * C; k++) {
      if (RegionNum.bitCount(cand[k]) !== 1) continue;
      const v = RegionNum.lowBit(cand[k]);
      const r = Math.floor(k / C), c = k % C;
      for (let d = 1; d <= v; d++) {
        for (const [nr, nc] of [[r - d, c], [r + d, c], [r, c - d], [r, c + d]]) {
          if (nr >= 0 && nc >= 0 && nr < R && nc < C) cand[nr * C + nc] &= ~cand[k];
        }
      }
    }
    return true;
  },
});
