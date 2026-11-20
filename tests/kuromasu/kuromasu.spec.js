// Tests for Kuromasu. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');
const { groupsOf, sideNbs } = require('../lib/kinds');

// A number is white and sees that many white cells in its row and
// column, itself included. Shaded cells (1) never touch by a side, and
// white cells stay connected.
puzzleTests('kuromasu', {
  answer(p) {
    const { n, clues, solution: s } = p, out = [];
    for (let k = 0; k < n * n; k++) {
      if (s[k] === 1 && sideNbs(n, n, k).some((j) => s[j] === 1)) out.push(`shaded cells touch at ${k}`);
      if (!clues[k]) continue;
      if (s[k] === 1) out.push(`clue ${k} is shaded`);
      let seen = 1;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let r = Math.floor(k / n) + dr, c = (k % n) + dc;
        while (r >= 0 && c >= 0 && r < n && c < n && s[r * n + c] === 2) { seen++; r += dr; c += dc; }
      }
      if (seen !== clues[k]) out.push(`cell ${k}: clue ${clues[k]}, sees ${seen}`);
    }
    if (groupsOf(n, n, (k) => s[k] === 2).length !== 1) out.push('white cells are split');
    return out;
  },
});
