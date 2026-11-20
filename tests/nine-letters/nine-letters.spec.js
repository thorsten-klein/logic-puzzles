// Tests for Nine Letters. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('nine-letters', {
  // Coverage: a word marked in the wrong block gets an "undo" hint.
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      for (const n of [cfg.size.min, cfg.size.def]) {
        const p = cfg.generate(n);
        if (!p || p.solution.length < 2) continue;
        const s = cfg.newState(p);
        p.solution[1].forEach((k) => { s[k] = 1; });
        const hs = cfg.hints(p, s);
        if (hs[0]) cfg.applyHint(p, s, hs[0]);
        // The last word in the second word's block: the solver places the
        // first word, fails later and steps back.
        const u = cfg.newState(p);
        p.solution[1].forEach((k) => { u[k] = p.words.length; });
        cfg.hints(p, u);
        // Half the words marked, the rest found by the solver.
        const t = cfg.newState(p);
        p.solution.forEach((cells, w) => { if (w % 2) cells.forEach((k) => { t[k] = w + 1; }); });
        cfg.hints(p, t);
      }
    });
  },
});
