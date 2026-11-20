// Hitori board. Left click: unknown → shaded → white → unknown.
// Right click goes the other way. Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, BLACK, WHITE } = Rules;

  function render(p, state, opts = {}) {
    const { n, nums, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n), className: 'pz-board hitori-board', readonly,
      renderCell(k, el) {
        el.textContent = nums[k];
        let s = state[k];
        if (result) {
          const sol = solution[k] === BLACK;
          if (state[k] !== UNKNOWN) el.classList.add((state[k] === BLACK) === sol ? 'ok' : 'bad');
          else if (sol) el.classList.add('miss'); // not entered yet
          s = sol ? BLACK : UNKNOWN;
        }
        if (s === BLACK) el.classList.add('shaded');
        if (s === WHITE) el.classList.add('marked');
        if (hint && hint.k === k) el.classList.add('hint');
      },
      onCell(k, ev) {
        const order = ev.button === 2 ? [UNKNOWN, WHITE, BLACK] : [UNKNOWN, BLACK, WHITE];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
