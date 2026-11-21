// Tests for Spider Web. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('spider-web', {
  // Coverage: reading share codes finds the word's path, sometimes after a
  // wrong turn.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      // JSON round trip, like a share link.
      for (let i = 0; i < 10; i++) cfg.decode(JSON.parse(JSON.stringify(cfg.encode(cfg.generate(cfg.size.min + (i % 2)))))); // NOSONAR
    });
  },
});
