// Extra checks for Snake, used by tests/games.spec.js (shared tests: lib/suite.js).
// The coverage workout gets extra steps: the deduction finder on many
// boards (with and without the no-touch rule), broken game IDs, and the
// solver on odd puzzles.

module.exports = {
  async workout(page) {
    await page.evaluate(() => {
      const tryIt = (f) => { try { return f(); } catch { return undefined; } };
      // Many boards: random partial marks (mostly right, a few wrong),
      // then a short hint walk from there. Rare deductions need a few
      // hundred boards.
      const stop = Date.now() + 100000;
      for (let b = 0; ; b++) {
        if (Date.now() >= stop) break;
        const p = tryIt(() => Generator.generate(5 + (b % 5), b % 3 !== 0));
        if (!p) continue;
        const sol = new Set(p.solution.map(([r, c]) => r * p.size + c));
        for (let t = 0; t < 30; t++) {
          const { filled, marked } = randomMarks(p.size * p.size, sol);
          hintWalk(p, filled, marked);
          tryIt(() => Hint.findAll(p, filled, marked));
        }
        if (b % 20 === 0) { tryIt(() => Solver.solve(p, 2)); tryIt(() => Solver.solve(p, 1, { maxNodes: 5 })); }
      }
      // Random marks: mostly right, a few wrong.
      function randomMarks(N, sol) { // NOSONAR: evaluated in browser context
        const filled = new Set(), marked = new Set();
        for (let k = 0; k < N; k++) {
          const x = Math.random();
          if (x < 0.25) (sol.has(k) ? filled : marked).add(k);
          else if (x > 0.97) (sol.has(k) ? marked : filled).add(k);
        }
        return { filled, marked };
      }
      // A short hint walk from the marks.
      function hintWalk(p, filled, marked) {
        for (let i = 0; i < 60; i++) {
          const h = tryIt(() => Hint.find(p, filled, marked));
          if (!h) break;
          const k = h.r * p.size + h.c;
          if (h.action === 'fill') filled.add(k);
          else if (h.action === 'mark') marked.add(k);
          else { filled.delete(k); marked.delete(k); }
        }
      }
      // Broken game data.
      const { cfg } = window.__puzzleTest;
      for (const d of [null, {}, { s: 2, p: [] }, { s: 5, p: [[0, 0]] }, { s: 5, p: [[0, 0], [9, 9]] },
        { s: 5, p: [[0, 0], 'a'] }, { s: 5, p: [[0, 0], [0, 1]], t: 0 }]) {
        tryIt(() => cfg.decode(d));
      }
      // Odd puzzles for the solver: impossible clues.
      tryIt(() => Solver.solve({ size: 4, head: [0, 0], tail: [3, 3], rowClues: [4, 4, 4, 4], colClues: [0, 0, 0, 0], noTouch: true }, 2));
      tryIt(() => Solver.solve({ size: 4, head: [0, 0], tail: [0, 1], rowClues: [2, 0, 0, 0], colClues: [1, 1, 0, 0], noTouch: false }, 2));
    });
  },
};
