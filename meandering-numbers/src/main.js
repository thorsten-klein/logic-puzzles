// Meandering Numbers. Fill each region with the numbers 1 to its size.
// Equal numbers never touch, not even at a corner. Inside a region, each
// number touches the next one by a side, so 1, 2, 3, ... form a path.
// Uses the shared RegionNum engine.

RegionNum.startGame({
  id: 'meandering-numbers',
  name: 'Meandering Numbers',
  rules: 'Fill each outlined region with the numbers 1 to its size. Equal numbers never touch, not even at a corner. ' +
    'Inside a region, every number touches the next one by a side, so 1, 2, 3, … form a path through the region.',
  size: { min: 4, max: 6, def: 6 },
  maxSize: 5,
  what: 'its neighbours and its region',
  solvedText: 'A winding path in every region — nicely done.',
  ok(val, region, k, R, C) {
    const v = val[k], r = Math.floor(k / C), c = k % C;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const a = r + dr, b = c + dc;
      if ((dr || dc) && a >= 0 && b >= 0 && a < R && b < C && val[a * C + b] === v) return false;
    }
    // v - 1 and v + 1 of the same region must sit next to v (by a side).
    const side = new Set([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => a * C + b));
    for (let j = 0; j < R * C; j++) {
      if (j === k || region[j] !== region[k] || !val[j]) continue;
      if (Math.abs(val[j] - v) === 1 && !side.has(j)) return false;
    }
    return true;
  },
  rule(p, cand) {
    const { R, C, region } = p;
    const one = (m) => RegionNum.bitCount(m) === 1;
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const around = [], side = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if ((!dr && !dc) || a < 0 || b < 0 || a >= R || b >= C) continue;
        around.push(a * C + b);
        if (!dr || !dc) side.push(a * C + b);
      }
      if (one(cand[k])) for (const j of around) cand[j] &= ~cand[k];
      // Each value needs its neighbours v - 1 and v + 1 beside it (same region).
      const size = p.groups[region[k]].length;
      for (const v of RegionNum.values(cand[k])) {
        const mates = side.filter((j) => region[j] === region[k]);
        const needDown = v > 1 && !mates.some((j) => cand[j] & (1 << (v - 1)));
        const needUp = v < size && !mates.some((j) => cand[j] & (1 << (v + 1)));
        if (needDown || needUp) cand[k] &= ~(1 << v);
      }
      if (!cand[k]) return false;
    }
    return true;
  },
});
