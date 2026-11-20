// Hitori generator. Makes a random Latin square, picks a random set of
// shaded cells (not touching, white area stays connected), and copies a
// number from the same row or column into each shaded cell. Then keeps
// only boards the solver proves unique. Exposes the global `Generator`.

const Generator = (() => {
  const { BLACK, neighbours, peers, openConnected } = Rules;
  const shuffle = PuzzleShell.shuffle;

  function latinSquare(n) {
    const g = new Int8Array(n * n);
    const rowUsed = new Array(n).fill(0), colUsed = new Array(n).fill(0);
    const vals = Array.from({ length: n }, (_, i) => i + 1);
    function rec(k) {
      if (k === n * n) return true;
      const r = Math.floor(k / n), c = k % n;
      for (const v of shuffle(vals.slice())) {
        const bit = 1 << v;
        if ((rowUsed[r] & bit) || (colUsed[c] & bit)) continue;
        g[k] = v; rowUsed[r] |= bit; colUsed[c] |= bit;
        if (rec(k + 1)) return true;
        rowUsed[r] &= ~bit; colUsed[c] &= ~bit;
      }
      return false;
    }
    rec(0);
    return g;
  }

  function tryOnce(n) {
    const total = n * n;
    const nums = latinSquare(n);
    const state = new Uint8Array(total);
    const target = Math.round(total * (0.2 + Math.random() * 0.08));
    let count = 0;
    for (const k of shuffle([...Array(total).keys()])) {
      if (count >= target) break;
      if (neighbours(k, n).some((j) => state[j] === BLACK)) continue;
      if (!openConnected(state, n, k)) continue;
      state[k] = BLACK;
      count++;
    }
    // Copy a white twin's number into each shaded cell.
    for (let k = 0; k < total; k++) {
      if (state[k] !== BLACK) continue;
      const opts = peers(k, n).filter((j) => state[j] !== BLACK);
      nums[k] = nums[opts[Math.floor(Math.random() * opts.length)]];
    }
    const { solutions } = Solver.solve(nums, n, 2);
    if (solutions.length !== 1) return null;
    return { n, nums, solution: solutions[0] };
  }

  function generate(n) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const p = tryOnce(n);
      if (p) return p;
    }
    return null;
  }

  return { generate, latinSquare };
})();
