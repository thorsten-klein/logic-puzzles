// Tests for Tents. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');
const { kingNbs } = require('../lib/kinds');

// As many tents (1) as trees. Tents never touch, not even at a corner,
// and never stand on a tree. The numbers count tents per row and column.
puzzleTests('tents', {
  answer(p) {
    const { n, trees, rows, cols, solution: s } = p, out = [];
    const tents = [...s.keys()].filter((k) => s[k] === 1);
    if (tents.length !== trees.filter(Boolean).length) out.push(`${tents.length} tents for ${trees.filter(Boolean).length} trees`);
    for (const k of tents) {
      if (trees[k]) out.push(`tent on a tree at ${k}`);
      if (kingNbs(n, n, k).some((j) => s[j] === 1)) out.push(`tents touch at ${k}`);
    }
    for (let i = 0; i < n; i++) {
      const r = tents.filter((k) => Math.floor(k / n) === i).length, c = tents.filter((k) => k % n === i).length;
      if (r !== rows[i]) out.push(`row ${i}: ${r} tents, clue ${rows[i]}`);
      if (c !== cols[i]) out.push(`column ${i}: ${c} tents, clue ${cols[i]}`);
    }
    return out;
  },
});
