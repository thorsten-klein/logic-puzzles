// Kakuro entry point. Plugs the game into the shared shell.
//
// Share data: { r: rows, c: cols, g: grid, gv: [given cells] }. `grid`
// has one character per cell: "#" for a black cell, else the solved
// digit. Runs and clue sums are worked out again from the grid.
// State: one number per cell, 0 = empty, else the digit entered.

(() => {
  // Full puzzle from the black cells, the solution and the givens.
  function build(rows, cols, layout, solution, givenCells) {
    const given = {};
    for (const k of givenCells) given[k] = solution[k];
    const { cellRow, cellCol, rowRuns, colRuns, rowStartAt, colStartAt } = Rules.computeRuns(layout, rows, cols);
    for (const run of rowRuns) run.sum = run.cells.reduce((s, k) => s + solution[k], 0);
    for (const run of colRuns) run.sum = run.cells.reduce((s, k) => s + solution[k], 0);
    const clues = {};
    for (let k = 0; k < rows * cols; k++) {
      if (!layout[k]) continue;
      const { across, down } = Rules.clueFor(Math.floor(k / cols), k % cols, rows, cols, rowStartAt, colStartAt);
      if (across || down) clues[k] = { across: across ? across.sum : null, down: down ? down.sum : null };
    }
    return { size: rows - 1, rows, cols, layout, cellRow, cellCol, rowRuns, colRuns, clues, given, solution };
  }

  // Digit shown in cell k: a given, else the player's entry.
  const valueAt = (p, s, k) => p.given[k] || s[k];

  function render(p, s, opts = {}) {
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: p.rows, cols: p.cols, cellPx: PuzzleShell.fitCell(p.cols, 42), className: 'pz-board kakuro-board', readonly,
      renderCell(k, el) {
        const r = Math.floor(k / p.cols), c = k % p.cols;
        if (p.layout[k]) {
          const clue = p.clues[k];
          el.classList.add('black', clue ? 'has-clue' : 'solid');
          if (clue) {
            for (const [cls, v] of [['clue-across', clue.across], ['clue-down', clue.down]]) {
              if (v == null) continue;
              const span = document.createElement('span');
              span.className = cls;
              span.textContent = v;
              el.appendChild(span);
            }
          }
          return;
        }
        el.classList.add('white');
        if (hintCells.has(k)) el.classList.add('hint');
        if (p.given[k]) { el.classList.add('given'); el.textContent = p.given[k]; return; }
        if (result) {
          el.textContent = p.solution[k];
          el.classList.add(s[k] === p.solution[k] ? 'ok' : s[k] ? 'bad' : 'show');
        } else if (readonly) {
          el.textContent = s[k] || '';
        } else {
          el.appendChild(PuzzleShell.digitInput({ r, c, value: s[k], max: 9,
            onSet: (v) => { s[k] = v; onChange(false); } }));
        }
      },
    });
  }

  function hints(p, s) {
    const out = [];
    const N = p.rows * p.cols;
    for (let k = 0; k < N; k++) {
      if (!p.layout[k] && !p.given[k] && s[k] && s[k] !== p.solution[k]) out.push({ cells: [k], v: 0, reason: 'This number is wrong.' });
    }
    if (out.length) return out;
    const filled = new Map();
    for (let k = 0; k < N; k++) if (!p.layout[k] && valueAt(p, s, k)) filled.set(k, valueAt(p, s, k));
    for (const h of Hint.findAll(p, filled)) out.push({ cells: [h.idx], v: h.digit, reason: h.reason });
    if (out.length) return out;
    const k = [...Array(N).keys()].find((j) => !p.layout[j] && !valueAt(p, s, j));
    if (k !== undefined) out.push({ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` });
    return out;
  }

  PuzzleShell.start({
    id: 'kakuro',
    name: 'Kakuro',
    rules: 'Fill the white cells with digits 1–9. Each run (a row or column strip of white cells) adds up to its clue. ' +
      'No digit repeats within a run. A few cells (shown in blue) come filled in.',
    controls: 'Click a white cell and type a digit. Arrow keys move between cells.',
    // Up to 10: bigger boards with at most 45% black cells take too long.
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Every run adds up — nicely done.',
    generate: (n) => Generator.generate(n),
    encode(p) {
      let g = '';
      for (let k = 0; k < p.rows * p.cols; k++) g += p.layout[k] ? '#' : String(p.solution[k]);
      return { r: p.rows, c: p.cols, g, gv: Object.keys(p.given || {}).map(Number) };
    },
    decode(d) {
      const rows = d && d.r, cols = d && d.c;
      if (![rows, cols].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== rows * cols || !/^[#1-9]+$/.test(d.g)) throw new Error('Invalid puzzle grid');
      if (!Array.isArray(d.gv) || d.gv.some((k) => !Number.isInteger(k) || k < 0 || k >= rows * cols || d.g[k] === '#')) {
        throw new Error('Invalid given-cell list');
      }
      const layout = Uint8Array.from(d.g, (ch) => (ch === '#' ? 1 : 0));
      const solution = Int8Array.from(d.g, (ch) => (ch === '#' ? 0 : Number(ch)));
      return build(rows, cols, layout, solution, d.gv);
    },
    newState: (p) => new Int8Array(p.rows * p.cols),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, val) {
      const s = new Int8Array(p.rows * p.cols);
      const parts = String(val).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const v = Number(x); if (v >= 0 && v <= 9 && !p.layout[k]) s[k] = v; });
      return s;
    },
    render,
    check: (p, s) => p.solution.every((v, k) => p.layout[k] || valueAt(p, s, k) === v),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
