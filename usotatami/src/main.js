// Usotatami. Split the grid into strips one cell wide, each holding
// exactly one number. The number is NOT the strip's length. No grid dot
// may be a corner of four strips. Built on the Rects engine.

(() => {
  const len = ([r1, c1, r2, c2]) => Math.max(r2 - r1, c2 - c1) + 1;
  const thin = ([r1, c1, r2, c2]) => r1 === r2 || c1 === c2;
  Rects.startGame({
    id: 'usotatami',
    name: 'Usotatami',
    rules: 'Divide the grid into strips that are one cell wide. Each strip holds exactly one number, ' +
      'and that number is NOT the length of the strip. No point of the grid may be a corner of four strips.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every number told a lie — nicely done.',
    fits: (p, k, rect) => thin(rect) && len(rect) !== p.clues[k],
    final: (p, rects) => Rects.noFourCorners(p, rects),
    split: (R, C) => Rects.randomSplit(R, C, 5, (h, w) => (Math.random() < 0.5 ? [1, w] : [h, 1])),
    clueFor(p, rect, cells) {
      const opts = [1, 2, 3, 4, 5].filter((v) => v !== len(rect));
      return [cells[Math.floor(Math.random() * cells.length)], opts[Math.floor(Math.random() * opts.length)]];
    },
    clueText: (v) => v,
    // Another answer exists: find a clue whose strip differs there and
    // set the clue to that other strip's length (so it becomes false).
    improve(p, rects, sols) {
      const key = (r) => r.join(',');
      const truth = new Set(rects.map(key));
      const other = sols.find((s) => s.some((r) => !truth.has(key(r))));
      if (!other) return false;
      const cand = [];
      for (const r of other) {
        if (truth.has(key(r))) continue;
        const k = Rects.cellsOf(r, p.C).find((j) => p.clues[j]);
        const mine = rects.find((x) => Rects.cellsOf(x, p.C).includes(k));
        if (k !== undefined && len(r) !== len(mine)) cand.push([k, len(r)]);
      }
      if (!cand.length) return false;
      const [k, v] = cand[Math.floor(Math.random() * cand.length)];
      p.clues[k] = v;
      return true;
    },
  });
})();
