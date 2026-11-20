// Snake entry point. Plugs the game into the shared shell.
//
// Share data: { s: size, p: [[r, c], ...], t: 0 }. `p` is the solution
// path from head to tail; head, tail and clues are worked out from it.
// t: 0 means the snake may touch itself (the classic rule is off).
// State: one number per cell, 0 = open, 1 = snake, 2 = X (no snake).
// Head and tail are always snake and are not in the state.

(() => {
  const OPEN = 0, FILL = 1, MARK = 2;

  // Full puzzle from the solution path.
  function build(size, path, noTouch) {
    const { rows, cols } = Rules.computeClues(path, size);
    return {
      size, noTouch,
      head: path[0].slice(), tail: path[path.length - 1].slice(),
      rowClues: rows, colClues: cols,
      solution: path.map(([r, c]) => [r, c]),
    };
  }

  const isEnd = (p, k) => k === p.head[0] * p.size + p.head[1] || k === p.tail[0] * p.size + p.tail[1];
  const solutionSet = (p) => new Set(p.solution.map(([r, c]) => r * p.size + c));
  // Snake cells on the board: head, tail and the filled cells.
  function snakeSet(p, s) {
    const out = new Set([p.head[0] * p.size + p.head[1], p.tail[0] * p.size + p.tail[1]]);
    s.forEach((v, k) => { if (v === FILL) out.add(k); });
    return out;
  }

  // Board: clue row on top, clue column on the left.
  function render(p, s, opts = {}) {
    const { readonly, result, hint, onChange } = opts;
    const n = p.size, W = n + 1;
    const hintCells = new Set(hint ? hint.cells : []);
    const sol = solutionSet(p), mine = snakeSet(p, s);
    // A clue turns green when its line has exactly that many snake cells.
    const rowCount = new Array(n).fill(0), colCount = new Array(n).fill(0);
    for (const k of mine) { rowCount[Math.floor(k / n)]++; colCount[k % n]++; }
    return PuzzleShell.gridBoard({
      rows: W, cols: W, cellPx: PuzzleShell.fitCell(W, 38), className: 'pz-board snake-board', readonly,
      renderCell(K, el) {
        const R = Math.floor(K / W) - 1, C = (K % W) - 1;
        if (R < 0 || C < 0) {
          el.className = R < 0 && C < 0 ? 'corner' : 'clue';
          if (R < 0 && C >= 0) { el.textContent = p.colClues[C]; el.classList.toggle('done', !readonly && colCount[C] === p.colClues[C]); }
          if (C < 0 && R >= 0) { el.textContent = p.rowClues[R]; el.classList.toggle('done', !readonly && rowCount[R] === p.rowClues[R]); }
          return;
        }
        const k = R * n + C;
        el.dataset.r = R;
        el.dataset.c = C;
        if (hintCells.has(k)) el.classList.add('hint');
        if (isEnd(p, k)) {
          el.classList.add('endpoint', 'filled');
          el.textContent = k === p.head[0] * n + p.head[1] ? 'H' : 'T';
          return;
        }
        if (result) {
          if (sol.has(k)) el.classList.add('filled');
          if (s[k] === FILL) el.classList.add(sol.has(k) ? 'ok' : 'bad');
          else if (s[k] === MARK && sol.has(k)) el.classList.add('bad');
          else if (sol.has(k)) el.classList.add('miss');
          return;
        }
        if (s[k] === FILL) el.classList.add('filled');
        if (s[k] === MARK) el.classList.add('marked');
      },
      // Left click: snake or open. Right click: X or open.
      onCell(K, ev) {
        const R = Math.floor(K / W) - 1, C = (K % W) - 1;
        if (R < 0 || C < 0) return;
        const k = R * n + C;
        if (isEnd(p, k)) return;
        const v = ev.button === 2 ? MARK : FILL;
        s[k] = s[k] === v ? OPEN : v;
        onChange();
      },
    });
  }

  // "(row 3, col 5)" in the hint texts becomes "E3", like the labels.
  const cellNames = (text) => text.replace(/\(?row (\d+), col(?:umn)? (\d+)\)?/g,
    (m, r, c) => PuzzleShell.colName(Number(c) - 1) + r);

  function hints(p, s) {
    const filled = new Set(), marked = new Set();
    s.forEach((v, k) => { if (v === FILL) filled.add(k); else if (v === MARK) marked.add(k); });
    const verb = { fill: 'Fill this cell. ', mark: 'Mark this cell with X. ', clear: 'Clear this cell. ' };
    return Hint.findAll(p, filled, marked).map((h) => ({
      cells: [h.r * p.size + h.c],
      v: h.action === 'fill' ? FILL : h.action === 'mark' ? MARK : OPEN,
      reason: (verb[h.action] || '') + cellNames(h.reason || ''),
    }));
  }

  PuzzleShell.start({
    id: 'snake',
    name: 'Snake',
    rules: 'Draw a snake from H to T. The numbers count the snake cells in each row and column. ' +
      'The snake is one cell wide and never branches. With the classic rule it never touches itself, not even by a side.',
    controls: 'Click a cell to fill it with snake, click again to clear it. Right click marks a cell with an X (no snake).',
    size: { min: 5, max: 15, def: 8 },
    options: [{ id: 'noTouch', label: 'Snake may not touch itself (classic rule)', def: true }],
    solvedText: 'The snake is complete — nicely done.',
    generate: (n, opts = {}) => Generator.generate(n, opts.noTouch !== false),
    encode(p) {
      const d = { s: p.size, p: p.solution };
      if (p.noTouch === false) d.t = 0;
      return d;
    },
    decode(d) {
      const size = d && d.s, path = d && d.p;
      if (!Number.isInteger(size) || size < 3 || size > 30) throw new Error('Invalid board size');
      if (!Array.isArray(path) || path.length < 2) throw new Error('Invalid solution path');
      for (const cell of path) {
        if (!Array.isArray(cell) || cell.length !== 2 || !cell.every((x) => Number.isInteger(x) && x >= 0 && x < size)) {
          throw new Error('Invalid cell in path');
        }
      }
      return build(size, path, d.t !== 0);
    },
    newState: (p) => new Uint8Array(p.size * p.size),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, val) {
      const s = new Uint8Array(p.size * p.size);
      if (typeof val === 'string' && val.length === s.length) for (let k = 0; k < s.length; k++) s[k] = isEnd(p, k) ? OPEN : Number(val[k]) % 3;
      return s;
    },
    render,
    check(p, s) {
      const sol = solutionSet(p), mine = snakeSet(p, s);
      return mine.size === sol.size && [...mine].every((k) => sol.has(k));
    },
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!isEnd(p, k)) s[k] = h.v; },
  });
})();
