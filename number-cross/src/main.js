// Number Cross. Shade some cells. The numbers outside give the sum of
// the numbers in the white cells of each row and column.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { n, g, rows, cols } = p;
    const cons = [];
    // Shaded total = line total - white sum.
    for (let r = 0; r < n; r++) {
      const cells = Array.from({ length: n }, (_, c) => r * n + c);
      const w = cells.map((k) => g[k]);
      const shade = w.reduce((a, b) => a + b, 0) - rows[r];
      cons.push({ cells, w, min: shade, max: shade, area: cells,
        why: (v) => (v === YES ? `Row ${r + 1} can only sum to ${rows[r]} if these cells are shaded.`
          : `Row ${r + 1} can only sum to ${rows[r]} if these cells stay white.`) });
    }
    for (let c = 0; c < n; c++) {
      const cells = Array.from({ length: n }, (_, r) => r * n + c);
      const w = cells.map((k) => g[k]);
      const shade = w.reduce((a, b) => a + b, 0) - cols[c];
      cons.push({ cells, w, min: shade, max: shade, area: cells,
        why: (v) => (v === YES ? `Column ${c + 1} can only sum to ${cols[c]} if these cells are shaded.`
          : `Column ${c + 1} can only sum to ${cols[c]} if these cells stay white.`) });
    }
    return { N: n * n, cons };
  }

  function tryOnce(n) {
    const g = Int8Array.from({ length: n * n }, () => 1 + Math.floor(Math.random() * 9));
    const sol = Uint8Array.from({ length: n * n }, () => (Math.random() < 0.35 ? YES : NO));
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) {
        if (sol[i * n + j] === NO) a += g[i * n + j];
        if (sol[j * n + i] === NO) b += g[j * n + i];
      }
      rows.push(a); cols.push(b);
    }
    const p = { R: n, C: n, n, g, rows, cols };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = sol;
    return p;
  }

  const whiteSum = (p, s, cells) => cells.reduce((a, k) => a + (s[k] === YES ? 0 : p.g[k]), 0);

  Binary.startGame({
    id: 'number-cross',
    name: 'Number Cross',
    rules: 'Shade some cells. The numbers outside the grid give the sum of the numbers in the white (unshaded) cells ' +
      'of each row and column.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'Every sum adds up — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.n, g: Array.from(p.g).join(''), r: p.rows.join(','), c: p.cols.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[1-9]+$/.test(d.g)) throw new Error('Invalid grid');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      if (rows.length !== n || cols.length !== n || [...rows, ...cols].some((x) => !(x >= 0))) throw new Error('Invalid sums');
      return { R: n, C: n, n, g: Int8Array.from(d.g, Number), rows, cols };
    },
    model,
    draw(p, k, el) { el.textContent = p.g[k]; },
    top: (p, s) => p.cols.map((v, c) => [v, whiteSum(p, s, Array.from({ length: p.n }, (_, r) => r * p.n + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, whiteSum(p, s, Array.from({ length: p.n }, (_, c) => r * p.n + c)) === v]),
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nc-board', noClass: 'keep',
  });
})();
