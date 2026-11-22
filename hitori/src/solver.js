// Hitori solver: constraint propagation plus backtracking.
// Counts solutions up to `stopAt`. Exposes the global `Solver`.

const Solver = (() => {
  const { UNKNOWN, BLACK, WHITE, neighbours, peers, openConnected } = Rules;

  // Applies forced moves until nothing changes.
  // Returns false on a contradiction.
  function propagate(nums, n, state, nb, pr) {
    const total = n * n;
    let changed = true;
    while (changed) {
      changed = false;
      for (let k = 0; k < total; k++) {
        if (state[k] === BLACK) {
          for (const j of nb[k]) {
            if (state[j] === BLACK) return false;
            if (state[j] === UNKNOWN) { state[j] = WHITE; changed = true; }
          }
          // A shaded number must repeat a possible white cell.
          if (!pr[k].some((j) => state[j] !== BLACK && nums[j] === nums[k])) return false;
        } else if (state[k] === WHITE) {
          for (const j of pr[k]) {
            if (nums[j] !== nums[k]) continue;
            if (state[j] === WHITE) return false;
            if (state[j] === UNKNOWN) { state[j] = BLACK; changed = true; }
          }
        } else if (!pr[k].some((j) => state[j] !== BLACK && nums[j] === nums[k])) {
          // Unknown: white if its number has no open twin in its lines.
          state[k] = WHITE; changed = true;
        }
      }
      if (!openConnected(state, n)) return false;
    }
    return true;
  }

  function solve(nums, n, stopAt = 2, start = null) {
    const total = n * n;
    const nb = [], pr = [];
    for (let k = 0; k < total; k++) { nb.push(neighbours(k, n)); pr.push(peers(k, n)); }
    const solutions = [];
    let nodes = 0;

    function rec(s) {
      if (solutions.length >= stopAt || ++nodes > 200000) return;
      if (!propagate(nums, n, s, nb, pr)) return;
      let pick = -1;
      for (let k = 0; k < total; k++) if (s[k] === UNKNOWN) { pick = k; break; }
      if (pick < 0) { solutions.push(Uint8Array.from(s)); return; }
      for (const v of [BLACK, WHITE]) {
        const copy = Uint8Array.from(s);
        copy[pick] = v;
        rec(copy);
      }
    }

    rec(start ? Uint8Array.from(start) : new Uint8Array(total));
    return { solutions, capped: nodes > 200000 };
  }

  return { solve, propagate };
})();
