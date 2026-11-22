// Shikaku generator. Splits the grid into random rectangles, puts the
// area in a random cell of each, and keeps boards logic can solve.
// Exposes the global `Generator`.

const Generator = (() => {
  function split(R, C) {
    const id = new Int32Array(R * C).fill(-1);
    const rects = [];
    for (let k = 0; k < R * C; k++) {
      if (id[k] >= 0) continue;
      const r = Math.floor(k / C), c = k % C;
      // Widest free run to the right.
      let maxW = 0;
      while (c + maxW < C && id[r * C + c + maxW] < 0) maxW++;
      const w = 1 + Math.floor(Math.random() * Math.min(maxW, 4));
      let maxH = 0;
      while (r + maxH < R && [...new Array(w).keys()].every((i) => id[(r + maxH) * C + c + i] < 0)) maxH++;
      let h = 1 + Math.floor(Math.random() * Math.min(maxH, 4));
      if (w * h === 1 && Math.random() < 0.8) {
        if (maxH > 1) h = 2;
      }
      const rect = [r, c, r + h - 1, c + w - 1];
      for (const j of Rules.cellsOf(rect, C)) id[j] = rects.length;
      rects.push(rect);
    }
    return rects;
  }

  function generate(n) {
    const R = n, C = n;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const rects = split(R, C);
      if (rects.length < (R * C) / 7) continue;
      if (rects.filter((x) => Rules.cellsOf(x, C).length === 1).length > n / 3) continue;
      const clues = new Int8Array(R * C);
      for (const rect of rects) {
        const cells = Rules.cellsOf(rect, C);
        clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      }
      const p = { R, C, clues };
      const sol = Solver.logicSolve(p);
      if (!sol) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  return { generate };
})();
