// Clouds. Clouds are rectangles at least 2x2 that never touch, not even
// at a corner. Numbers outside count cloud cells per row and column.
// Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, rows, cols } = p;
    const cons = [];
    const lineWhy = (name, n) => (v) => (v === YES
      ? `${name} needs ${n} cloud cell${n === 1 ? '' : 's'}. The open cells must all be cloud.`
      : n === 0 ? `${name} has no cloud cells. All its cells are sky.`
        : `${name} already has its ${n} cloud cell${n === 1 ? '' : 's'}. The rest is sky.`);
    for (let r = 0; r < R; r++) {
      const cells = Array.from({ length: C }, (_, c) => r * C + c);
      cons.push({ cells, min: rows[r], max: rows[r], area: cells, why: lineWhy(`Row ${r + 1}`, rows[r]) });
    }
    for (let c = 0; c < C; c++) {
      const cells = Array.from({ length: R }, (_, r) => r * C + c);
      cons.push({ cells, min: cols[c], max: cols[c], area: cells, why: lineWhy(`Column ${c + 1}`, cols[c]) });
    }
    const at = (s, r, c) => (r < 0 || c < 0 || r >= R || c >= C ? NO : s[r * C + c]);

    function propagate(s, log) {
      // 2x2 blocks: never 3 clouds, never only a diagonal pair.
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const v = cells.map((k) => s[k]);
        const yes = v.filter((x) => x === YES).length, no = v.filter((x) => x === NO).length;
        if ((v[0] === YES && v[3] === YES && (v[1] === NO || v[2] === NO)) ||
            (v[1] === YES && v[2] === YES && (v[0] === NO || v[3] === NO))) return -1;
        if (yes === 3 && no === 1) return -1;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (yes === 3 && open.length === 1) {
          s[open[0]] = YES;
          if (log) log.push({ cells: open, v: YES, reason: 'Clouds are rectangles. Three cloud cells in a 2×2 block need the fourth too.' });
          return 1;
        }
        if (yes === 2 && no === 1 && open.length === 1) {
          s[open[0]] = NO;
          if (log) log.push({ cells: open, v: NO, reason: 'Clouds are rectangles. This cell would make an L shape, so it is sky.' });
          return 1;
        }
      }
      // Each cloud cell needs a cloud neighbour across and up/down (2x2 at least).
      for (let k = 0; k < R * C; k++) {
        if (s[k] !== YES) continue;
        const r = Math.floor(k / C), c = k % C;
        for (const pair of [[[r, c - 1], [r, c + 1]], [[r - 1, c], [r + 1, c]]]) {
          const vals = pair.map(([a, b]) => at(s, a, b));
          if (vals.includes(YES)) continue;
          const open = pair.filter(([a, b], i) => vals[i] === UNKNOWN).map(([a, b]) => a * C + b);
          if (!open.length) return -1;
          if (open.length === 1) {
            s[open[0]] = YES;
            if (log) log.push({ cells: open, v: YES, reason: 'A cloud is at least two cells wide and high. This cloud can only grow here.' });
            return 1;
          }
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate };
  }

  function tryOnce(n) {
    const cloud = new Uint8Array(n * n);
    const free = (r, c, h, w) => {
      for (let i = r - 1; i <= r + h; i++) for (let j = c - 1; j <= c + w; j++) {
        if (i >= 0 && j >= 0 && i < n && j < n && cloud[i * n + j]) return false;
      }
      return true;
    };
    for (let t = 0; t < 60; t++) {
      const h = 2 + Math.floor(Math.random() * 3), w = 2 + Math.floor(Math.random() * 3);
      const r = Math.floor(Math.random() * (n - h + 1)), c = Math.floor(Math.random() * (n - w + 1));
      if (!free(r, c, h, w)) continue;
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) cloud[(r + i) * n + c + j] = 1;
    }
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) { a += cloud[i * n + j]; b += cloud[j * n + i]; }
      rows.push(a); cols.push(b);
    }
    const p = { R: n, C: n, rows, cols };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = Uint8Array.from(cloud, (x) => (x ? YES : NO));
    return p;
  }

  const count = (s, cells) => cells.filter((k) => s[k] === YES).length;

  Binary.startGame({
    id: 'clouds',
    name: 'Clouds',
    rules: 'Mark the clouds. Every cloud is a rectangle at least 2 cells wide and 2 cells high. ' +
      'Clouds never touch, not even at a corner. The numbers tell how many cloud cells each row and column has.',
    controls: 'Click a cell to mark cloud, click again to mark sky. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Clear forecast — nicely done.',
    generate(n) {
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.R, r: p.rows.join(','), c: p.cols.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      if (rows.length !== n || cols.length !== n || [...rows, ...cols].some((x) => !(x >= 0 && x <= n))) throw new Error('Invalid counts');
      return { R: n, C: n, rows, cols };
    },
    model,
    top: (p, s) => p.cols.map((v, c) => [v, count(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, count(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'cloud cell', noNoun: 'sky cell',
    className: 'cl-board', yesClass: 'cloud', noClass: 'sky',
  });
})();
