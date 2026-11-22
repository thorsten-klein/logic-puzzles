// Extra checks for Shikaku, used by tests/games.spec.js (shared tests: lib/suite.js).

module.exports = {
  // Coverage: a board with two answers makes the solver search (and the
  // share code is refused).
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      // 2×2, a "2" in two opposite corners: across or down both fit.
      try { cfg.decode({ r: 2, c: 2, g: '2..2' }); } catch { /* two answers */ }
    });
  },
};
