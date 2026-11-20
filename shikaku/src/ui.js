// Shikaku board. Drag from one corner to the other to draw a rectangle.
// A new rectangle replaces the ones it overlaps. Click a rectangle to
// remove it. Exposes the global `UI`.

const UI = (() => {
  const TINTS = ['#fde2e4', '#e2ece9', '#fff1e6', '#dfe7fd', '#f0efeb', '#e9edc9', '#fad2e1', '#cddafd', '#eae4e9', '#d8e2dc', '#fce1b6', '#d0f4de'];

  function render(p, rects, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : rects;
    const id = Rules.cover(p, shown);
    const good = new Set(solution.map((r) => r.join(',')));
    const hintCells = new Set(hint ? hint.cells : []);
    const board = PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 40), className: 'pz-board pz-regions sh-board', readonly,
      renderCell(k, el) {
        if (clues[k]) el.textContent = clues[k];
        if (id[k] >= 0) {
          el.style.background = TINTS[id[k] % TINTS.length];
          PuzzleShell.regionBorders(el, k, Int32Array.from(id, (v, j) => (v < 0 ? -2 - j : v)), R, C);
        }
        if (result && id[k] >= 0) {
          const mine = rects.some((r) => Rules.cellsOf(r, C).includes(k) && good.has(r.join(',')));
          if (mine) el.classList.add('ok');
        }
        // An answer cell the player has not put in any rectangle yet.
        if (result && id[k] >= 0 && !rects.some((r) => Rules.cellsOf(r, C).includes(k))) el.classList.add('miss');
        // A rectangle of the player that is not in the answer.
        if (result && rects.some((r) => !good.has(r.join(',')) && Rules.cellsOf(r, C).includes(k))) el.classList.add('bad');
        if (hintCells.has(k)) el.classList.add('hint');
        if (hint && hint.mark === k) el.classList.add('hint-clue');
      },
    });
    if (readonly) return board;

    // Drag handling with pointer events (mouse and touch).
    let start = null, preview = [];
    const cellAt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      return el && el.closest('.sh-board') === board && el.dataset.k !== undefined ? Number(el.dataset.k) : null;
    };
    const rectOf = (a, b) => [
      Math.min(Math.floor(a / C), Math.floor(b / C)), Math.min(a % C, b % C),
      Math.max(Math.floor(a / C), Math.floor(b / C)), Math.max(a % C, b % C)];
    const showPreview = (rect) => {
      for (const el of preview) el.classList.remove('drag');
      preview = Rules.cellsOf(rect, C).map((j) => board.children[j]);
      for (const el of preview) el.classList.add('drag');
    };
    board.addEventListener('pointerdown', (ev) => {
      const k = cellAt(ev);
      if (k === null) return;
      ev.preventDefault();
      start = k;
      board.setPointerCapture(ev.pointerId);
      showPreview(rectOf(k, k));
    });
    board.addEventListener('pointermove', (ev) => {
      if (start === null) return;
      const k = cellAt(ev);
      if (k !== null) showPreview(rectOf(start, k));
    });
    board.addEventListener('pointerup', (ev) => {
      if (start === null) return;
      const k = cellAt(ev);
      const end = k === null ? start : k;
      const rect = rectOf(start, end);
      start = null;
      const hit = (r) => !(r[2] < rect[0] || rect[2] < r[0] || r[3] < rect[1] || rect[3] < r[1]);
      if (end === rect[0] * C + rect[1] && rect[0] === rect[2] && rect[1] === rect[3] && id[end] >= 0 &&
          Rules.cellsOf(rects[id[end]], C).length > 1) {
        // Plain click inside a bigger rectangle removes it.
        rects.splice(id[end], 1);
      } else {
        for (let i = rects.length - 1; i >= 0; i--) if (hit(rects[i])) rects.splice(i, 1);
        rects.push(rect);
      }
      onChange();
    });
    board.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const k = cellAt(ev);
      if (k !== null && id[k] >= 0) { rects.splice(id[k], 1); onChange(); }
    });
    return board;
  }

  return { render };
})();
