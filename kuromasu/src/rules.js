// Kuromasu rules as a Binary model. Exposes the global `Rules`.
//
// Puzzle: { n, clues (Int8Array, 0 = none) }. YES = shaded cell.
// Rules: numbered cells stay white. A number counts the white cells it
// sees in its row and column, itself included, up to the first shaded
// cell. Shaded cells must never touch by a side. White cells are connected.

const Rules = (() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // True if all non-shaded cells form one connected area.
  function openConnected(n, s) {
    let start = -1, count = 0;
    for (let k = 0; k < n * n; k++) if (s[k] !== YES) { count++; if (start < 0) start = k; }
    if (start < 0) return true;
    const seen = new Uint8Array(n * n);
    const stack = [start];
    seen[start] = 1;
    let got = 1;
    while (stack.length) {
      const k = stack.pop();
      const r = Math.floor(k / n), c = k % n;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        const j = nr * n + nc;
        if (!seen[j] && s[j] !== YES) { seen[j] = 1; got++; stack.push(j); }
      }
    }
    return got === count;
  }

  // Cells in one direction from k, nearest first.
  function ray(n, k, [dr, dc]) {
    const out = [];
    let r = Math.floor(k / n) + dr, c = (k % n) + dc;
    while (r >= 0 && c >= 0 && r < n && c < n) { out.push(r * n + c); r += dr; c += dc; }
    return out;
  }

  function model(p) {
    const { n, clues } = p;
    const N = n * n;
    const cons = [];
    const rays = [];
    for (let k = 0; k < N; k++) {
      if (clues[k]) {
        cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells are always white.' });
        rays.push([k, DIRS.map((d) => ray(n, k, d))]);
      }
      const r = Math.floor(k / n), c = k % n;
      if (c < n - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why: () => 'Shaded cells may not touch by a side.' });
      if (r < n - 1) cons.push({ cells: [k, k + n], min: 0, max: 1, why: () => 'Shaded cells may not touch by a side.' });
    }

    function propagate(s, log) {
      let set = 0;
      for (const [k, dirs] of rays) {
        const v = clues[k];
        const white = dirs.map((cells) => { let i = 0; while (i < cells.length && s[cells[i]] === NO) { i++; } return i; });
        const open = dirs.map((cells) => { let i = 0; while (i < cells.length && s[cells[i]] !== YES) { i++; } return i; });
        const min = 1 + white.reduce((a, b) => a + b, 0);
        const max = 1 + open.reduce((a, b) => a + b, 0);
        if (min > v || max < v) return -1;
        for (let d = 0; d < 4; d++) {
          const cells = dirs[d];
          // Must see at least `need` cells this way.
          const need = v - (max - open[d]);
          const forced = cells.slice(0, Math.max(0, need)).filter((j) => s[j] === UNKNOWN);
          if (forced.length) {
            for (const j of forced) s[j] = NO;
            set += forced.length;
            if (log) log.push({ cells: forced, v: NO, at: k,
              reason: `This ${v} can not see enough cells in the other directions. These cells must be white.` });
            return set;
          }
          // Sees the most it may this way: the next cell is shaded.
          const most = v - (min - white[d]);
          const next = cells[white[d]];
          if (white[d] === most && next !== undefined && s[next] === UNKNOWN) {
            s[next] = YES;
            set++;
            if (log) log.push({ cells: [next], v: YES, at: k,
              reason: `This ${v} already sees enough cells this way. The next cell must be shaded to stop the view.` });
            return set;
          }
        }
      }
      return set;
    }

    return { N, cons, propagate, check: (s) => openConnected(n, s) };
  }

  function isSolved(p, s) {
    // Clue cells are always white; the player can not shade them.
    const t = Uint8Array.from(s, (v, k) => (v === YES && !p.clues[k] ? YES : NO));
    const m = model(p);
    if (!m.cons.every((con) => con.cells.filter((j) => t[j] === YES).length <= con.max)) return false;
    if (m.propagate(t) < 0) return false;
    return openConnected(p.n, t);
  }

  return { model, isSolved, openConnected, ray };
})();
