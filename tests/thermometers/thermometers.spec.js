// Tests for Thermometers. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

// Each thermometer fills from its bulb (first cell) without gaps. The
// numbers count filled cells (1) per row and column.
puzzleTests('thermometers', {
  answer(p) {
    const { R, C, rows, cols, thermos, solution: s } = p, out = [];
    for (const t of thermos) {
      const fill = t.map((k) => s[k] === 1);
      if (fill.some((f, i) => f && i && !fill[i - 1])) out.push(`thermometer from ${t[0]} has a gap`);
    }
    for (let r = 0; r < R; r++) {
      const got = [...Array(C).keys()].filter((c) => s[r * C + c] === 1).length;
      if (got !== rows[r]) out.push(`row ${r}: ${got} filled, clue ${rows[r]}`);
    }
    for (let c = 0; c < C; c++) {
      const got = [...Array(R).keys()].filter((r) => s[r * C + c] === 1).length;
      if (got !== cols[c]) out.push(`column ${c}: ${got} filled, clue ${cols[c]}`);
    }
    return out;
  },
});
