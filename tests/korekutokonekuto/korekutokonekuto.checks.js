// Extra checks for Korekutokonekuto, used by tests/games.spec.js (shared tests: lib/suite.js).

module.exports = {
  // Coverage: a line where the answer has none gets a "remove" hint.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      const p = cfg.generate(cfg.size.min);
      const s = cfg.newState(p);
      const j = Array.from(p.solution).indexOf(0);
      if (j < 0) return;
      s[j] = 1;
      const hs = cfg.hints(p, s);
      cfg.applyHint(p, s, hs[0]);
      if (s[j] !== 0) throw new Error('the wrong line was not removed');
    });
  },
};
