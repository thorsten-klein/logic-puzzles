// Skyscrapers board: the grid with clue numbers on all four sides.
// Exposes the global `UI`.

const UI = (() => {
  function render(p, entries, opts = {}) {
    const { n, clues, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = PuzzleShell.fitCell(n + 2, 46);
    const hintCells = new Set(hint ? hint.cells : []);
    // Map border positions to clue indexes.
    const clueAt = (r, c) => {
      if (r === 0 && c >= 1 && c <= n) return clues[c - 1];
      if (r === n + 1 && c >= 1 && c <= n) return clues[n + c - 1];
      if (c === 0 && r >= 1 && r <= n) return clues[2 * n + r - 1];
      if (c === n + 1 && r >= 1 && r <= n) return clues[3 * n + r - 1];
      return 0;
    };
    return PuzzleShell.gridBoard({
      rows: n + 2, cols: n + 2, cellPx: s, className: 'pz-board sk-board', readonly,
      renderCell(K, el) {
        const R = Math.floor(K / (n + 2)), C = K % (n + 2);
        if (R === 0 || C === 0 || R === n + 1 || C === n + 1) {
          el.className = 'clue';
          el.textContent = clueAt(R, C) || '';
          return;
        }
        const r = R - 1, c = C - 1, k = r * n + c;
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        } else if (readonly) {
          el.textContent = entries[k] || '';
          el.classList.add('entry');
        } else {
          el.appendChild(PuzzleShell.digitInput({ r, c, value: entries[k], max: n,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  return { render };
})();
