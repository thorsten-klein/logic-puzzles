// Tests for LITS. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');
const { groupsOf, connected } = require('../lib/kinds');

// Each room has four connected shaded cells (1). All shaded cells
// connect, and no 2×2 block is shaded.
puzzleTests('lits', {
  answer(p) {
    const { R, C, room, solution: s } = p, out = [];
    for (const r of new Set(room)) {
      const cells = [...room.keys()].filter((k) => room[k] === r && s[k] === 1);
      if (cells.length !== 4) out.push(`room ${r} has ${cells.length} shaded cells`);
      else if (!connected(R, C, cells)) out.push(`room ${r}: shaded cells are split`);
    }
    if (groupsOf(R, C, (k) => s[k] === 1).length !== 1) out.push('shaded cells are split');
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      if ([k, k + 1, k + C, k + C + 1].every((x) => s[x] === 1)) out.push(`2×2 shaded at ${k}`);
    }
    return out;
  },
});
