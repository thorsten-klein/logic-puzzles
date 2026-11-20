// Light Up board. Left click: unknown → bulb → no-bulb dot → unknown.
// Right click goes the other way. Lit cells are yellow.
// Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, BULB, NONE, WHITE } = Rules;

  function render(p, state, opts = {}) {
    const { R, C, walls, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : state;
    const lit = Rules.litMap(p, shown);
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 42), className: 'pz-board lu-board', readonly,
      renderCell(k, el) {
        if (walls[k] !== WHITE) {
          el.classList.add('wall');
          if (walls[k] >= 0) el.textContent = walls[k];
          if (hint && hint.at === k) el.classList.add('hint-clue');
          return;
        }
        if (lit[k]) el.classList.add('lit');
        if (shown[k] === BULB) {
          el.classList.add('bulb');
          if (!result && p.sight[k].some((j) => state[j] === BULB)) el.classList.add('clash');
        }
        if (shown[k] === NONE && !result) el.classList.add('dot');
        if (result && state[k] !== UNKNOWN) {
          el.classList.add((state[k] === BULB) === (solution[k] === BULB) ? 'ok' : 'bad');
        } else if (result && solution[k] === BULB) el.classList.add('miss'); // not entered yet
        if (hintCells.has(k)) el.classList.add('hint');
      },
      onCell(k, ev) {
        if (walls[k] !== WHITE) return;
        const order = ev.button === 2 ? [UNKNOWN, NONE, BULB] : [UNKNOWN, BULB, NONE];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
