// Suguru. Regions hold 1..size; equal numbers never touch, not even
// at a corner. Uses the shared RegionNum engine.

RegionNum.startGame({
  id: 'suguru',
  name: 'Suguru',
  rules: 'Fill each outlined region with the numbers 1 to its size (a region of 4 cells holds 1, 2, 3, 4). ' +
    'Equal numbers may never touch, not even at a corner.',
  size: { min: 5, max: 10, def: 7 },
  maxSize: 5,
  what: 'the touching cells',
  solvedText: 'No twins touching — nicely done.',
  ok(val, region, k, R, C) {
    const r = Math.floor(k / C), c = k % C;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C && val[nr * C + nc] === val[k]) return false;
    }
    return true;
  },
  rule(p, cand) {
    const { R, C } = p;
    for (let k = 0; k < R * C; k++) {
      if (RegionNum.bitCount(cand[k]) !== 1) continue;
      const r = Math.floor(k / C), c = k % C;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) cand[nr * C + nc] &= ~cand[k];
      }
    }
    return true;
  },
});
