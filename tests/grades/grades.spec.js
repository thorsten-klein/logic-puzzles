// Tests for Grades. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('grades', {
  // Coverage: a share code without givens makes the solver search.
  async workout(page) {
    // (Some boards need the search; a few tries find one.)
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      for (let i = 0; i < 12; i++) {
        const d = JSON.parse(JSON.stringify(cfg.encode(cfg.generate(cfg.size.min))));
        try { cfg.decode({ ...d, g: d.g.replace(/./g, '0') }); } catch { /* not unique */ }
      }
    });
  },
});
