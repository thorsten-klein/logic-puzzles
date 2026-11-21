// Oases. Shade some cells. White cells stay connected, shaded cells
// never touch by a side, and no 2x2 block is all white. Circles stay
// white. A circled number counts the other circles reachable from it
// through empty white cells (not through other circles).
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Cells next to cell k (by a side).
  function neighbours(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  function model(p) {
    const { R, C, nums } = p;
    const N = R * C;
    const nb = (k) => neighbours(R, C, k);
    const cons = [];
    for (let k = 0; k < N; k++) {
      if (nums[k] >= 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Circles stay white.' });
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Shaded cells must never touch by a side.';
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
      if (r < R - 1 && c < C - 1) cons.push({ cells: [k, k + 1, k + C, k + C + 1], min: 1, max: 2, why: () => 'No 2×2 block may be all white.' });
    }
    // Circles reached from k through empty cells that pass `ok`.
    const reached = (k, ok) => {
      const seen = new Set([k]), stack = [k], found = new Set();
      while (stack.length) {
        const x = stack.pop();
        for (const j of nb(x)) {
          if (seen.has(j)) continue;
          seen.add(j);
          if (nums[j] >= 0) { found.add(j); continue; }
          if (ok(j)) stack.push(j);
        }
      }
      return found.size;
    };
    function check(s) {
      if (!Binary.canConnect(R, C, s, NO)) return false;
      for (let k = 0; k < N; k++) {
        const v = nums[k];
        if (v < 0) continue;
        // Low: only through white cells; high: through white or open.
        const lowSet = new Set(), stack = [k], seen = new Set([k]);
        while (stack.length) {
          const x = stack.pop();
          for (const j of nb(x)) {
            if (seen.has(j)) continue;
            seen.add(j);
            if (nums[j] >= 0) { if (x === k || s[x] === NO) lowSet.add(j); continue; }
            if (s[j] === NO) stack.push(j);
          }
        }
        if (lowSet.size > v) return false;
        if (reached(k, (j) => s[j] !== YES) < v) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const blank = { R, C, nums: new Int8Array(N).fill(-1) };
      const sol = Binary.randomFill(model(blank), 0.4, 3);
      if (!sol) continue;
      const nums = new Int8Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (sol[k] === NO && Math.random() < 0.25) nums[k] = 0;
      const p = { R, C, nums };
      // Count circles reachable through white, uncircled cells.
      const nb = (k) => neighbours(R, C, k);
      for (let k = 0; k < N; k++) {
        if (nums[k] < 0) continue;
        const seen = new Set([k]), stack = [k], found = new Set();
        while (stack.length) {
          const x = stack.pop();
          for (const j of nb(x)) {
            if (seen.has(j) || sol[j] === YES) continue;
            seen.add(j);
            if (nums[j] >= 0) { found.add(j); continue; }
            stack.push(j);
          }
        }
        nums[k] = found.size;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) {
        const res = Binary.solve(model(p), 2, 20000);
        if (res.solutions.length !== 1 || res.capped) continue;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'oases',
    name: 'Oases',
    rules: 'Shade some cells. All white cells stay connected, shaded cells never touch by a side, and no 2×2 block ' +
      'is all white. Circles stay white. A circled number tells how many other circles can be reached from it through ' +
      'empty white cells (the path may not pass through another circle).',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'All oases found — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.nums, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid circles');
      return { R, C, nums: Int16Array.from({ length: R * C }, (_, k) => (d.g[2 * k] === '.' ? -1 : Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36))) };
    },
    model,
    fixed: (p, k) => (p.nums[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.nums[k] >= 0) { el.textContent = p.nums[k]; el.classList.add('oasis'); } },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'oa-board',
  });
})();
