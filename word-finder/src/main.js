// Word Finder. The grid is full of letters. Find every word of the list:
// its letters run through cells that touch by a side (the word may turn).
// Each cell belongs to exactly one word, so the words fill the grid.
// State: word number + 1 per cell (0 = not marked).

(() => {
  const nbs = (n, k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };

  // Cover the grid with words: one path per word (or null).
  function solve(p, fixed, maxNodes = 200000) {
    const { n, letters, words } = p;
    const N = n * n;
    const used = Int8Array.from(fixed || new Int8Array(N));
    const paths = words.map(() => null);
    for (let w = 0; w < words.length; w++) {
      if (!fixed || !used.includes(w + 1)) continue;
      paths[w] = [...used.keys()].filter((k) => used[k] === w + 1);
    }
    const todo = [...words.keys()].filter((w) => !paths[w]).sort((a, b) => words[b].length - words[a].length);
    let nodes = 0;
    const rec = (t) => {
      if (++nodes > maxNodes) return false;
      if (t === todo.length) return used.every(Boolean);
      const w = todo[t], word = words[w];
      for (let k = 0; k < N; k++) {
        if (used[k] || letters[k] !== word[0]) continue;
        const path = [k];
        used[k] = w + 1;
        const walk = (i) => {
          if (i === word.length) { paths[w] = path.slice(); if (rec(t + 1)) return true; paths[w] = null; return false; }
          for (const j of nbs(n, path[i - 1])) {
            if (used[j] || letters[j] !== word[i]) continue;
            used[j] = w + 1; path.push(j);
            if (walk(i + 1)) return true;
            path.pop(); used[j] = 0;
          }
          return false;
        };
        if (walk(1)) return true;
        used[k] = 0;
      }
      return false;
    };
    return rec(0) ? paths : null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      // Random snake paths of 4..7 cells that fill the grid.
      const used = new Int8Array(N).fill(-1);
      const paths = [];
      let ok = true;
      while (ok) {
        const free = [...new Array(N).keys()].filter((k) => used[k] < 0);
        if (!free.length) break;
        const deg = (k) => nbs(n, k).filter((j) => used[j] < 0).length;
        const start = free.reduce((a, b) => (deg(b) < deg(a) || (deg(b) === deg(a) && Math.random() < 0.3) ? b : a), free[0]);
        const path = [start];
        used[start] = paths.length;
        const want = 4 + Math.floor(Math.random() * 4);
        while (path.length < want) {
          const opts = nbs(n, path.at(-1)).filter((j) => used[j] < 0);
          if (!opts.length) break;
          const j = opts.reduce((a, b) => (deg(b) < deg(a) || (deg(b) === deg(a) && Math.random() < 0.5) ? b : a), opts[0]);
          used[j] = paths.length;
          path.push(j);
        }
        if (path.length < 4 || !Words.byLen[path.length]) { ok = false; break; }
        paths.push(path);
      }
      if (!ok) continue;
      // A different word for each path.
      const taken = new Set();
      const words = paths.map((path) => {
        const list = Words.byLen[path.length].filter((w) => !taken.has(w));
        const w = list[Math.floor(Math.random() * list.length)];
        taken.add(w);
        return w;
      });
      const letters = new Array(N);
      paths.forEach((path, i) => path.forEach((k, j) => { letters[k] = words[i][j]; }));
      const p = { n, letters: letters.join(''), words };
      p.solution = paths;
      return p;
    }
    return null;
  }

  let sel = [];
  function render(p, s, opts = {}) {
    const { n, letters, words, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const ans = new Int8Array(n * n);
    solution.forEach((path, w) => path.forEach((k) => { ans[k] = w + 1; }));
    // A full board with every word found is right, even if a word runs
    // another way than in the stored answer.
    if (Array.from(s).every(Boolean) && words.every((_, w) => Array.from(s).includes(w + 1))) ans.set(s);
    const hue = (w) => `hsl(${(w * 67) % 360} 70% 85%)`;
    const wrap = document.createElement('div');
    wrap.className = 'wf-wrap';
    const board = PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 46), className: 'pz-board wf-board', readonly,
      renderCell(k, el) {
        el.textContent = letters[k];
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
        else if (sel.length && nbs(n, last).includes(k) && !sel.includes(k)) sel.push(k);
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
    const paths = solve(p, s, 50000);
    if (!paths) {
      const w = s.find((v, k) => v && !p.solution[v - 1].includes(k));
      if (w) return [{ cells: [...s.keys()].filter((k) => s[k] === w), v: -w, reason: `${p.words[w - 1]} is marked in the wrong place; the other words no longer fit.` }];
      return [];
    }
    const w = p.words.findIndex((_, i) => !s.includes(i + 1));
    if (w < 0) return [];
    return [{ cells: paths[w], v: w + 1, reason: `No simple step is left. Look for ${p.words[w]} here.` }];
  }

  PuzzleShell.start({
    id: 'word-finder',
    name: 'Word Finder',
    rules: 'The grid is full of letters. Find every word of the list below the grid. A word runs through cells that ' +
      'touch by a side, and it may turn. Each letter belongs to exactly one word, so the words fill the whole grid.',
    controls: 'Click the letters of a word one after the other; it is marked as soon as it matches a word of the list. Click the last letter again to step back. Right click a marked word to remove it.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every word found — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, l: p.letters, w: p.words.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
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
      if (h.v < 0) { for (let k = 0; k < s.length; k++) if (s[k] === -h.v) s[k] = 0; return; }
      for (const k of h.cells) s[k] = h.v;
    },
  });
})();
