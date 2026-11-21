// Futoshiki board: cells with sign slots between them.
// Exposes the global `UI`.

const UI = (() => {
  function render(p, entries, opts = {}) {
    const { n, h, v, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / (n * 1.45)));
    const g = Math.round(s * 0.45);
    const board = document.createElement('div');
    board.className = 'board pz-board fu-board' + (readonly ? ' readonly' : '');
    const tracks = Array.from({ length: 2 * n - 1 }, (_, i) => (i % 2 ? `${g}px` : `${s}px`)).join(' ');
    board.style.gridTemplateColumns = tracks;
    board.style.gridTemplateRows = tracks;
    board.style.setProperty('--cell', `${s}px`);
    const hintCells = new Set(hint ? hint.cells : []);
    for (let R = 0; R < 2 * n - 1; R++) for (let C = 0; C < 2 * n - 1; C++) {
      const el = document.createElement('div');
      board.appendChild(el);
      const r = R >> 1, c = C >> 1;
      if (R % 2 && C % 2) { el.className = 'gap'; continue; }
      if (C % 2) { el.className = 'sign'; el.textContent = { '<': '<', '>': '>' }[h[r * (n - 1) + c]] || ''; continue; }
      if (R % 2) { el.className = 'sign'; el.textContent = { '^': '∧', v: '∨' }[v[r * n + c]] || ''; continue; }
      const k = r * n + c;
      el.className = 'cell';
      if (hintCells.has(k)) el.classList.add('hint');
      if (given[k]) { el.classList.add('given'); el.textContent = given[k]; continue; }
      if (result) {
        el.textContent = solution[k];
        el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
      } else if (readonly) {
        el.textContent = entries[k] || '';
        el.classList.add('entry');
      } else {
        el.appendChild(PuzzleShell.digitInput({ r, c, value: entries[k], max: n,
          onSet: (val) => { entries[k] = val; onChange(false); } }));
      }
    }
    return board;
  }

  return { render };
})();
