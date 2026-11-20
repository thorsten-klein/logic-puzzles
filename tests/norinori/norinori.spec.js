// Tests for Norinori. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');
const { sideNbs } = require('../lib/kinds');

// Each room has exactly two shaded cells (1). Each shaded cell touches
// exactly one other shaded cell, so they form dominoes.
puzzleTests('norinori', {
  answer(p) {
    const { R, C, room, solution: s } = p, out = [];
    for (const r of new Set(room)) {
      const got = [...room.keys()].filter((k) => room[k] === r && s[k] === 1).length;
      if (got !== 2) out.push(`room ${r} has ${got} shaded cells`);
    }
    for (let k = 0; k < R * C; k++) {
      if (s[k] !== 1) continue;
      const nb = sideNbs(R, C, k).filter((j) => s[j] === 1).length;
      if (nb !== 1) out.push(`shaded cell ${k} touches ${nb} shaded cells`);
    }
    return out;
  },
});
