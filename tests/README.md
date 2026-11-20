# Tests

The tests use [Playwright Test](https://playwright.dev) with the installed
Google Chrome (no browser download).

    npm install                    # once
    npm test                       # all tests
    npm run test:logic             # logic only (fast, no browser)
    npm run test:ui                # browser only
    FULL=1 npm test                # more sizes and boards
    npx playwright test tests/masyu   # one puzzle
    GAMES=masyu,tapa npm test      # some puzzles
    npm run test:coverage          # code coverage (about 30–60 min)
    WORKERS=8 npm test             # more browsers at once (default 4)

Run one test command at a time: each browser is heavy.

## Layout

- `tests/<slug>/<slug>.spec.js`: one folder per puzzle. It calls
  `puzzleTests(slug, extra)` and holds the rules that only fit this puzzle
  (`extra.answer`) and extra coverage steps (`extra.workout`).
- `hub/hub.spec.js`: the main page (search, tags, sort, views, random).
- `lib/suite.js`: the tests every puzzle gets.
- `lib/coverage.js`: the coverage workout per puzzle.
- `coverage-report.js`: turns the coverage data into line coverage.
- `lib/kinds.js`: checks per kind of puzzle (the shared engine in
  `src/`), plus grid helpers for the spec files.
- `lib/games.js`: loads a game's code in Node and runs the board checks.

## What is tested

Logic (`@logic`, in Node, for the smallest and largest size):

- A board is made within 30 seconds (the page also retries once).
- It has exactly one answer: the share data is solved again from scratch.
- Save / load keeps the board, and an empty board is not solved.
- The share code stays the same after decode and encode.
- Applying only hints, one after the other, solves the board.
- Hints use only what the player can see. The hidden answer is watched
  while a hint is made. If a hint reads the answer at a cell the player
  has not filled yet, its text must say openly that it is a reveal
  ("No simple step is left. ..."). Otherwise the test fails.
- One change breaks the answer: each single cell change of the solved
  board must stop it from counting as solved.
- Given cells match the answer.
- The answer fits the rules of its kind:

  | Kind | Check |
  | --- | --- |
  | binary | cells are shaded or white, both occur |
  | latin | every row and column holds the same values |
  | loop | one closed loop, each cell has 0 or 2 lines |
  | links | lines are open paths, no loops or branches |
  | parts | walls fit the regions, regions are connected |
  | pieces | pieces are connected, do not overlap, one clue each |
  | rects | rectangles fill the grid, one clue each |
  | regionnum | a region of size s holds 1..s |
  | numberpath | 1..N, each next number touches the one before |
  | fillo | a group of equal numbers n has n cells |
  | moves | pieces end on different cells, one has to move |
  | words | paths touch by sides and spell the listed words |

- The answer fits the puzzle's own rules, for the puzzles that have them
  in their spec file (Calcudoku, Skyscrapers, Nurikabe, Hitori, ...).

Browser (`@ui`, in Chrome, for each puzzle):

- The setup screen shows the example and its solution.
- Get Hint + Apply solve the board, and Submit says "Correct".
- Undo and redo work.
- The "Current state" share link brings the board back.
- The red/green view (Submit and Show solution) marks a wrong cell red,
  marks nothing on a correct part, and marks missing parts yellow.

## Code coverage

`npm run test:coverage` runs a workout per puzzle in Chrome and records
which lines ran. The workout plays every size, clicks, drags and types
on the board, presses every button and popup, opens broken and real share
links, and calls the game code with odd input: broken share data, one
clue less, no clues, failing engine helpers, a clock that runs out, and
many random boards for hints. Some puzzles add own steps
(`extra.workout`).

The report (`coverage/summary.txt`, missed lines in
`coverage/missed.txt`) counts only runs of the current version of each
file. `node tests/coverage-report.js masyu` lists the missed lines of one
puzzle.

Kakuro and Snake have their own pages: they are tested in the browser
only, and their hints have no Apply button.
