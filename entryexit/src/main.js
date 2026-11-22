// EntryExit. Draw one loop through every cell. The loop enters and
// leaves each region exactly once (it crosses each region's border
// exactly twice). Built on the shared Loop engine.

(() => {

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = new Uint8Array(p.R * p.C).fill(1);
    const border = PuzzleShell.graphRegionBorders(g, p.region);
    function rule(s, log) {
      for (const edges of border) {
        if (!edges) continue;
        const res = Loop.stepBorder(edges, 2, s, log,
          'This region is already entered and left once. The loop crosses no more of its border.',
          'The loop must enter and leave this region, and only these border crossings are left.');
        if (res !== 0) return res;
      }
      return 0;
    }
    return { g, must, rule };
  }

  function partitionRegions(rot, n) {
    const region = new Int32Array(n * n);
    let id = 0;
    for (let i = 0; i < rot.length;) {
      const len = Math.min(rot.length - i, 2 + Math.floor(Math.random() * 5));
      for (let j = 0; j < len; j++) region[rot[i + j]] = id;
      i += len;
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
      const region = partitionRegions(rot, n);
      const p = { R: n, C: n, region };
      const res = Loop.solve(model(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'entryexit',
    name: 'EntryExit',
    rules: 'Draw one closed loop through the centres of all cells, visiting every cell exactly once. ' +
      'The loop enters and leaves each outlined region only once.',
    size: { min: 2, max: 5, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'In and out, once each — nicely done.',
    generate,
    encode: PuzzleShell.encodeRegions,
    decode: PuzzleShell.decodeRegions,
    model,
    drawCell: (p) => (svg, k, x, y, s) => PuzzleShell.drawRegionWalls(p, svg, k, x, y, s),
  });
})();
