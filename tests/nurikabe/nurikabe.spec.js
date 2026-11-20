// Tests for Nurikabe. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');
const { groupsOf } = require('../lib/kinds');

// Each island has one number, its size. The sea (1) is connected and
// has no 2×2 block.
puzzleTests('nurikabe', {
  answer(p) {
    const { n, clues, solution: s } = p, out = [];
    for (const g of groupsOf(n, n, (k) => s[k] === 2)) {
      const nums = g.filter((k) => clues[k] > 0);
      if (nums.length !== 1) out.push(`an island at cell ${g[0]} has ${nums.length} numbers`);
      else if (clues[nums[0]] !== g.length) out.push(`island ${clues[nums[0]]} has ${g.length} cells`);
    }
    if (groupsOf(n, n, (k) => s[k] === 1).length > 1) out.push('the sea is split');
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const k = r * n + c;
      if ([k, k + 1, k + n, k + n + 1].every((x) => s[x] === 1)) out.push(`2×2 sea at cell ${k}`);
    }
    return out;
  },
});
