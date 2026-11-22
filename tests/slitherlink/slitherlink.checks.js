// Extra checks for Slitherlink, used by tests/games.spec.js (shared tests: lib/suite.js).

// The lines form one loop on the dots. Each number tells how many of its
// four sides are lines. Edge layout: see slitherlink/src/rules.js.
module.exports = {
  answer(p) {
    const { R, C, clues, solution: s } = p, out = [];
    const H = (r, c) => r * C + c, V = (r, c) => (R + 1) * C + r * (C + 1) + c;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const lines = s[H(r, c)] + s[H(r + 1, c)] + s[V(r, c)] + s[V(r, c + 1)];
      const clue = clues[r * C + c];
      if (clue >= 0 && clue !== lines) out.push(`cell ${r * C + c}: clue ${clue}, ${lines} lines`);
    }
    // Dots: (R+1) × (C+1). Every dot has 0 or 2 lines, all in one loop.
    const D = C + 1, adj = Array.from({ length: (R + 1) * D }, () => []);
    const join = (e, a, b) => { if (s[e] === 1) { adj[a].push(b); adj[b].push(a); } };
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) join(H(r, c), r * D + c, r * D + c + 1);
    for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) join(V(r, c), r * D + c, (r + 1) * D + c);
    adj.forEach((a, k) => { if (a.length && a.length !== 2) out.push(`dot ${k} has ${a.length} lines`); });
    const start = adj.findIndex((a) => a.length);
    const seen = new Set([start]), stack = [start];
    while (stack.length) for (const j of adj[stack.pop()]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
    if (seen.size !== adj.filter((a) => a.length).length) out.push('more than one loop');
    return out;
  },
};
