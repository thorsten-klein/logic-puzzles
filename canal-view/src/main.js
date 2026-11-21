// Canal View. Shade some cells: all shaded cells connect, and no 2x2
// block is fully shaded. Numbered cells stay white. A number counts the
// shaded cells in straight lines from it (up, down, left, right) until
// a white cell or the edge. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function ray(R, C, k, [dr, dc]) {
    const out = [];
    let r = Math.floor(k / C) + dr, c = (k % C) + dc;
    while (r >= 0 && c >= 0 && r < R && c < C) { out.push(r * C + c); r += dr; c += dc; }
    return out;
  }

  function model(p) {
    const { R, C, clues } = p;
    const cons = [];
    const rays = [];
    for (let k = 0; k < R * C; k++) {
      if (clues[k] >= 0) {
        cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
        rays.push([k, DIRS.map((d) => ray(R, C, k, d))]);
      }
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      cons.push({ cells: [k, k + 1, k + C, k + C + 1], min: 0, max: 3, why: () => 'A 2×2 block may not be fully shaded.' });
    }
    function propagate(s, log) {
      for (const [k, dirs] of rays) {
        const v = clues[k];
        const black = dirs.map((cells) => { let i = 0; while (i < cells.length && s[cells[i]] === YES) { i++; } return i; });
        const open = dirs.map((cells) => { let i = 0; while (i < cells.length && s[cells[i]] !== NO) { i++; } return i; });
        const min = black.reduce((a, b) => a + b, 0), max = open.reduce((a, b) => a + b, 0);
        if (min > v || max < v) return false;
        for (let d = 0; d < 4; d++) {
          const cells = dirs[d];
          const need = v - (max - open[d]);
          const forced = cells.slice(0, Math.max(0, need)).filter((j) => s[j] === UNKNOWN);
          if (forced.length) {
            for (const j of forced) s[j] = YES;
            if (log) log.push({ cells: forced, v: YES, at: k, reason: `This ${v} can not see enough shaded cells in the other directions. These cells must be shaded.` });
            return forced.length;
          }
          const most = v - (min - black[d]);
          const next = cells[black[d]];
          if (black[d] === most && next !== undefined && s[next] === UNKNOWN) {
            s[next] = NO;
            if (log) log.push({ cells: [next], v: NO, at: k, reason: `This ${v} already sees enough shaded cells this way. The next cell must be white.` });
            return 1;
          }
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate, check: (s) => Binary.canConnect(R, C, s, YES) };
  }

  function generate(n) {
    for (let t = 0; t < 60; t++) {
      const R = n, C = n;
      const p = { R, C, clues: new Int8Array(R * C).fill(-1) };
      const sol = Binary.randomFill(model(p), 0.55, 5);
      if (!sol) continue;
      for (let k = 0; k < R * C; k++) {
        if (sol[k] === YES || Math.random() < 0.3) continue;
        let v = 0;
        for (const d of DIRS) for (const j of ray(R, C, k, d)) { if (sol[j] !== YES) { break; } v++; }
        p.clues[k] = v;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'canal-view',
    name: 'Canal View',
    rules: 'Shade some cells. All shaded cells form one connected group, and no 2×2 block is fully shaded. ' +
      'Numbered cells stay white. A number counts the shaded cells in straight lines from it (up, down, left and right), ' +
      'up to the first white cell or the edge.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'The canals flow — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] >= 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cv-board', yesClass: 'water',
  });
})();
