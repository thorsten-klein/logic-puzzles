// Extra checks for Star Battle, used by tests/games.spec.js (shared tests: lib/suite.js).

const { kingNbs } = require('../lib/kinds');

// Each row, column and region holds k stars (1). Stars never touch, not
// even at a corner.
module.exports = {
  answer(p) {
    const { n, k, region, solution: s } = p, out = [];
    const rows = new Array(n).fill(0), cols = new Array(n).fill(0), regs = new Map();
    for (let x = 0; x < n * n; x++) {
      if (s[x] !== 1) continue;
      rows[Math.floor(x / n)]++;
      cols[x % n]++;
      regs.set(region[x], (regs.get(region[x]) || 0) + 1);
      if (kingNbs(n, n, x).some((j) => s[j] === 1)) out.push(`stars touch at ${x}`);
    }
    rows.forEach((v, i) => { if (v !== k) out.push(`row ${i} has ${v} stars`); });
    cols.forEach((v, i) => { if (v !== k) out.push(`column ${i} has ${v} stars`); });
    for (const r of new Set(region)) if ((regs.get(r) || 0) !== k) out.push(`region ${r} has ${regs.get(r) || 0} stars`);
    return out;
  },
};
