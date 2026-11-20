// Binairo board. Left click: empty → 0 → 1 → empty.
// Right click goes the other way. Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, YES, NO } = Binary;
  const TEXT = { [YES]: '1', [NO]: '0' };

  function render(p, state, opts = {}) {
    const { n, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 44), className: 'pz-board bi-board', readonly,
      renderCell(k, el) {
        if (given[k]) { el.classList.add('given', `v${given[k]}`); el.textContent = TEXT[given[k]]; return; }
        const v = result ? solution[k] : state[k];
        if (v) { el.textContent = TEXT[v]; el.classList.add('entry', `v${v}`); }
        if (result) el.classList.add(state[k] === solution[k] ? 'ok' : state[k] ? 'bad' : 'show');
        if (hintCells.has(k)) el.classList.add('hint');
      },
      onCell(k, ev) {
        if (given[k]) return;
        const order = ev.button === 2 ? [UNKNOWN, YES, NO] : [UNKNOWN, NO, YES];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
