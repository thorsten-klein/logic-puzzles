// Tests for Every Second Turn. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('every-second-turn', {
  // Coverage: some boards need given line pieces before logic solves them;
  // that happens on a few boards in a dozen.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      for (let i = 0; i < 24; i++) cfg.generate(cfg.size.min + (i % (cfg.size.max - cfg.size.min + 1)));
    });
  },
});
