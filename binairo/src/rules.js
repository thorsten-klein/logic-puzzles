// Binairo rules as a Binary model. Exposes the global `Rules`.
//
// Each cell holds 1 (YES) or 0 (NO). Rules:
//   - no three of the same digit next to each other in a line
//   - each row and column has as many 1s as 0s
//   - no two rows are equal, no two columns are equal
// `given[k]` is 0 (open), YES or NO.

const Rules = (() => {
  const { UNKNOWN, YES } = Binary;

  function linesOf(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(Array.from({ length: n }, (_, j) => i * n + j), Array.from({ length: n }, (_, j) => j * n + i));
    }
    return out;
  }

  // No two full rows (or columns) may be equal.
  function distinctLines(n, s) {
    const seenR = new Set(), seenC = new Set();
    for (let i = 0; i < n; i++) {
      let row = '', col = '';
      for (let j = 0; j < n; j++) { row += s[i * n + j]; col += s[j * n + i]; }
      if (!row.includes(String(UNKNOWN))) { if (seenR.has(row)) { return false; } seenR.add(row); }
      if (!col.includes(String(UNKNOWN))) { if (seenC.has(col)) { return false; } seenC.add(col); }
    }
    return true;
  }

  function model(p) {
    const { n, given } = p;
    const cons = [];
    for (let k = 0; k < n * n; k++) {
      if (given[k]) cons.push({ cells: [k], min: given[k] === YES ? 1 : 0, max: given[k] === YES ? 1 : 0 });
    }
    const half = n / 2;
    linesOf(n).forEach((cells, i) => {
      const name = i % 2 ? `Column ${(i >> 1) + 1}` : `Row ${(i >> 1) + 1}`;
      cons.push({ cells, min: half, max: half, area: cells,
        why: (v) => `${name} already has ${half} ${v === YES ? '0s' : '1s'}. The rest are ${v === YES ? '1s' : '0s'}.` });
      for (let j = 0; j + 2 < n; j++) {
        cons.push({ cells: cells.slice(j, j + 3), min: 1, max: 2,
          why: (v) => `Three ${v === YES ? '0s' : '1s'} next to each other are not allowed.` });
      }
    });
    return { N: n * n, cons, check: (s) => distinctLines(n, s) };
  }

  function isSolved(p, s) {
    const m = model(p);
    if (s.some((v, k) => !v && !p.given[k])) return false;
    const t = Uint8Array.from(s, (v, k) => p.given[k] || v);
    return m.cons.every((con) => {
      const y = con.cells.filter((j) => t[j] === YES).length;
      return y >= con.min && y <= con.max;
    }) && distinctLines(p.n, t);
  }

  return { model, isSolved };
})();
