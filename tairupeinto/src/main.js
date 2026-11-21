// Tairupeinto (Tile Paint). Each region (tile) is either fully shaded
// or empty. Numbers outside count the shaded cells in each row and
// column. Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { out[g] ??= []; out[g].push(k); });
    return out;
  }

  function model(p) {
    const { R, C, rows, cols, region } = p;
    const cons = [];
    const lineWhy = (name, n) => (v) => (v === YES
      ? `${name} needs ${n} shaded cell${n === 1 ? '' : 's'}. The open cells must all be shaded.`
      : n === 0 ? `${name} has no shaded cells.` : `${name} already has its ${n} shaded cell${n === 1 ? '' : 's'}. The rest stay empty.`);
    for (let r = 0; r < R; r++) {
      const cells = Array.from({ length: C }, (_, c) => r * C + c);
      cons.push({ cells, min: rows[r], max: rows[r], area: cells, why: lineWhy(`Row ${r + 1}`, rows[r]) });
    }
    for (let c = 0; c < C; c++) {
      const cells = Array.from({ length: R }, (_, r) => r * C + c);
      cons.push({ cells, min: cols[c], max: cols[c], area: cells, why: lineWhy(`Column ${c + 1}`, cols[c]) });
    }
    const tiles = groups(region);
    function propagate(s, log) {
      for (const cells of tiles) {
        const yes = cells.some((k) => s[k] === YES), no = cells.some((k) => s[k] === NO);
        if (yes && no) return false;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (open.length && (yes || no)) {
          const v = yes ? YES : NO;
          for (const k of open) s[k] = v;
          if (log) log.push({ cells: open, v, area: cells, reason: `A tile is either fully shaded or empty. This tile is ${yes ? 'shaded' : 'empty'}.` });
          return open.length;
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate };
  }

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 3.5));
    const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
    const sol = new Uint8Array(N).fill(NO);
    for (const cells of groups(region)) if (Math.random() < 0.45) for (const k of cells) sol[k] = YES;
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) { a += sol[i * n + j] === YES; b += sol[j * n + i] === YES; }
      rows.push(a); cols.push(b);
    }
    const p = { R, C, rows, cols, region };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = sol;
    return p;
  }

  const filled = (s, cells) => cells.filter((k) => s[k] === YES).length;

  Binary.startGame({
    id: 'tairupeinto',
    name: 'Tairupeinto',
    rules: 'Shade some tiles. Each outlined tile is either fully shaded or fully empty. ' +
      'The numbers outside tell how many shaded cells each row and column has.',
    controls: 'Click a cell to shade it, click again to mark it empty. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 6 },
    solvedText: 'A perfect pavement — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.R, r: p.rows.join(','), c: p.cols.join(','), g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      if (rows.length !== n || cols.length !== n) throw new Error('Invalid counts');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid tiles');
      const region = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R: n, C: n, rows, cols, region };
    },
    model,
    draw(p, k, el) { PuzzleShell.regionBorders(el, k, p.region, p.R, p.C); },
    top: (p, s) => p.cols.map((v, c) => [v, filled(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, filled(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'shaded cell', noNoun: 'empty cell',
    className: 'pz-regions tp-board', yesClass: 'shaded', noClass: 'dot',
  });
})();
