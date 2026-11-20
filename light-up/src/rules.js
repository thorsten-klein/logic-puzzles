// Light Up helpers. Exposes the global `Rules`.
//
// Board: `walls[k]` is -1 for a white cell, -2 for a plain black cell,
// or 0..4 for a black cell with a number.
// Player state for white cells: 0 = unknown, 1 = bulb, 2 = no bulb.

const Rules = (() => {
  const UNKNOWN = 0, BULB = 1, NONE = 2;
  const WHITE = -1, BLACK = -2;

  function neighbours(k, R, C) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  // White cells a bulb at k would light (k itself excluded).
  function sight(k, R, C, walls) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nc >= 0 && nr < R && nc < C && walls[nr * C + nc] === WHITE) {
        out.push(nr * C + nc);
        nr += dr; nc += dc;
      }
    }
    return out;
  }

  function prepare(p) {
    const { R, C, walls } = p;
    p.sight = [];
    p.nb = [];
    for (let k = 0; k < R * C; k++) {
      p.sight.push(walls[k] === WHITE ? sight(k, R, C, walls) : []);
      p.nb.push(neighbours(k, R, C));
    }
    return p;
  }

  // Which cells are lit by the bulbs in `state`.
  function litMap(p, state) {
    const lit = new Uint8Array(p.R * p.C);
    for (let k = 0; k < lit.length; k++) {
      if (state[k] !== BULB || p.walls[k] !== WHITE) continue;
      lit[k] = 1;
      for (const j of p.sight[k]) lit[j] = 1;
    }
    return lit;
  }

  function isSolved(p, state) {
    const lit = litMap(p, state);
    for (let k = 0; k < p.R * p.C; k++) {
      const w = p.walls[k];
      if (w === WHITE) {
        if (!lit[k]) return false;
        if (state[k] === BULB && p.sight[k].some((j) => state[j] === BULB)) return false;
      } else if (w >= 0 && p.nb[k].filter((j) => p.walls[j] === WHITE && state[j] === BULB).length !== w) {
        return false;
      }
    }
    return true;
  }

  return { UNKNOWN, BULB, NONE, WHITE, BLACK, prepare, litMap, isSolved };
})();
