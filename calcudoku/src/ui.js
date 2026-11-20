// Calcudoku board: thick lines around cages, the cage rule in the
// top-left cell of each cage. Exposes the global `UI`.

const UI = (() => {
  function render(p, entries, opts = {}) {
    const { n, cage, cages, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const labelCell = new Map(cages.map((cg, i) => [Math.min(...cg.cells), i]));
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 56), className: 'pz-board cd-board', readonly,
      renderCell(k, el) {
        const r = Math.floor(k / n), c = k % n;
        const same = (rr, cc) => rr >= 0 && cc >= 0 && rr < n && cc < n && cage[rr * n + cc] === cage[k];
        if (!same(r - 1, c)) el.classList.add('bt');
        if (!same(r + 1, c)) el.classList.add('bb');
        if (!same(r, c - 1)) el.classList.add('bl');
        if (!same(r, c + 1)) el.classList.add('br');
        if (labelCell.has(k)) {
          const cg = cages[labelCell.get(k)];
          const lab = document.createElement('span');
          lab.className = 'cage-label';
          lab.textContent = `${cg.target}${Rules.SYMBOL[cg.op]}`;
          el.appendChild(lab);
        }
        if (hintCells.has(k)) el.classList.add('hint');
        if (result) {
          el.append(String(solution[k]));
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) {
          el.append(entries[k] ? String(entries[k]) : '');
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
