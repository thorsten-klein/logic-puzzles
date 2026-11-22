// Slitherlink hints from the player's lines and crosses.
// Wrong marks come first, then simple clue and dot rules.
// If nothing simple is left, one edge of the solution is shown.
// Exposes the global `Hint`.

const Hint = (() => {
  const { EMPTY, LINE, CROSS, cellEdges, vertexEdges } = Rules;

  function findAll(p, edges) {
    const { R, C, clues, solution } = p;
    const out = [];
    const seen = new Set();
    const add = (list, v, reason) => {
      const todo = list.filter((e) => edges[e] === EMPTY && !seen.has(e));
      if (!todo.length) return;
      todo.forEach((e) => seen.add(e));
      out.push({ edges: todo, v, reason });
    };

    for (let e = 0; e < edges.length; e++) {
      if (edges[e] === LINE && !solution[e]) out.push({ edges: [e], v: CROSS, reason: 'This line is wrong.' });
      if (edges[e] === CROSS && solution[e]) out.push({ edges: [e], v: LINE, reason: 'This cross is wrong. A line goes here.' });
    }
    if (out.length) return out;

    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cl = clues[r * C + c];
      if (cl < 0) continue;
      const es = cellEdges(R, C, r, c);
      const lines = es.filter((e) => edges[e] === LINE).length;
      const open = es.filter((e) => edges[e] === EMPTY);
      if (!open.length) continue;
      if (lines === cl) add(open, CROSS, `This ${cl} already has ${PuzzleShell.plural(cl, 'line')}. The other sides get crosses.`);
      else if (lines + open.length === cl) add(open, LINE, `This ${cl} needs a line on every side that is still open.`);
    }

    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const es = vertexEdges(R, C, r, c);
      const lines = es.filter((e) => edges[e] === LINE).length;
      const open = es.filter((e) => edges[e] === EMPTY);
      if (!open.length) continue;
      if (lines === 2) add(open, CROSS, 'Two lines already meet at this dot. No more lines can touch it.');
      else if (lines === 1 && open.length === 1) add(open, LINE, 'A line ends at this dot. It must go on through the only open side.');
      else if (lines === 0 && open.length === 1) add(open, CROSS, 'Only one side of this dot is open. A loop can not pass through, so cross it.');
    }

    if (!out.length) {
      const e = solution.findIndex((v, i) => v && edges[i] !== LINE);
      if (e >= 0) out.push({ edges: [e], v: LINE, reason: 'No simple step is left. Here is one line of the solution.' });
    }
    return out;
  }

  return { findAll };
})();
