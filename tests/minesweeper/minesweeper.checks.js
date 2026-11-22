// Extra checks for Minesweeper, used by tests/games.spec.js (shared tests: lib/suite.js).

const { kingNbs } = require('../lib/kinds');

// A number is never a mine and counts the mines (1) around it.
module.exports = {
  answer(p) {
    const { R, C, clues, solution: s } = p, out = [];
    for (let k = 0; k < R * C; k++) {
      if (clues[k] < 0) continue;
      if (s[k] === 1) out.push(`mine on clue ${k}`);
      const mines = kingNbs(R, C, k).filter((j) => s[j] === 1).length;
      if (mines !== clues[k]) out.push(`cell ${k}: clue ${clues[k]}, ${mines} mines`);
    }
    return out;
  },
};
