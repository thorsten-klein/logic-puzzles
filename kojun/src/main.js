// Kojun. Regions hold 1..size; side neighbours differ; in a region the
// upper of two stacked cells is bigger. Uses the shared RegionNum engine.

RegionNum.startGame({
  id: 'kojun',
  name: 'Kojun',
  rules: 'Fill each outlined region with the numbers 1 to its size. Cells that touch by a side hold different numbers. ' +
    'Inside a region, the upper of two stacked cells holds the bigger number.',
  size: { min: 5, max: 10, def: 6 },
  maxSize: 5,
  what: 'its neighbours',
  solvedText: 'Every region in order — nicely done.',
  ok(val, region, k, R, C) {
    const v = val[k], r = Math.floor(k / C), c = k % C;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && val[nr * C + nc] === v) return false;
    }
    const up = k - C, down = k + C;
    if (r > 0 && val[up] && region[up] === region[k] && val[up] < v) return false;
    if (r < R - 1 && val[down] && region[down] === region[k] && val[down] > v) return false;
    return true;
  },
  rule(p, cand) {
    const { R, C, region } = p;
    const hi = (m) => 31 - Math.clz32(m);
    const lo = (m) => RegionNum.lowBit(m);
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      if (RegionNum.bitCount(cand[k]) === 1) {
        if (r > 0) cand[k - C] &= ~cand[k];
        if (r < R - 1) cand[k + C] &= ~cand[k];
        if (c > 0) cand[k - 1] &= ~cand[k];
        if (c < C - 1) cand[k + 1] &= ~cand[k];
      }
      // Upper > lower inside one region.
      if (r < R - 1 && region[k + C] === region[k]) {
        const below = k + C;
        cand[k] &= ~((1 << (lo(cand[below]) + 1)) - 1);
        cand[below] &= (1 << hi(cand[k])) - 1;
        if (!cand[k] || !cand[below]) return false;
      }
    }
    return true;
  },
});
