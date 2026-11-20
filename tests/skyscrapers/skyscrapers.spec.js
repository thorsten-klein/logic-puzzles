// Tests for Skyscrapers. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

// Each clue tells how many buildings are seen from its side.
// Clue order: top, bottom, left, right (see skyscrapers/src/rules.js).
puzzleTests('skyscrapers', {
  answer(p) {
    const { n } = p, out = [];
    const line = (i, at) => Array.from({ length: n }, (_, j) => p.solution[at(j)]);
    for (let i = 0; i < n; i++) {
      const views = [
        line(i, (j) => j * n + i), line(i, (j) => (n - 1 - j) * n + i),
        line(i, (j) => i * n + j), line(i, (j) => i * n + n - 1 - j),
      ];
      views.forEach((v, side) => {
        const clue = p.clues[side * n + i];
        let seen = 0, top = 0;
        for (const h of v) if (h > top) { top = h; seen++; }
        if (clue && clue !== seen) out.push(`clue ${side * n + i} is ${clue}, but ${seen} are seen`);
      });
    }
    return out;
  },
});
