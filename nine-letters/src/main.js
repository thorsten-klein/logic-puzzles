// Nine Letters. The grid is cut into 3×3 blocks. Each block hides one
// nine-letter word: its letters run through all nine cells of the block,
// each step to a cell that touches by a side. Find the word of each block;
// the words are listed below the grid.
// State: word number + 1 per cell (0 = not marked).

(() => {
  const nbs = (n, k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };

  // The block (top-left cell) of cell k.
  const blockOf = (n, k) => Math.floor(Math.floor(k / n) / 3) * 3 * n + Math.floor((k % n) / 3) * 3;

  // For each word, a path through one whole block (or null).
  function solve(p, fixed) {
    const { n, letters, words } = p;
    const paths = words.map(() => null);
    const usedBlock = new Set();
    if (fixed) words.forEach((_, w) => {
      const cells = [...fixed.keys()].filter((k) => fixed[k] === w + 1);
      if (cells.length) { paths[w] = cells; usedBlock.add(blockOf(n, cells[0])); }
    });
    const blocks = [];
    for (let r = 0; r < n; r += 3) for (let c = 0; c < n; c += 3) blocks.push(r * n + c);
    const rec = (w) => {
      if (w === words.length) return true;
      if (paths[w]) return rec(w + 1);
      const word = words[w];
      for (const b of blocks) {
        if (usedBlock.has(b)) continue;
        const inBlock = (k) => blockOf(n, k) === b;
        const cells = [...new Array(n * n).keys()].filter(inBlock);
        const path = [];
        const seen = new Set();
        const walk = (k, i) => {
          if (letters[k] !== word[i]) return false;
          path.push(k); seen.add(k);
          if (i === 8) return true;
          for (const j of nbs(n, k)) if (inBlock(j) && !seen.has(j) && walk(j, i + 1)) return true;
          path.pop(); seen.delete(k);
          return false;
        };
        for (const k of cells) {
          if (walk(k, 0)) {
            paths[w] = path.slice(); usedBlock.add(b);
            if (rec(w + 1)) return true;
            paths[w] = null; usedBlock.delete(b);
            break;
          }
        }
      }
      return false;
    };
    return rec(0) ? paths : null;
  }

  // A random path through all cells of a 3×3 block (cells 0..8).
  function blockPath() {
    for (;;) {
      const path = [Math.floor(Math.random() * 9)];
      while (path.length < 9) {
        const x = path.at(-1), r = Math.floor(x / 3), c = x % 3;
        const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < 3 && b < 3 && !path.includes(a * 3 + b));
        if (!opts.length) break;
        const [a, b] = opts[Math.floor(Math.random() * opts.length)];
        path.push(a * 3 + b);
      }
      if (path.length === 9) return path;
    }
  }

  function generate(blocks) {
    const n = 3 * blocks;
    const words = PuzzleShell.shuffle(Words.nine.slice()).slice(0, blocks * blocks);
    const letters = new Array(n * n);
    const paths = [];
    let i = 0;
    for (let R = 0; R < n; R += 3) for (let C = 0; C < n; C += 3) {
      const path = blockPath().map((x) => (R + Math.floor(x / 3)) * n + C + (x % 3));
      path.forEach((k, j) => { letters[k] = words[i][j]; });
      paths.push(path);
      i++;
    }
    // List the words in a random order.
    const order = PuzzleShell.shuffle([...words.keys()]);
    const p = { n, letters: letters.join(''), words: order.map((j) => words[j]) };
    p.solution = order.map((j) => paths[j]);
    return p;
  }

  let sel = [];
  function render(p, s, opts = {}) {
    const { n, letters, words, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const ans = new Int8Array(n * n);
    solution.forEach((path, w) => path.forEach((k) => { ans[k] = w + 1; }));
    const hue = (w) => `hsl(${(w * 67) % 360} 70% 85%)`;
    const wrap = document.createElement('div');
    wrap.className = 'wf-wrap';
    const board = PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 46), className: 'pz-board wf-board', readonly,
      renderCell(k, el) {
        el.textContent = letters[k];
        if (k % n % 3 === 2 && k % n < n - 1) el.classList.add('nl-r');
        if (Math.floor(k / n) % 3 === 2 && Math.floor(k / n) < n - 1) el.classList.add('nl-b');
        const w = result ? ans[k] : s[k];
        if (w) el.style.background = hue(w - 1);
        if (result && s[k] && s[k] !== ans[k]) el.classList.add('bad');
        else if (result && !s[k]) el.classList.add('miss'); // not found yet
        if (hintCells.has(k)) el.classList.add('hint');
        if (!readonly && sel.includes(k)) el.classList.add('wf-sel');
      },
      onCell(k, ev) {
        if (ev.button === 2) {
          // Right click: unmark the word on this cell.
          if (s[k]) { const w = s[k]; for (let i = 0; i < s.length; i++) if (s[i] === w) s[i] = 0; }
          sel = [];
          onChange();
          return;
        }
        if (s[k]) { sel = []; onChange(); return; }
        const last = sel.at(-1);
        if (k === last) sel.pop();
        else if (sel.length && nbs(n, last).includes(k) && !sel.includes(k) && blockOf(n, k) === blockOf(n, last)) sel.push(k);
        else sel = [k];
        const typed = sel.map((x) => letters[x]).join('');
        const w = words.findIndex((x, i) => x === typed && !s.includes(i + 1));
        if (w >= 0) { sel.forEach((x) => { s[x] = w + 1; }); sel = []; }
        onChange();
      },
    });
    wrap.append(board);
    const list = document.createElement('div');
    list.className = 'wf-list';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      if (s.includes(i + 1) || result) span.className = 'done';
      list.append(span);
    });
    wrap.append(list);
    return wrap;
  }

  function hints(p, s) {
    // A cover that keeps the player's words, else point at a word to undo.
    const paths = solve(p, s);
    if (!paths) {
      // No cover fits: some mark is off the answer (if all marks were on it,
      // the answer itself would be a cover).
      const w = s.find((v, k) => v && !p.solution[v - 1].includes(k));
      return [{ cells: [...s.keys()].filter((k) => s[k] === w), v: -w, reason: `${p.words[w - 1]} is marked in the wrong place; the other words no longer fit.` }];
    }
    const w = p.words.findIndex((_, i) => !s.includes(i + 1));
    if (w < 0) return [];
    return [{ cells: paths[w], v: w + 1, reason: `Look for ${p.words[w]} here.` }];
  }

  PuzzleShell.start({
    id: 'nine-letters',
    name: 'Nine Letters',
    rules: 'The grid is cut into 3×3 blocks. Each block hides one nine-letter word of the list below the grid. The word ' +
      'runs through all nine cells of its block, each step to a cell that touches by a side.',
    controls: 'Click the letters of a word one after the other; it is marked as soon as it matches a word of the list. Click the last letter again to step back. Right click a marked word to remove it.',
    size: { min: 1, max: 3, def: 2, text: (b) => `${3 * b}×${3 * b}` },
    solvedText: 'All nine-letter words found — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, l: p.letters, w: p.words.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12 || n % 3) throw new Error('Invalid board size');
      if (typeof d.l !== 'string' || d.l.length !== n * n || !/^[A-Z]+$/.test(d.l)) throw new Error('Invalid letters');
      const words = String(d.w).split(',');
      if (!words.every((w) => /^[A-Z]{2,12}$/.test(w))) throw new Error('Invalid words');
      const p = { n, letters: d.l, words };
      const paths = solve(p, null);
      if (!paths) throw new Error('The words do not fit the grid');
      p.solution = paths;
      return p;
    },
    newState: (p) => new Int8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.n * p.n);
      const parts = typeof v === 'string' ? v.split(',') : [];
      if (parts.length === s.length) parts.forEach((x, k) => { const w = Number(x); if (w >= 0 && w <= p.words.length) s[k] = w; });
      return s;
    },
    render,
    // Any marking that covers the grid with the listed words is fine.
    check: (p, s) => s.every(Boolean) && p.words.every((_, i) => s.includes(i + 1)),
    hints,
    applyHint(p, s, h) {
      if (h.v < 0) { for (let k = 0; k < s.length; k++) { if (s[k] === -h.v) { s[k] = 0; } } return; }
      for (const k of h.cells) s[k] = h.v;
    },
  });
})();
