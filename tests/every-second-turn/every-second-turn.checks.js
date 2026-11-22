// Extra checks for Every Second Turn, used by tests/games.spec.js (shared tests: lib/suite.js).

module.exports = {
  // Coverage: some boards need given line pieces before logic solves them;
  // that happens on a few boards in a dozen.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      for (let i = 0; i < 24; i++) cfg.generate(cfg.size.min + (i % (cfg.size.max - cfg.size.min + 1)));
    });
  },
};
