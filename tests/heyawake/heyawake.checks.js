// Extra checks for Heyawake, used by tests/games.spec.js (shared tests: lib/suite.js).

const { groupsOf, sideNbs } = require('../lib/kinds');

// A room number counts its shaded cells (1). Shaded cells never touch
// by a side. White cells stay connected. No straight white line crosses
// two room borders.
module.exports = {
  answer(p) {
    const { R, C, room, clues, solution: s } = p, out = [];
    clues.forEach((v, r) => {
      const got = [...room.keys()].filter((k) => room[k] === r && s[k] === 1).length;
      if (v >= 0 && got !== v) out.push(`room ${r}: ${got} shaded, clue ${v}`);
    });
    for (let k = 0; k < R * C; k++) if (s[k] === 1 && sideNbs(R, C, k).some((j) => s[j] === 1)) out.push(`shaded cells touch at ${k}`);
    if (groupsOf(R, C, (k) => s[k] === 2).length !== 1) out.push('white cells are split');
    const runs = (cells) => {
      let borders = 0;
      for (let i = 1; i < cells.length; i++) {
        if (s[cells[i]] !== 2 || s[cells[i - 1]] !== 2) { borders = 0; continue; }
        if (room[cells[i]] !== room[cells[i - 1]] && ++borders >= 2) out.push(`white line crosses two borders at ${cells[i]}`);
      }
    };
    for (let r = 0; r < R; r++) runs([...new Array(C).keys()].map((c) => r * C + c));
    for (let c = 0; c < C; c++) runs([...new Array(R).keys()].map((r) => r * C + c));
    return out;
  },
};
