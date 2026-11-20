// Tents generator. Places tents that do not touch, gives each a tree
// on a free side, writes the row and column counts. Keeps boards that
// logic alone solves (so they are unique). Exposes the global `Generator`.

const Generator = (() => {
  const { YES, NO } = Binary;

  function tryOnce(n) {
    const N = n * n;
    const tent = new Uint8Array(N), trees = new Uint8Array(N);
    const target = Math.round(N * 0.19);
    let placed = 0;
    for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
      if (placed >= target) break;
      if (trees[k] || tent[k]) continue;
      const r = Math.floor(k / n), c = k % n;
      let free = true;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < n && nc < n && tent[nr * n + nc]) free = false;
      }
      if (!free) continue;
      const spots = Rules.orth(k, n).filter((j) => !tent[j] && !trees[j]);
      if (!spots.length) continue;
      tent[k] = 1;
      trees[spots[Math.floor(Math.random() * spots.length)]] = 1;
      placed++;
    }
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) { a += tent[i * n + j]; b += tent[j * n + i]; }
      rows.push(a); cols.push(b);
    }
    const p = { n, trees, rows, cols };
    const s = Binary.logicSolve(Rules.model(p));
    if (!s || s.includes(0)) return null;
    p.solution = Uint8Array.from(tent, (t) => (t ? YES : NO));
    return p;
  }

  function generate(n) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const p = tryOnce(n);
      if (p) return p;
    }
    return null;
  }

  return { generate };
})();
