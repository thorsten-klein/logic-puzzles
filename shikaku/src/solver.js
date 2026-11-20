// Shikaku solver. Each clue picks one of its rectangles; every cell is
// covered once. Logic steps: a clue with one rectangle left takes it;
// a cell only one rectangle can cover takes that one.
// Exposes the global `Solver`.

const Solver = (() => {
  // State: opts[i] = rectangles still possible for clue i (clue list order).
  function init(p) {
    const clueCells = [];
    for (let k = 0; k < p.R * p.C; k++) if (p.clues[k]) clueCells.push(k);
    return { clueCells, opts: clueCells.map((k) => Rules.options(p, k)), chosen: clueCells.map(() => null) };
  }

  const overlaps = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);

  // Fixes clue i to rect and drops clashing options elsewhere.
  function choose(st, i, rect) {
    st.chosen[i] = rect;
    st.opts[i] = [rect];
    for (let j = 0; j < st.opts.length; j++) {
      if (j !== i) st.opts[j] = st.opts[j].filter((o) => !overlaps(o, rect));
    }
  }

  // One logic step. Returns { i, rect, why } or null; false if broken.
  function step(p, st) {
    for (let i = 0; i < st.opts.length; i++) {
      if (!st.opts[i].length) return false;
      if (!st.chosen[i] && st.opts[i].length === 1) return { i, rect: st.opts[i][0], why: 'one' };
    }
    const N = p.R * p.C;
    const who = Array.from({ length: N }, () => []);
    st.opts.forEach((list, i) => list.forEach((rect) => {
      for (const j of Rules.cellsOf(rect, p.C)) who[j].push([i, rect]);
    }));
    for (let j = 0; j < N; j++) {
      if (!who[j].length) return false;
      const clues = new Set(who[j].map(([i]) => i));
      if (clues.size === 1) {
        const i = who[j][0][0];
        if (st.chosen[i]) continue;
        // Keep only this clue's rectangles that cover cell j.
        const keep = st.opts[i].filter((rect) => Rules.cellsOf(rect, p.C).includes(j));
        if (keep.length < st.opts[i].length) {
          if (keep.length === 1) return { i, rect: keep[0], why: 'cell', cell: j };
          st.opts[i] = keep;
          return { i, narrowed: true };
        }
      }
    }
    return null;
  }

  function logicSolve(p) {
    const st = init(p);
    for (;;) {
      const m = step(p, st);
      if (m === false) return null;
      if (!m) break;
      if (m.rect) choose(st, m.i, m.rect);
    }
    return st.chosen.every(Boolean) ? st.chosen : null;
  }

  // Returns { count, first } with count capped at stopAt.
  function countSolutions(p, stopAt = 2) {
    let found = 0, first = null;
    (function rec(st) {
      if (found >= stopAt) return;
      for (;;) {
        const m = step(p, st);
        if (m === false) return;
        if (!m) break;
        if (m.rect) choose(st, m.i, m.rect);
      }
      const i = st.chosen.findIndex((x) => !x);
      if (i < 0) { if (!found) first = st.chosen.slice(); found++; return; }
      for (const rect of st.opts[i]) {
        const copy = { clueCells: st.clueCells, opts: st.opts.map((o) => o.slice()), chosen: st.chosen.slice() };
        choose(copy, i, rect);
        rec(copy);
      }
    })(init(p));
    return { count: found, first };
  }

  return { init, choose, step, logicSolve, countSolutions };
})();
