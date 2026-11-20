// Kakurasu. Shade cells so each row's shaded cells add up (by column
// number) to the row clue, and each column's (by row number) to the
// column clue. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { n, rows, cols } = p;
    const cons = [];
    const weights = Array.from({ length: n }, (_, i) => i + 1);
    for (let r = 0; r < n; r++) {
      const cells = weights.map((_, c) => r * n + c);
      cons.push({ cells, w: weights, min: rows[r], max: rows[r], area: cells,
        why: (v) => (v === YES ? `Row ${r + 1} can only reach ${rows[r]} with the marked cells shaded.` : `Shading the marked cells would push row ${r + 1} past ${rows[r]}.`) });
    }
    for (let c = 0; c < n; c++) {
      const cells = weights.map((_, r) => r * n + c);
      cons.push({ cells, w: weights, min: cols[c], max: cols[c], area: cells,
        why: (v) => (v === YES ? `Column ${c + 1} can only reach ${cols[c]} with the marked cells shaded.` : `Shading the marked cells would push column ${c + 1} past ${cols[c]}.`) });
    }
    return { N: n * n, cons };
  }

  function tryOnce(n) {
    const sol = Uint8Array.from({ length: n * n }, () => (Math.random() < 0.45 ? YES : NO));
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) {
        if (sol[i * n + j] === YES) a += j + 1;
        if (sol[j * n + i] === YES) b += j + 1;
      }
      rows.push(a); cols.push(b);
    }
    const p = { R: n, C: n, n, rows, cols };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = sol;
    return p;
  }

  const sum = (s, cells) => cells.reduce((a, k, i) => a + (s[k] === YES ? i + 1 : 0), 0);

  Binary.startGame({
    id: 'kakurasu',
    name: 'Kakurasu',
    rules: 'Shade some cells. In a row, a shaded cell counts its column number (1 to N from the left). ' +
      'In a column, it counts its row number (1 to N from the top). The clues give the total for each row and column.',
    controls: 'Click a cell to shade it, click again to mark it empty. Right click cycles the other way.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'All sums match — nicely done.',
    generate(n) {
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.n, r: p.rows.join(','), c: p.cols.join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      const most = (n * (n + 1)) / 2;
      if (rows.length !== n || cols.length !== n || [...rows, ...cols].some((x) => !(x >= 0 && x <= most))) throw new Error('Invalid clues');
      return { R: n, C: n, n, rows, cols };
    },
    model,
    // Totals turn green when met.
    top: (p, s) => p.cols.map((v, c) => [v, sum(s, Array.from({ length: p.n }, (_, r) => r * p.n + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, sum(s, Array.from({ length: p.n }, (_, c) => r * p.n + c)) === v]),
    noun: 'shaded cell', noNoun: 'empty cell',
    className: 'kr-board',
  });
})();
