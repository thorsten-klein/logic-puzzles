// Tests for Arrow Maze. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('arrow-maze', {
  // Coverage: with a fixed random number every walk ends in the same dead
  // end on a 6×6 board, so the generator gives up (and says so).
  async workout(page) {
    await page.evaluate(() => {
      const { cfg } = window.__puzzleTest;
      const realRandom = Math.random, realNow = Date.now;
      let fake = realNow();
      Math.random = () => 0.1;
      Date.now = () => (fake += 60000);
      try { if (cfg.generate(6) !== null) throw new Error('expected no board'); } finally { Math.random = realRandom; Date.now = realNow; }
    });
  },
});
