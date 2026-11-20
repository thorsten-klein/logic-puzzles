// Shikaku helpers. Exposes the global `Rules`.
//
// Puzzle: { R, C, clues (Int8Array, 0 = none) }.
// A rectangle is [r1, c1, r2, c2] (inclusive corners).

const Rules = (() => {
  function cellsOf([r1, c1, r2, c2], C) {
    const out = [];
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(r * C + c);
    return out;
  }

  // Every rectangle that could belong to the clue at k.
  function options(p, k) {
    const { R, C, clues } = p;
    const v = clues[k], r0 = Math.floor(k / C), c0 = k % C;
    const out = [];
    for (let h = 1; h <= v; h++) {
      if (v % h) continue;
      const w = v / h;
      for (let r1 = r0 - h + 1; r1 <= r0; r1++) for (let c1 = c0 - w + 1; c1 <= c0; c1++) {
        const r2 = r1 + h - 1, c2 = c1 + w - 1;
        if (r1 < 0 || c1 < 0 || r2 >= R || c2 >= C) continue;
        const rect = [r1, c1, r2, c2];
        if (cellsOf(rect, C).every((j) => j === k || !clues[j])) out.push(rect);
      }
    }
    return out;
  }

  // Rectangle id per cell (-1 = none) for a list of rectangles.
  function cover(p, rects) {
    const id = new Int32Array(p.R * p.C).fill(-1);
    rects.forEach((rect, i) => { for (const j of cellsOf(rect, p.C)) id[j] = i; });
    return id;
  }

  function isSolved(p, rects) {
    const N = p.R * p.C;
    const count = new Int32Array(N);
    for (const rect of rects) for (const j of cellsOf(rect, p.C)) count[j]++;
    if (count.some((x) => x !== 1)) return false;
    return rects.every((rect) => {
      const nums = cellsOf(rect, p.C).filter((j) => p.clues[j]);
      return nums.length === 1 && p.clues[nums[0]] === cellsOf(rect, p.C).length;
    });
  }

  return { cellsOf, options, cover, isSolved };
})();
