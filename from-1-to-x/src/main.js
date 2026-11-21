// From 1 To X. Fill each region with 1 to its size. Equal numbers never
// touch by a side. The numbers outside give each row's and column's sum.
// Uses the shared RegionNum engine.

(() => {
  const hi = (m) => 31 - Math.clz32(m);
  const lo = (m) => RegionNum.lowBit(m);

  function lines(p) {
    const out = [];
    for (let c = 0; c < p.C; c++) out.push([p.sums[c], Array.from({ length: p.R }, (_, r) => r * p.C + c)]);
    for (let r = 0; r < p.R; r++) out.push([p.sums[p.C + r], Array.from({ length: p.C }, (_, c) => r * p.C + c)]);
    return out;
  }

  RegionNum.startGame({
    id: 'from-1-to-x',
    name: 'From 1 To X',
    rules: 'Fill each outlined region with the numbers 1 to its size (a region of 3 cells holds 1, 2, 3). ' +
      'Equal numbers never touch by a side. The numbers outside give the sum of each row and column.',
    size: { min: 4, max: 8, def: 6 },
    maxSize: 5,
    what: 'the sums',
    solvedText: 'Every sum adds up — nicely done.',
    ok(val, region, k, R, C) {
      const r = Math.floor(k / C), c = k % C;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .every(([a, b]) => a < 0 || b < 0 || a >= R || b >= C || val[a * C + b] !== val[k]);
    },
    setup(p, sol) {
      p.sums = [];
      for (let c = 0; c < p.C; c++) { let t = 0; for (let r = 0; r < p.R; r++) { t += sol[r * p.C + c]; } p.sums.push(t); }
      for (let r = 0; r < p.R; r++) { let t = 0; for (let c = 0; c < p.C; c++) { t += sol[r * p.C + c]; } p.sums.push(t); }
    },
    rule(p, cand) {
      const { R, C } = p;
      for (let k = 0; k < R * C; k++) {
        if (RegionNum.bitCount(cand[k]) !== 1) continue;
        const r = Math.floor(k / C), c = k % C;
        if (r > 0) cand[k - C] &= ~cand[k];
        if (r < R - 1) cand[k + C] &= ~cand[k];
        if (c > 0) cand[k - 1] &= ~cand[k];
        if (c < C - 1) cand[k + 1] &= ~cand[k];
      }
      for (const [want, cells] of lines(p)) {
        if (cells.some((k) => !cand[k])) return false;
        const sMin = cells.reduce((a, k) => a + lo(cand[k]), 0), sMax = cells.reduce((a, k) => a + hi(cand[k]), 0);
        if (sMin > want || sMax < want) return false;
        for (const k of cells) {
          const low = want - (sMax - hi(cand[k])), high = want - (sMin - lo(cand[k]));
          for (let v = 1; v < 31; v++) if ((cand[k] & (1 << v)) && (v < low || v > high)) cand[k] &= ~(1 << v);
          if (!cand[k]) return false;
        }
      }
      return true;
    },
    edge: (p) => ({ top: p.sums.slice(0, p.C), left: p.sums.slice(p.C) }),
    encodeExtra: (p) => p.sums.join(','),
    decodeExtra(p, x) {
      const sums = String(x).split(',').map(Number);
      if (sums.length !== p.R + p.C || sums.some((v) => !Number.isInteger(v) || v < 0)) throw new Error('Invalid sums');
      p.sums = sums;
    },
  });
})();
