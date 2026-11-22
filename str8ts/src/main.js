// Str8ts. Fill the white cells with numbers 1 to N (N = grid size). No
// number repeats in a row or column (black cells hold no numbers here).
// Black cells split rows and columns into stretches; each stretch holds
// a run of consecutive numbers in any order (like 4-2-3). Some numbers
// are given. Uses the Latin helpers for the run rule.

(() => {
  Latin.startStretchGame({
    id: 'str8ts',
    name: 'Str8ts',
    rules: 'Fill the white cells with the numbers 1 to N (N is the grid size). No number repeats in a row or column. ' +
      'Black cells split rows and columns into stretches; each stretch holds a run of consecutive numbers in any order (like 4-2-3).',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Straight as can be — nicely done.',
    boardClass: 's8-board',
    uniqueLine: true,
    hintReason: (v) => `Only ${v} fits here: no repeats in its row and column, and its stretch must be a run of consecutive numbers.`,
  });
})();
