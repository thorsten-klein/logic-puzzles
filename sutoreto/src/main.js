// Sutoreto. Fill every white cell with a number from 1 to N (N is the
// grid size). Black cells split rows and columns into stretches; each
// stretch holds a run of consecutive numbers in any order (like 4-2-3).
// Numbers may repeat elsewhere in a row or column. Some are given.
// Uses the Latin helpers for the run rule.

(() => {
  Latin.startStretchGame({
    id: 'sutoreto',
    name: 'Sutoreto',
    rules: 'Fill every white cell with a number from 1 to N (N is the grid size). Black cells split rows and columns ' +
      'into stretches; each stretch holds a run of consecutive numbers in any order (like 4-2-3). Numbers may repeat ' +
      'elsewhere in a row or column.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every stretch runs straight — nicely done.',
    boardClass: 'st-board',
    uniqueLine: false,
    hintReason: (v) => `Only ${v} fits here: its stretches across and down must be runs of consecutive numbers.`,
  });
})();
