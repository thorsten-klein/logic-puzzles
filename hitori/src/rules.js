// Hitori grid helpers. Exposes the global `Rules`.
//
// Cell states: 0 = unknown, 1 = shaded (black), 2 = white.
// Rules:
//   - no number repeats among white cells in a row or column
//   - shaded cells never touch side by side
//   - all white cells form one connected area
// We also use the usual convention: a cell is only shaded when needed,
// so each shaded number repeats a white cell in its row or column.
// Without it any shaded cell could be flipped to white and no puzzle
// would have a unique solution.

const Rules = (() => {
  const UNKNOWN = 0, BLACK = 1, WHITE = 2;

  function neighbours(k, n) {
    const r = Math.floor(k / n), c = k % n, out = [];
    if (r > 0) out.push(k - n);
    if (r < n - 1) out.push(k + n);
    if (c > 0) out.push(k - 1);
    if (c < n - 1) out.push(k + 1);
    return out;
  }

  // Cells in the same row or column as k (not k itself).
  function peers(k, n) {
    const r = Math.floor(k / n), c = k % n, out = [];
    for (let i = 0; i < n; i++) {
      if (i !== c) out.push(r * n + i);
      if (i !== r) out.push(i * n + c);
    }
    return out;
  }

  // True if all non-shaded cells are connected. `extraBlack` is treated
  // as shaded too (-1 for none).
  function openConnected(state, n, extraBlack = -1) {
    const total = n * n;
    let start = -1, count = 0;
    for (let k = 0; k < total; k++) {
      if (state[k] !== BLACK && k !== extraBlack) { count++; if (start < 0) start = k; }
    }
    if (count === 0) return true;
    const seen = new Uint8Array(total);
    const stack = [start];
    seen[start] = 1;
    let reached = 1;
    while (stack.length) {
      const k = stack.pop();
      for (const j of neighbours(k, n)) {
        if (seen[j] || state[j] === BLACK || j === extraBlack) continue;
        seen[j] = 1; reached++; stack.push(j);
      }
    }
    return reached === count;
  }

  // Checks a full shading (array of BLACK / non-BLACK) against all rules.
  function isSolved(nums, n, state) {
    for (let k = 0; k < n * n; k++) {
      if (state[k] === BLACK) {
        if (neighbours(k, n).some((j) => state[j] === BLACK)) return false;
        if (!peers(k, n).some((j) => state[j] !== BLACK && nums[j] === nums[k])) return false;
      } else if (peers(k, n).some((j) => state[j] !== BLACK && nums[j] === nums[k])) {
        return false;
      }
    }
    return openConnected(state, n);
  }

  return { UNKNOWN, BLACK, WHITE, neighbours, peers, openConnected, isSolved };
})();
