// Putteria. Put one number in each region, equal to the region's size.
// The same number never appears twice in a row or column, and numbered
// cells never touch by a side. Crossed cells hold no number.
// Built on the shared Binary game page (YES = number placed).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function model(p) {
    const { R, C, region, cross } = p;
    const list = groups(region);
    const size = (k) => list[region[k]].length;
    const cons = [];
    for (let k = 0; k < R * C; k++) if (cross[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'A crossed cell holds no number.' });
    list.forEach((cells) => cons.push({ cells, min: 1, max: 1, area: cells,
      why: (v) => (v === YES ? 'This region needs its number, and only this cell is left.' : 'This region already has its number.') }));
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Numbers never touch by a side.';
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    // One of each number per row and column.
    for (let i = 0; i < R; i++) {
      const bySize = new Map();
      for (let c = 0; c < C; c++) { const k = i * C + c; (bySize.get(size(k)) || bySize.set(size(k), []).get(size(k))).push(k); }
      for (const [v, cells] of bySize) if (cells.length > 1) cons.push({ cells, min: 0, max: 1, area: cells, why: () => `Row ${i + 1} already has a ${v}.` });
    }
    for (let i = 0; i < C; i++) {
      const bySize = new Map();
      for (let r = 0; r < R; r++) { const k = r * C + i; (bySize.get(size(k)) || bySize.set(size(k), []).get(size(k))).push(k); }
      for (const [v, cells] of bySize) if (cells.length > 1) cons.push({ cells, min: 0, max: 1, area: cells, why: () => `Column ${i + 1} already has a ${v}.` });
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const seeds = PuzzleShell.shuffle([...new Array(R * C).keys()]).slice(0, Math.round((R * C) / 3.5));
      const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      if (groups(region).some((cells) => cells.length > n)) continue;
      const p = { R, C, region, cross: new Uint8Array(R * C) };
      const sol = Binary.randomFill(model(p), 0.3, 5);
      if (!sol) continue;
      // Add crosses until logic alone solves it.
      for (let guard = 0; guard < R * C; guard++) {
        const s = Binary.logicSolve(model(p));
        if (s && !s.includes(UNKNOWN)) break;
        const open = [...sol.keys()].filter((k) => s && s[k] === UNKNOWN && sol[k] === NO);
        if (!open.length) break;
        p.cross[open[Math.floor(Math.random() * open.length)]] = 1;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN) || !s.every((v, k) => v === sol[k])) continue;
      Binary.thinClues(p.cross, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'putteria',
    name: 'Putteria',
    rules: 'Put one number in each region, equal to the number of cells in that region. The same number never appears ' +
      'twice in a row or column. Numbered cells never touch by a side. Crossed cells hold no number.',
    controls: 'Click a cell to place its region\'s number, click again to mark it empty. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Every region numbered — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), x: Array.from(p.cross).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      if (typeof d.x !== 'string' || d.x.length !== R * C || !/^[01]+$/.test(d.x)) throw new Error('Invalid crosses');
      return { R, C, region: Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)), cross: Uint8Array.from(d.x, Number) };
    },
    model,
    fixed: (p, k) => (p.cross[k] ? NO : 0),
    draw(p, k, el, v) {
      PuzzleShell.regionBorders(el, k, p.region, p.R, p.C);
      if (!p.sizes) p.sizes = groups(p.region).map((c) => c.length);
      if (p.cross[k]) el.classList.add('cross');
      else if (v === YES) el.textContent = p.sizes[p.region[k]];
    },
    noun: 'number', noNoun: 'empty cell',
    className: 'pz-regions pt-board', yesClass: 'num', noClass: 'dot',
  });
})();
