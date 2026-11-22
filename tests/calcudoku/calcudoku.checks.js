// Extra checks for Calcudoku, used by tests/games.spec.js (shared tests: lib/suite.js).

// Each cage gives its target with its operation. For − and ÷ the order
// does not matter: bigger minus (or divided by) smaller.
module.exports = {
  answer(p) {
    const out = [];
    for (const { cells, op, target } of p.cages) {
      const v = cells.map((k) => p.solution[k]);
      const hi = Math.max(...v), lo = Math.min(...v);
      const got = op === '+' ? v.reduce((a, b) => a + b, 0)
        : op === '*' ? v.reduce((a, b) => a * b, 1)
          : op === '-' ? hi - lo
            : op === '/' ? hi / lo
              : v[0];
      if ((op === '-' || op === '/') && cells.length !== 2) out.push(`${op} cage at ${cells} has ${cells.length} cells`);
      if (got !== target) out.push(`cage at ${cells} (${op}${target}) gives ${got}`);
    }
    const covered = p.cages.flatMap((c) => c.cells).sort((a, b) => a - b);
    if (covered.join() !== [...new Array(p.n * p.n).keys()].join()) out.push('cages do not cover each cell once');
    return out;
  },
};
