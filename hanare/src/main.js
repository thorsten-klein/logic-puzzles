// Hanare. Put one number in each region, equal to the region's size.
// For two numbers that are next to each other in a row or column (no
// number between them), the distance between them equals the difference
// of the numbers. Built on the shared Binary page (YES = number here).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function model(p) {
    const { R, C, region } = p;
    const list = groups(region);
    const size = (k) => list[region[k]].length;
    const cons = list.map((cells) => ({ cells, min: 1, max: 1, area: cells,
      why: (v) => (v === YES ? 'This region needs its number, and only this cell is left.' : 'This region already has its number.') }));
    const lines = [];
    for (let r = 0; r < R; r++) lines.push(Array.from({ length: C }, (_, c) => r * C + c));
    for (let c = 0; c < C; c++) lines.push(Array.from({ length: R }, (_, r) => r * C + c));
    // Two known numbers with only empty cells between them must fit.
    function check(s) {
      for (const line of lines) {
        let last = -1;
        for (let i = 0; i < line.length; i++) {
          const k = line[i];
          if (s[k] === UNKNOWN) { last = -1; continue; }
          if (s[k] !== YES) continue;
          if (last >= 0 && i - last !== Math.abs(size(k) - size(line[last]))) return false;
          last = i;
        }
      }
      return true;
    }
    return { N: R * C, cons, check };
  }

  // One number per region, region by region, with backtracking.
  function place(p) {
    const list = groups(p.region);
    const m = model(p);
    const s = new Uint8Array(p.R * p.C);
    let nodes = 0;
    const rec = (g) => {
      if (g === list.length) return true;
      if (++nodes > 20000) return false;
      for (const k of PuzzleShell.shuffle(list[g].slice())) {
        for (const j of list[g]) s[j] = j === k ? YES : NO;
        if (m.check(s) && rec(g + 1)) return true;
      }
      for (const j of list[g]) s[j] = UNKNOWN;
      return false;
    };
    return rec(0) ? s : null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 3.5));
      const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const p = { R, C, region };
      const sol = place(p);
      if (!sol) continue;
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
    id: 'hanare',
    name: 'Hanare',
    rules: 'Put one number in each region, equal to the number of cells in that region. When two numbers are next to ' +
      'each other in a row or column (no other number between them), the distance between them equals the difference of the numbers.',
    controls: 'Click a cell to place its region\'s number, click again to mark it empty. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every pair keeps its distance — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      return { R, C, region: Int32Array.from({ length: R * C }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) };
    },
    model,
    draw(p, k, el, v) {
      PuzzleShell.regionBorders(el, k, p.region, p.R, p.C);
      if (!p.sizes) p.sizes = groups(p.region).map((c) => c.length);
      if (v === YES) el.textContent = p.sizes[p.region[k]];
    },
    noun: 'number', noNoun: 'empty cell',
    className: 'pz-regions hn-board', yesClass: 'num', noClass: 'dot',
  });
})();
