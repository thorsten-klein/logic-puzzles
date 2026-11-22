// Extra checks for Hitori, used by tests/games.spec.js (shared tests: lib/suite.js).

const { groupsOf, sideNbs } = require('../lib/kinds');

// White numbers never repeat in a row or column. Shaded cells (1) never
// touch by a side. White cells stay connected.
module.exports = {
  answer(p) {
    const { n, nums, solution: s } = p, out = [];
    // White numbers of a line (cell index by position j).
    const whites = (at) => [...new Array(n).keys()].map(at).filter((k) => s[k] === 2).map((k) => nums[k]);
    const repeats = (list) => new Set(list).size !== list.length;
    for (let i = 0; i < n; i++) {
      if (repeats(whites((j) => i * n + j))) out.push(`row ${i} repeats a number`);
      if (repeats(whites((j) => j * n + i))) out.push(`column ${i} repeats a number`);
    }
    for (let k = 0; k < n * n; k++) if (s[k] === 1 && sideNbs(n, n, k).some((j) => s[j] === 1)) out.push(`shaded cells touch at ${k}`);
    if (groupsOf(n, n, (k) => s[k] === 2).length !== 1) out.push('white cells are split');
    return out;
  },
};
