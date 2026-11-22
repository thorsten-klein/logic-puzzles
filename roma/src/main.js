// Roma. Put an arrow (up, down, left or right) in every empty cell. The
// arrows in a region are all different. Starting anywhere and following
// the arrows always ends at a black circle. Some arrows are given.
// Built on the shared Flow engine.

(() => {
  const { one } = Flow;

  function prepare(p) {
    const { region, circle } = p;
    p.groups = [];
    region.forEach((g, k) => { if (!circle[k]) { p.groups[g] ??= []; p.groups[g].push(k); } });
    p.groups = p.groups.filter(Boolean);
    return p;
  }

  // Arrows in a region differ. A full region (4 cells) holds each arrow
  // once.
  function rule(p, cand) {
    for (const cells of p.groups) {
      for (const k of cells.filter((x) => one(cand[x]))) {
        for (const j of cells) if (j !== k) cand[j] &= ~cand[k];
      }
      if (cells.length === 4) onlyPlace(cand, cells);
    }
    return true;
  }

  // An arrow with one place left in a full region goes there.
  function onlyPlace(cand, cells) {
    for (let v = 1; v <= 4; v++) {
      const where = cells.filter((k) => cand[k] & (1 << v));
      if (where.length === 1) cand[where[0]] = 1 << v;
    }
  }

  // Regions of up to 4 cells with different arrows (circles alone).
  function randomRegions(R, C, circle, arrow) {
    const N = R * C;
    const region = new Int32Array(N).fill(-1);
    let id = 0;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (region[k] >= 0) continue;
      region[k] = id;
      if (!circle[k]) growRegion({ R, C }, region, circle, arrow, k);
      id++;
    }
    return region;
  }

  // Grows the region of cell k to up to 4 cells with different arrows.
  function growRegion(p, region, circle, arrow, k) {
    const id = region[k];
    const cells = [k], used = new Set([arrow[k]]);
    const free = (j) => region[j] < 0 && !circle[j] && !used.has(arrow[j]);
    for (let t = 0; t < 40 && cells.length < 4; t++) {
      const opts = cells.flatMap((x) => Flow.sides(p, x)).filter(free);
      if (!opts.length) return;
      const j = opts[Math.floor(Math.random() * opts.length)];
      region[j] = id;
      cells.push(j);
      used.add(arrow[j]);
    }
  }

  const cfg = {
    id: 'roma',
    name: 'Roma',
    rules: 'Put an arrow (up, down, left or right) in every empty cell. The arrows in one outlined region are all different. ' +
      'Starting from any cell and following the arrows, you always end at a black circle. Some arrows are given.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'All roads lead to Rome — nicely done.',
    rule,
    why: 'its region needs different arrows',
    className: 'pz-board pz-regions rm-board',
    cellStyle: (p, k, el) => PuzzleShell.regionBorders(el, k, p.region, p.R, p.C),
    goalCell: (p, k, el) => el.classList.add('goal'),
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const circle = Flow.randomGoals(n, n, Math.max(2, Math.round(n * n / 6)));
        const arrow = Flow.arrowForest(n, n, circle);
        const p = prepare({ R: n, C: n, region: randomRegions(n, n, circle, arrow), circle });
        if (!Flow.setGivens(cfg, p, arrow, { fixNodes: 5000, nodes: 30000 })) continue;
        p.solution = arrow;
        return p;
      }
      return null;
    },
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), o: Array.from(p.circle).join(''), v: Array.from(p.given).join('') }),
    decodeBoard(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      if (typeof d.o !== 'string' || d.o.length !== n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid grid');
      const p = prepare({ R: n, C: n, region: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)), circle: Uint8Array.from(d.o, Number) });
      p.given = Int8Array.from(d.v, Number);
      return p;
    },
  };
  Flow.startGame(cfg);
})();
