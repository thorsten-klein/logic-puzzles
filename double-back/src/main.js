// Double Back. Draw one loop through every cell. The loop visits each
// region exactly twice (it crosses each region's border exactly four
// times). Built on the shared Loop engine.

(() => {

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = new Uint8Array(p.R * p.C).fill(1);
    const border = PuzzleShell.graphRegionBorders(g, p.region);
    function rule(s, log) {
      for (const edges of border) {
        if (!edges) continue;
        const res = Loop.stepBorder(edges, 4, s, log,
          'This region is already visited twice. The loop crosses no more of its border.',
          'The loop must visit this region twice, and only these border crossings are left.');
        if (res !== 0) return res;
      }
      return 0;
    }
    return { g, must, rule };
  }

  function pairSegments(n, rot) {
    const seg = new Int32Array(n * n);
    const segs = [];
    for (let i = 0; i < rot.length;) {
      const len = Math.min(rot.length - i, 2 + Math.floor(Math.random() * 4));
      const cells = rot.slice(i, i + len);
      cells.forEach((k) => { seg[k] = segs.length; });
      segs.push(cells);
      i += len;
    }
    const touch = (a, b) => segs[a].some((k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && seg[x * n + y] === b);
    });
    const region = new Int32Array(n * n).fill(-1);
    let id = 0;
    for (const a of PuzzleShell.shuffle([...segs.keys()])) {
      if (region[segs[a][0]] >= 0) continue;
      const b = PuzzleShell.shuffle([...segs.keys()]).find((x) => x !== a && region[segs[x][0]] < 0 && touch(a, x) &&
        Math.abs(x - a) > 1 && !(Math.max(x, a) === segs.length - 1 && Math.min(x, a) === 0));
      if (b === undefined) return null;
      for (const k of [...segs[a], ...segs[b]]) region[k] = id;
      id++;
    }
    return region;
  }

  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sol = Loop.randomTour(n);
      const g = Loop.grid(n, n);
      const rot = Loop.tourOrder(sol, g, n);
      const region = pairSegments(n, rot);
      if (!region) continue;
      const p = { R: n, C: n, region };
      const res = Loop.solve(model(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'double-back',
    name: 'Double Back',
    rules: 'Draw one closed loop through the centres of all cells, visiting every cell exactly once. ' +
      'The loop visits each outlined region exactly twice.',
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Every region visited twice — nicely done.',
    generate,
    encode: PuzzleShell.encodeRegions,
    decode: PuzzleShell.decodeRegions,
    model,
    drawCell: (p) => (svg, k, x, y, s) => PuzzleShell.drawRegionWalls(p, svg, k, x, y, s),
  });
})();
