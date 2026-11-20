// Fill-a-Pix helpers. Exposes the global `Rules`.
// Cell states: 0 = unknown, 1 = filled, 2 = marked empty.
// Each clue counts the filled cells in its 3x3 block (itself included).

const Rules = (() => {
  const UNKNOWN = 0, FILLED = 1, EMPTY = 2;

  // Cells of the 3x3 block around k.
  function block(k, R, C) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
    }
    return out;
  }

  function isSolved(p, state) {
    for (let k = 0; k < p.R * p.C; k++) {
      if (p.clues[k] < 0) continue;
      if (block(k, p.R, p.C).filter((j) => state[j] === FILLED).length !== p.clues[k]) return false;
    }
    return true;
  }

  return { UNKNOWN, FILLED, EMPTY, block, isSolved };
})();
