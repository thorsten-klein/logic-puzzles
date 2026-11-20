// Masyu. Draw one loop through cell centres that visits every pearl.
// At a white pearl the loop goes straight, and turns in the cell just
// before or just after it (or both). At a black pearl the loop turns,
// and goes straight for two cells on both sides.
// Built on the shared LegLoop code (no numbers).

(() => {
  const { CROSS } = LegLoop;
  const open = (g, s, k, d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] !== CROSS;
  LegLoop.startGame({
    id: 'masyu',
    name: 'Masyu',
    rules: 'Draw one closed loop through the centres of cells that visits every pearl. At a white pearl the loop goes ' +
      'straight through, and turns in the cell just before or just after it (or both). At a black pearl the loop turns, ' +
      'and goes straight through the next cell on both sides.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'A string of pearls — nicely done.',
    noNumbers: true,
    allowSearch: true,
    loopFill: 0.7,
    thinLoop: true,
    kindOf: (turn, a, b) => (turn ? (a >= 2 && b >= 2 ? 'b' : '') : (a === 1 || b === 1 ? 'w' : '')),
    // Forced lines at pearls. Sides: 0 up, 1 down, 2 left, 3 right.
    step(p, g, s, log) {
      const { LINE } = LegLoop;
      const step = [-p.C, p.C, -1, 1];
      const edge = (k, d) => (k < 0 ? -1 : g.cellEdges[k][d]);
      const cell = (k, d) => (edge(k, d) >= 0 ? k + step[d] : -1);
      const isOpen = (e) => e >= 0 && s[e] !== CROSS;
      const set = (edges, v, reason) => {
        const todo = edges.filter((e) => s[e] !== v);
        if (todo.some((e) => e < 0 || s[e] !== 0)) return false;
        if (!todo.length) return 0;
        for (const e of todo) s[e] = v;
        if (log) log.push({ edges: todo, v, reason });
        return todo.length;
      };
      for (let k = 0; k < p.R * p.C; k++) {
        const kind = p.kind[k];
        if (kind === 'b') {
          for (let d = 0; d < 4; d++) {
            const e1 = edge(k, d), e2 = edge(cell(k, d), d);
            // This side can not hold two straight steps: go the other way.
            const blocked = !isOpen(e1) || !isOpen(e2) ||
              [d ^ 1].some(() => { const n1 = cell(k, d); const perp = d < 2 ? [2, 3] : [0, 1]; return perp.some((q) => s[edge(n1, q)] === LINE); });
            if (blocked) {
              const f1 = edge(k, d ^ 1), f2 = edge(cell(k, d ^ 1), d ^ 1);
              const r = set([f1, f2], LINE, 'A black pearl goes straight for two cells on one side of each pair, and this side is blocked.');
              if (r) return r;
              if (isOpen(e1) && s[e1] !== CROSS) { const r2 = set([e1], CROSS, 'The black pearl leaves the other way.'); if (r2) return r2; }
            }
            if (s[e1] === LINE) {
              const r = set([e2], LINE, 'A black pearl goes straight through the next cell.');
              if (r) return r;
              if (edge(k, d ^ 1) >= 0) { const r2 = set([edge(k, d ^ 1)], CROSS, 'A black pearl turns, so it can not go straight on.'); if (r2) return r2; }
            }
          }
        } else if (kind === 'w') {
          for (const axis of [[0, 1], [2, 3]]) {
            const other = axis[0] === 0 ? [2, 3] : [0, 1];
            if (axis.some((d) => !isOpen(edge(k, d)))) {
              const r = set(other.map((d) => edge(k, d)), LINE, 'A white pearl goes straight through, and this way is blocked.');
              if (r) return r;
            }
            if (axis.some((d) => s[edge(k, d)] === LINE)) {
              const r = set(axis.map((d) => edge(k, d)), LINE, 'A white pearl goes straight through.');
              if (r) return r;
            }
          }
        }
      }
      return 0;
    },
    fits(kind, info, k, g, s) {
      const { dirs, legs, turn } = info;
      if (kind === 'w') {
        if (dirs.length === 2) return !turn && !(legs[0].len >= 2 && legs[1].len >= 2);
        if (dirs.length === 1) return open(g, s, k, dirs[0] ^ 1);
        return true;
      }
      if (dirs.length === 2 && !turn) return false;
      if (legs.some((l) => l.final && l.len < 2)) return false;
      if (dirs.length === 1) {
        if (open(g, s, k, dirs[0] ^ 1) && g.cellEdges[k][dirs[0] ^ 1] >= 0 && s[g.cellEdges[k][dirs[0] ^ 1]] === LegLoop.LINE) return false;
        return dirs[0] < 2 ? open(g, s, k, 2) || open(g, s, k, 3) : open(g, s, k, 0) || open(g, s, k, 1);
      }
      return true;
    },
  });
})();
