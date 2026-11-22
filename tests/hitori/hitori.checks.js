// Extra checks for Hitori, used by tests/games.spec.js (shared tests: lib/suite.js).

const { groupsOf, sideNbs } = require('../lib/kinds');

// White numbers never repeat in a row or column. Shaded cells (1) never
// touch by a side. White cells stay connected.
module.exports = {
  answer(p) {
    const { n, nums, solution: s } = p, out = [];
    for (let i = 0; i < n; i++) {
      const row = [], col = [];
      for (let j = 0; j < n; j++) {
        if (s[i * n + j] === 2) row.push(nums[i * n + j]);
        if (s[j * n + i] === 2) col.push(nums[j * n + i]);
      }
      if (new Set(row).size !== row.length) out.push(`row ${i} repeats a number`);
      if (new Set(col).size !== col.length) out.push(`column ${i} repeats a number`);
    }
    for (let k = 0; k < n * n; k++) if (s[k] === 1 && sideNbs(n, n, k).some((j) => s[j] === 1)) out.push(`shaded cells touch at ${k}`);
    if (groupsOf(n, n, (k) => s[k] === 2).length !== 1) out.push('white cells are split');
    return out;
  },
};
