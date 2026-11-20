// Tests for Binairo. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

// No three equal digits in a line, each line is half 1s and half 0s, and
// no two rows (or columns) are equal. (1 = digit 1, 2 = digit 0.)
puzzleTests('binairo', {
  answer(p) {
    const { n, solution: s } = p, out = [];
    const lines = [];
    for (let i = 0; i < n; i++) {
      lines.push(['row', i, Array.from({ length: n }, (_, j) => s[i * n + j])]);
      lines.push(['column', i, Array.from({ length: n }, (_, j) => s[j * n + i])]);
    }
    for (const [what, i, v] of lines) {
      if (v.filter((x) => x === 1).length * 2 !== n) out.push(`${what} ${i} is not half and half`);
      for (let j = 2; j < n; j++) if (v[j] === v[j - 1] && v[j] === v[j - 2]) out.push(`${what} ${i} has three in a row`);
    }
    for (const what of ['row', 'column']) {
      const keys = lines.filter((l) => l[0] === what).map((l) => l[2].join(''));
      if (new Set(keys).size !== n) out.push(`two ${what}s are equal`);
    }
    return out;
  },
});
