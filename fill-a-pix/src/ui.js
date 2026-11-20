// Fill-a-Pix board. Left click: unknown → filled → empty mark → unknown.
// Right click goes the other way. Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, FILLED, EMPTY } = Rules;

  function render(p, state, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 40), className: 'pz-board fp-board', readonly,
      renderCell(k, el) {
        if (clues[k] >= 0) el.textContent = clues[k];
        let s = state[k];
        if (result) {
          if (s !== UNKNOWN) el.classList.add(s === solution[k] ? 'ok' : 'bad');
          else if (solution[k] === FILLED) el.classList.add('miss'); // not entered yet
          s = solution[k];
        }
        if (s === FILLED) el.classList.add('shaded');
        if (s === EMPTY && !result) el.classList.add('dot');
        if (hintCells.has(k)) el.classList.add('hint');
        if (hint && (hint.clue === k || hint.other === k)) el.classList.add('hint-clue');
      },
      onCell(k, ev) {
        const order = ev.button === 2 ? [UNKNOWN, EMPTY, FILLED] : [UNKNOWN, FILLED, EMPTY];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
