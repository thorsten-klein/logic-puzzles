// Extra checks for Futoshiki, used by tests/games.spec.js (shared tests: lib/suite.js).

// Every sign between two cells holds.
module.exports = {
  answer(p) {
    const { n, h, v } = p, s = p.solution, out = [];
    // "<" and "^": the first is smaller; ">" and "v": the first is bigger.
    const broken = (sign, a, b) => ({ '<': a >= b, '^': a >= b, '>': a <= b, v: a <= b })[sign] ?? false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) {
      const a = s[r * n + c], b = s[r * n + c + 1], sign = h[r * (n - 1) + c];
      if (broken(sign, a, b)) out.push(`${a} ${sign} ${b} at row ${r}`);
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) {
      const a = s[r * n + c], b = s[(r + 1) * n + c], sign = v[r * n + c];
      if (broken(sign, a, b)) out.push(`${a} ${sign} ${b} at column ${c}`);
    }
    return out;
  },
};
