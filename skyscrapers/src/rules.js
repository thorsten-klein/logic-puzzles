// Skyscrapers helpers. Exposes the global `Rules`.
//
// Clues: one array of 4n numbers (0 = no clue), in this order:
//   top (columns, looking down), bottom (looking up),
//   left (rows, looking right), right (looking left).

const Rules = (() => {
  // Lines as [clue index, cells in viewing order].
  function lines(n) {
    const out = [];
    for (let c = 0; c < n; c++) out.push([c, Array.from({ length: n }, (_, i) => i * n + c)]);
    for (let c = 0; c < n; c++) out.push([n + c, Array.from({ length: n }, (_, i) => (n - 1 - i) * n + c)]);
    for (let r = 0; r < n; r++) out.push([2 * n + r, Array.from({ length: n }, (_, i) => r * n + i)]);
    for (let r = 0; r < n; r++) out.push([3 * n + r, Array.from({ length: n }, (_, i) => r * n + n - 1 - i)]);
    return out;
  }

  function visible(vals) {
    let seen = 0, top = 0;
    for (const v of vals) if (v > top) { top = v; seen++; }
    return seen;
  }

  function cluesFor(n, grid) {
    const clues = new Array(4 * n).fill(0);
    for (const [i, cells] of lines(n)) clues[i] = visible(cells.map((k) => grid[k]));
    return clues;
  }

  function makePrune(p) {
    const list = lines(p.n).filter(([i]) => p.clues[i]);
    return (cand) => {
      for (const [i, cells] of list) {
        const want = p.clues[i];
        const ok = (vals) => visible(vals) === want;
        // Stop early once more buildings are seen than allowed.
        ok.partial = (vals, j) => visible(vals.slice(0, j + 1)) <= want;
        if (!Latin.filterGroup(cells, cand, ok)) return false;
        for (const k of cells) if (!cand[k]) return false;
      }
      return true;
    };
  }

  function merged(p, entries) {
    return Int8Array.from(entries, (v, k) => p.given[k] || v);
  }

  function isSolved(p, entries) {
    const g = merged(p, entries), n = p.n;
    for (let i = 0; i < n; i++) {
      const row = new Set(), col = new Set();
      for (let j = 0; j < n; j++) { row.add(g[i * n + j]); col.add(g[j * n + i]); }
      if (row.size !== n || col.size !== n || row.has(0) || col.has(0)) return false;
    }
    const real = cluesFor(n, g);
    return p.clues.every((c, i) => !c || c === real[i]);
  }

  return { lines, visible, cluesFor, makePrune, merged, isSolved };
})();
