// Futoshiki helpers. Exposes the global `Rules`.
//
// Signs between neighbours:
//   h[r * (n-1) + c]  between (r, c) and (r, c+1): '<', '>' or '.'
//   v[r * n + c]      between (r, c) and (r+1, c): '^' (top smaller), 'v' (top bigger) or '.'
// A sign becomes a pair [small, big] of cell indices.

const Rules = (() => {
  function pairs(n, h, v) {
    const out = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) {
      const a = r * n + c, s = h[r * (n - 1) + c];
      if (s === '<') out.push([a, a + 1]);
      if (s === '>') out.push([a + 1, a]);
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) {
      const a = r * n + c, s = v[r * n + c];
      if (s === '^') out.push([a, a + n]);
      if (s === 'v') out.push([a + n, a]);
    }
    return out;
  }

  // Prune for Latin.propagate: small < big.
  function makePrune(p) {
    const list = pairs(p.n, p.h, p.v);
    return (cand) => {
      for (const [a, b] of list) {
        const maxB = 31 - Math.clz32(cand[b]);
        const minA = 31 - Math.clz32(cand[a] & -cand[a]);
        cand[a] &= (1 << maxB) - 1;
        cand[b] &= ~((1 << (minA + 1)) - 1);
        if (!cand[a] || !cand[b]) return false;
      }
      return true;
    };
  }

  function merged(p, entries) {
    return Int8Array.from(entries, (v, k) => p.given[k] || v);
  }

  function isSolved(p, entries) {
    const g = merged(p, entries);
    const n = p.n;
    for (let i = 0; i < n; i++) {
      const row = new Set(), col = new Set();
      for (let j = 0; j < n; j++) { row.add(g[i * n + j]); col.add(g[j * n + i]); }
      if (row.size !== n || col.size !== n || row.has(0) || col.has(0)) return false;
    }
    return pairs(n, p.h, p.v).every(([a, b]) => g[a] < g[b]);
  }

  return { pairs, makePrune, merged, isSolved };
})();
