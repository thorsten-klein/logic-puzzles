// Calcudoku helpers. Exposes the global `Rules`.
//
// `cage[k]` is the cage number of cell k. `cages[i]` is
// { cells, op, target } with op one of '+', '-', '*', '/', '' (single cell).

const Rules = (() => {
  function cagesFrom(n, cage, ops) {
    const cages = ops.map(([op, target]) => ({ cells: [], op, target }));
    for (let k = 0; k < n * n; k++) cages[cage[k]].cells.push(k);
    return cages;
  }

  function value(op, vals) {
    if (op === '+' || op === '') return vals.reduce((a, b) => a + b, 0);
    if (op === '*') return vals.reduce((a, b) => a * b, 1);
    const [a, b] = vals[0] > vals[1] ? vals : [vals[1], vals[0]];
    if (op === '-') return a - b;
    return a % b === 0 ? a / b : -1;
  }

  function makePrune(p) {
    const n = p.n;
    return (cand) => {
      for (const cg of p.cages) {
        const { cells, op, target } = cg;
        const ok = (vals) => value(op, vals) === target;
        // No repeat within a row or column inside the cage.
        ok.partial = (vals, j) => {
          const r = Math.floor(cells[j] / n), c = cells[j] % n;
          for (let i = 0; i < j; i++) {
            if (vals[i] !== vals[j]) continue;
            const ri = Math.floor(cells[i] / n), ci = cells[i] % n;
            if (ri === r || ci === c) return false;
          }
          if (op === '+' && vals.slice(0, j + 1).reduce((a, b) => a + b, 0) > target) return false;
          if (op === '*' && target % vals[j] !== 0) return false;
          return true;
        };
        if (!Latin.filterGroup(cells, cand, ok, false)) return false;
        for (const k of cells) if (!cand[k]) return false;
      }
      return true;
    };
  }

  function isSolved(p, g) {
    const n = p.n;
    for (let i = 0; i < n; i++) {
      const row = new Set(), col = new Set();
      for (let j = 0; j < n; j++) { row.add(g[i * n + j]); col.add(g[j * n + i]); }
      if (row.size !== n || col.size !== n || row.has(0) || col.has(0)) return false;
    }
    return p.cages.every((cg) => value(cg.op, cg.cells.map((k) => g[k])) === cg.target);
  }

  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷', '': '' };

  return { cagesFrom, value, makePrune, isSolved, SYMBOL };
})();
