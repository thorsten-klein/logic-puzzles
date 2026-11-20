// Tests for Nanro. The shared tests are in tests/lib/suite.js.

const { puzzleTests } = require('../lib/suite');

puzzleTests('nanro', { givenNotAnswer: 'givens are numbers, the answer is which cells hold one' });
