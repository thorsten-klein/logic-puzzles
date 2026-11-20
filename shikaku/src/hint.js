// Shikaku hints: wrong rectangles first, then logic steps.
// Exposes the global `Hint`.

const Hint = (() => {
  const key = (r) => r.join(',');

  function findAll(p, rects) {
    const good = new Set(p.solution.map(key));
    const out = [];
    rects.forEach((rect, i) => {
      if (!good.has(key(rect))) out.push({ remove: i, cells: Rules.cellsOf(rect, p.C), reason: 'This rectangle is wrong.' });
    });
    if (out.length) return out;

    const st = Solver.init(p);
    const placed = new Set(rects.map(key));
    st.clueCells.forEach((k, i) => {
      const rect = p.solution[i];
      if (placed.has(key(rect))) Solver.choose(st, i, rect);
    });
    for (let guard = 0; guard < 500; guard++) {
      const m = Solver.step(p, st);
      if (!m) break;
      if (!m.rect) continue;
      const v = p.clues[st.clueCells[m.i]];
      out.push({ add: m.rect, cells: Rules.cellsOf(m.rect, p.C), clue: st.clueCells[m.i],
        reason: m.why === 'one'
          ? `This ${v} fits in only one rectangle.`
          : `Only this ${v} can cover the marked cell, and only this rectangle does it.` , mark: m.cell });
      break;
    }
    return out;
  }

  return { findAll };
})();
