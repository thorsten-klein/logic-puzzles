// Tests for every playable puzzle: the shared tests (lib/suite.js) plus
// the puzzle's own checks from tests/<slug>/<slug>.checks.js, if any.
// One puzzle only: GAMES=lits npm test (a list works too: GAMES=lits,kakuro).

const fs = require('node:fs');
const path = require('node:path');
const { test, puzzleTests, title } = require('./lib/suite');
const { playableGames } = require('./lib/games');

for (const slug of playableGames()) {
  const file = path.join(__dirname, slug, `${slug}.checks.js`);
  const extra = fs.existsSync(file) ? require(file) : {};
  test.describe(title(slug), () => puzzleTests(slug, extra));
}
