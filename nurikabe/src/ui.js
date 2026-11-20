// Nurikabe board. Left click: unknown → shaded → white dot → unknown.
// Right click goes the other way. Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, YES, NO } = Binary;

  function render(p, state, opts = {}) {
    const { n, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : state;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board nk-board', readonly,
      renderCell(k, el) {
        if (clues[k]) { el.textContent = clues[k]; el.classList.add('numbered'); }
        else if (shown[k] === YES) el.classList.add('shaded');
        else if (shown[k] === NO && !result) el.classList.add('dot');
        if (result && state[k] !== UNKNOWN && !clues[k]) {
          el.classList.add((state[k] === YES) === (solution[k] === YES) ? 'ok' : 'bad');
        } else if (result && solution[k] === YES && !clues[k]) el.classList.add('miss'); // not entered yet
        if (hintCells.has(k)) el.classList.add('hint');
        if (hint && hint.at === k) el.classList.add('hint-clue');
      },
      onCell(k, ev) {
        if (clues[k]) return;
        const order = ev.button === 2 ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
