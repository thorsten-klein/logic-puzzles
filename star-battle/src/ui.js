// Star Battle board. Left click: empty → dot → star → empty.
// Right click goes the other way. Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, YES, NO } = Binary;
  const TINTS = ['#fde2e4', '#e2ece9', '#fff1e6', '#dfe7fd', '#f0efeb', '#e9edc9', '#fad2e1', '#cddafd', '#eae4e9', '#d8e2dc'];

  function render(p, state, opts = {}) {
    const { n, region, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : state;
    const hintCells = new Set(hint ? hint.cells : []);
    const area = new Set(hint && hint.area ? hint.area : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 46), className: 'pz-board pz-regions sb-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, region, n, n);
        el.style.background = TINTS[region[k] % TINTS.length];
        if (shown[k] === YES) { el.classList.add('star'); el.textContent = '★'; }
        if (shown[k] === NO && !result) el.classList.add('dot');
        if (result && state[k] !== UNKNOWN) el.classList.add(state[k] === solution[k] ? 'ok' : 'bad');
        else if (result && solution[k] === YES) el.classList.add('miss'); // not entered yet
        if (area.has(k)) el.classList.add('area');
        if (hintCells.has(k)) el.classList.add('hint');
      },
      onCell(k, ev) {
        const order = ev.button === 2 ? [UNKNOWN, YES, NO] : [UNKNOWN, NO, YES];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
