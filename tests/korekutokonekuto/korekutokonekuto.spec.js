// Tests for Korekutokonekuto. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('korekutokonekuto', {
  // Coverage: a line where the answer has none gets a "remove" hint.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      const p = cfg.generate(cfg.size.min);
      const s = cfg.newState(p);
      const j = Array.from(p.solution).findIndex((v) => v === 0);
      if (j < 0) return;
      s[j] = 1;
      const hs = cfg.hints(p, s);
      cfg.applyHint(p, s, hs[0]);
      if (s[j] !== 0) throw new Error('the wrong line was not removed');
    });
  },
});
