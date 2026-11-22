// Extra checks for Kakuro, used by tests/games.spec.js (shared tests: lib/suite.js).
// The coverage workout gets extra steps: the deduction finder on many
// boards, broken game IDs, and the solver.

module.exports = {
  async workout(page) {
    await page.evaluate(() => {
      const tryIt = (f) => { try { return f(); } catch { return undefined; } };
      const { cfg } = window.__puzzleTest;
      const stop = Date.now() + 40000;
      for (const size of [5, 6, 7, 8]) {
        if (Date.now() > stop) break;
        const p = tryIt(() => Generator.generate(size));
        if (!p) continue;
        hintWalk(p);
        // Random boards: right, half right, and with mistakes.
        for (let t = 0; t < 60 && Date.now() < stop; t++) tryIt(() => Hint.findAll(p, randomFill(p, [0.3, 0.6, 0.15][t % 3])));
        tryIt(() => Solver.solve(p, 2));
        tryIt(() => Solver.solve(p, 2, { maxNodes: 3 }));
        tryIt(() => cfg.decode(cfg.encode(p)));
      }
      // Hint walk: fill the first forced cell until none is left.
      function hintWalk(p) { // NOSONAR: evaluated in browser context
        const filled = new Map(Object.entries(p.given).map(([k, v]) => [Number(k), v]));
        for (let i = 0; i < 300; i++) {
          const h = Hint.findAll(p, filled)?.[0];
          if (h?.idx === undefined || !h.digit) break;
          filled.set(h.idx, h.digit);
        }
      }
      // White cells: right with chance `right`, a few random digits.
      function randomFill(p, right) { // NOSONAR: evaluated in browser context
        const filled = new Map();
        for (let k = 0; k < p.rows * p.cols; k++) {
          if (p.layout[k]) continue;
          const x = Math.random();
          if (x < right) filled.set(k, p.solution[k]);
          else if (x > 0.92) filled.set(k, 1 + Math.floor(Math.random() * 9));
        }
        return filled;
      }
      // Broken game data.
      for (const d of [null, {}, { r: 2, c: 2 }, { r: 4, c: 4, g: 'x' }, { r: 3, c: 3, g: '#########', gv: 'x' },
        { r: 3, c: 3, g: '##1##1#11', gv: [0] }, { r: 3, c: 3, g: '###########', gv: [] }]) {
        tryIt(() => cfg.decode(d));
      }
    });
  },
};
