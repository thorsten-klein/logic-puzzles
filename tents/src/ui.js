// Tents board with tent counts above and left of the grid.
// Left click: empty → tent → grass → empty. Right click goes the other way.
// Exposes the global `UI`.

const UI = (() => {
  const { UNKNOWN, YES, NO } = Binary;

  function render(p, state, opts = {}) {
    const { n, trees, rows, cols, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : state;
    const hintCells = new Set(hint ? hint.cells : []);
    const count = (cells) => cells.filter((k) => state[k] === YES).length;
    return PuzzleShell.gridBoard({
      rows: n + 1, cols: n + 1, cellPx: PuzzleShell.fitCell(n + 1, 42), className: 'pz-board te-board', readonly,
      renderCell(K, el) {
        const R = Math.floor(K / (n + 1)) - 1, C = (K % (n + 1)) - 1;
        if (R < 0 || C < 0) {
          el.className = 'clue' + (R < 0 ? ' clue-top' : ' clue-left');
          if (R < 0 && C >= 0) {
            el.textContent = cols[C];
            if (count(Array.from({ length: n }, (_, i) => i * n + C)) === cols[C]) el.classList.add('done');
          }
          if (C < 0 && R >= 0) {
            el.textContent = rows[R];
            if (count(Array.from({ length: n }, (_, i) => R * n + i)) === rows[R]) el.classList.add('done');
          }
          return;
        }
        const k = R * n + C;
        if (trees[k]) { el.classList.add('tree'); el.textContent = '🌲'; return; }
        if (shown[k] === YES) { el.classList.add('tent'); el.textContent = '⛺'; }
        if (shown[k] === NO && !result) el.classList.add('grass');
        if (result && state[k] !== UNKNOWN) el.classList.add(state[k] === solution[k] ? 'ok' : 'bad');
        else if (result && solution[k] === YES) el.classList.add('miss'); // not entered yet
        if (hintCells.has(k)) el.classList.add('hint');
        el.dataset.k2 = k;
      },
      onCell(K, ev) {
        const R = Math.floor(K / (n + 1)) - 1, C = (K % (n + 1)) - 1;
        if (R < 0 || C < 0) return;
        const k = R * n + C;
        if (trees[k]) return;
        const order = ev.button === 2 ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO];
        state[k] = order[(order.indexOf(state[k]) + 1) % 3];
        onChange();
      },
    });
  }

  return { render };
})();
