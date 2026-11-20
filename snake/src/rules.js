// Snake puzzle rules and helpers. Exposes the global `Rules`.
//
// A snake is an ordered list of cells [[r, c], ...] forming a path:
//   - consecutive cells are orthogonally adjacent
//   - no cell is visited twice
//   - no two non-consecutive cells are orthogonally adjacent
//     (i.e. the snake does not touch itself along an edge)
// Diagonal contact between non-consecutive cells is allowed; it is
// unavoidable wherever the snake makes a 90 degree turn.

const Rules = (() => {
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const inBounds = (r, c, size) => r >= 0 && r < size && c >= 0 && c < size;

  function computeClues(path, size) {
    const rows = new Array(size).fill(0);
    const cols = new Array(size).fill(0);
    for (const [r, c] of path) { rows[r]++; cols[c]++; }
    return { rows, cols };
  }

  return { ORTHO, DIAG, inBounds, computeClues };
})();
