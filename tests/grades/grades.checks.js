// Extra checks for Grades, used by tests/games.spec.js (shared tests: lib/suite.js).

module.exports = {
  // Coverage: a share code without givens makes the solver search.
  async workout(page) {
    // (Some boards need the search; a few tries find one.)
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      for (let i = 0; i < 12; i++) {
        const d = JSON.parse(JSON.stringify(cfg.encode(cfg.generate(cfg.size.min)))); // NOSONAR: JSON round trip, like a share link
        try { cfg.decode({ ...d, g: d.g.replaceAll(/./g, '0') }); } catch { /* not unique */ }
      }
    });
  },
};
