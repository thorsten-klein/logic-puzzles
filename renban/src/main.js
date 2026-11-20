// Renban. A Latin square (1..N once per row and column) split into
// regions. The numbers in a region are all different and form a run of
// consecutive numbers, in any order. Built on Latin.startGame.

(() => {
  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function prune(p) {
    const list = groups(p.region);
    return (cand) => {
      for (const cells of list) {
        if (cells.length < 2) continue;
        const ok = (vals) => Math.max(...vals) - Math.min(...vals) === vals.length - 1;
        if (!Latin.filterGroup(cells, cand, ok, true)) return false;
        for (const k of cells) if (!cand[k]) return false;
      }
      return true;
    };
  }

  // Regions grown so their numbers stay a consecutive run.
  function makeRegions(n, sol) {
    const region = new Int32Array(n * n).fill(-1);
    let id = 0;
    for (const start of PuzzleShell.shuffle([...Array(n * n).keys()])) {
      if (region[start] >= 0) continue;
      const cells = [start];
      region[start] = id;
      let lo = sol[start], hi = sol[start];
      const size = 1 + Math.floor(Math.random() * Math.min(5, n));
      for (let tries = 0; cells.length < size && tries < 20; tries++) {
        const opts = [];
        for (const k of cells) {
          const r = Math.floor(k / n), c = k % n;
          for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
            const j = nr * n + nc;
            if (region[j] < 0 && (sol[j] === lo - 1 || sol[j] === hi + 1)) opts.push(j);
          }
        }
        if (!opts.length) break;
        const j = opts[Math.floor(Math.random() * opts.length)];
        region[j] = id;
        cells.push(j);
        lo = Math.min(lo, sol[j]); hi = Math.max(hi, sol[j]);
      }
      id++;
    }
    return region;
  }

  function generate(n) {
    for (let t = 0; t < 30; t++) {
      const sol = Latin.randomSquare(n);
      const region = makeRegions(n, sol);
      const p = { n, region, solution: sol };
      const given = Latin.makeGivens(n, sol, prune(p));
      if (!given) continue;
      p.given = given;
      return p;
    }
    return null;
  }

  Latin.startGame({
    id: 'renban',
    name: 'Renban',
    rules: 'Fill the grid with 1 to N so each row and column holds every number once. ' +
      'The numbers in each outlined region are all different and form a run of consecutive numbers, in any order (like 5-3-4).',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every run in order — nicely done.',
    what: 'its region',
    generate,
    encode: (p) => Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''),
    decode(x, n) {
      if (typeof x !== 'string' || x.length !== 2 * n * n) throw new Error('Invalid regions');
      return { region: Int32Array.from({ length: n * n }, (_, k) => parseInt(x.slice(2 * k, 2 * k + 2), 36)) };
    },
    prune,
    className: 'pz-regions',
    decorate(p, k, el) { PuzzleShell.regionBorders(el, k, p.region, p.n, p.n); },
  });
})();
