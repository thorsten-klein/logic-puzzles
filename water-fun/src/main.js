// Water Fun (Aquarium). Fill tanks with water. Each tank fills from the
// bottom up to one level. Numbers outside count the filled cells in each
// row and column. Built on the shared Binary game page (YES = water).

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
      ? `${name} needs ${n} water cell${n === 1 ? '' : 's'}. The open cells must all be filled.`
      : n === 0 ? `${name} has no water.` : `${name} already has its ${n} water cell${n === 1 ? '' : 's'}. The rest stay dry.`);
    for (let r = 0; r < R; r++) {
      const cells = Array.from({ length: C }, (_, c) => r * C + c);
      cons.push({ cells, min: rows[r], max: rows[r], area: cells, why: lineWhy(`Row ${r + 1}`, rows[r]) });
    }
    for (let c = 0; c < C; c++) {
      const cells = Array.from({ length: R }, (_, r) => r * C + c);
      cons.push({ cells, min: cols[c], max: cols[c], area: cells, why: lineWhy(`Column ${c + 1}`, cols[c]) });
    }
    const tanks = groups(region);
    function propagate(s, log) {
      for (const cells of tanks) {
        const rowOf = (k) => Math.floor(k / C);
        let topWet = R, lowDry = -1;
        for (const k of cells) {
          if (s[k] === YES) topWet = Math.min(topWet, rowOf(k));
          if (s[k] === NO) lowDry = Math.max(lowDry, rowOf(k));
        }
        if (topWet <= lowDry) return false;
        const wet = cells.filter((k) => s[k] === UNKNOWN && rowOf(k) >= topWet);
        if (wet.length) {
          for (const k of wet) s[k] = YES;
          if (log) log.push({ cells: wet, v: YES, area: cells, reason: 'Water in a tank fills everything below its level, side to side.' });
          return wet.length;
        }
        const dry = cells.filter((k) => s[k] === UNKNOWN && rowOf(k) <= lowDry);
        if (dry.length) {
          for (const k of dry) s[k] = NO;
          if (log) log.push({ cells: dry, v: NO, area: cells, reason: 'A dry cell in a tank means everything above it, side to side, is dry too.' });
          return dry.length;
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate };
  }

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4));
    const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
    const sol = new Uint8Array(N).fill(NO);
    for (const cells of groups(region)) {
      const rowsIn = [...new Set(cells.map((k) => Math.floor(k / C)))].sort((a, b) => a - b);
      const level = rowsIn[Math.floor(Math.random() * (rowsIn.length + 1))];
      if (level === undefined) continue;
      for (const k of cells) if (Math.floor(k / C) >= level) sol[k] = YES;
    }
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
    id: 'water-fun',
    name: 'Water Fun',
    rules: 'Fill some tanks with water. A tank fills from the bottom up, and its water has one level everywhere. ' +
      'The numbers outside tell how many cells of each row and column hold water.',
    controls: 'Click a cell to fill it, click again to mark it dry. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 6 },
    solvedText: 'All tanks at the right level — nicely done.',
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
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid tanks');
      const region = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R: n, C: n, rows, cols, region };
    },
    model,
    draw(p, k, el) { PuzzleShell.regionBorders(el, k, p.region, p.R, p.C); },
    top: (p, s) => p.cols.map((v, c) => [v, filled(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, filled(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'water cell', noNoun: 'dry cell',
    className: 'pz-regions wf-board', yesClass: 'water', noClass: 'dry',
  });
})();
