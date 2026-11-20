// Slitherlink grid helpers. Exposes the global `Rules`.
//
// The grid has R x C cells and (R+1) x (C+1) dots. Edges are indexed:
//   horizontal edge above cell (r, c):  H(r, c) = r * C + c        (r in 0..R)
//   vertical edge left of cell (r, c):  V(r, c) = (R+1) * C + r * (C+1) + c   (c in 0..C)
// Edge states: 0 = empty, 1 = line, 2 = cross (player says "no line").
//
// A solution is a single loop. We describe it by colouring cells
// inside (1) or outside (0). The loop is the border between the colours.

const Rules = (() => {
  const EMPTY = 0, LINE = 1, CROSS = 2;

  const H = (R, C, r, c) => r * C + c;
  const V = (R, C, r, c) => (R + 1) * C + r * (C + 1) + c;
  const edgeCount = (R, C) => (R + 1) * C + R * (C + 1);

  function cellEdges(R, C, r, c) {
    return [H(R, C, r, c), H(R, C, r + 1, c), V(R, C, r, c), V(R, C, r, c + 1)];
  }

  function vertexEdges(R, C, r, c) {
    const out = [];
    if (c > 0) out.push(H(R, C, r, c - 1));
    if (c < C) out.push(H(R, C, r, c));
    if (r > 0) out.push(V(R, C, r - 1, c));
    if (r < R) out.push(V(R, C, r, c));
    return out;
  }

  // Edge set (Uint8Array of 0/1) from a cell colouring.
  function edgesFromColors(R, C, color) {
    const col = (r, c) => (r < 0 || c < 0 || r >= R || c >= C ? 0 : color[r * C + c]);
    const e = new Uint8Array(edgeCount(R, C));
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) e[H(R, C, r, c)] = col(r - 1, c) !== col(r, c) ? 1 : 0;
    for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) e[V(R, C, r, c)] = col(r, c - 1) !== col(r, c) ? 1 : 0;
    return e;
  }

  // True if the line edges form exactly one closed loop and match clues.
  function isSolved(p, lines) {
    const { R, C, clues } = p;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cl = clues[r * C + c];
      if (cl < 0) continue;
      if (cellEdges(R, C, r, c).filter((e) => lines[e] === LINE).length !== cl) return false;
    }
    // Every dot has degree 0 or 2, and all line edges are connected.
    const W = C + 1;
    const lineAt = new Map();
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const es = vertexEdges(R, C, r, c).filter((e) => lines[e] === LINE);
      if (es.length !== 0 && es.length !== 2) return false;
      if (es.length) lineAt.set(r * W + c, es);
    }
    if (lineAt.size === 0) return false;
    const ends = (e) => {
      if (e < (R + 1) * C) { const r = Math.floor(e / C), c = e % C; return [r * W + c, r * W + c + 1]; }
      const k = e - (R + 1) * C, r = Math.floor(k / W), c = k % W;
      return [r * W + c, (r + 1) * W + c];
    };
    const start = lineAt.keys().next().value;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const v = stack.pop();
      for (const e of lineAt.get(v)) {
        for (const w of ends(e)) if (!seen.has(w)) { seen.add(w); stack.push(w); }
      }
    }
    return seen.size === lineAt.size;
  }

  return { EMPTY, LINE, CROSS, H, V, edgeCount, cellEdges, vertexEdges, edgesFromColors, isSolved };
})();
