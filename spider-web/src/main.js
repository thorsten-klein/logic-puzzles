// Spider Web. Circles with letters are joined by lines. One English word
// of the shown length runs along joined circles (each circle used once).
// Find it and trace it from its first letter to its last.
// State: the traced circles in order (-1 = empty).

(() => {
  const FREQ = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHLLLLDDDDCCCUUUMMMFFPPGGWWYYBVK';

  function edgesOf(m, links) {
    const adj = Array.from({ length: m * m }, () => []);
    for (const [a, b] of links) { adj[a].push(b); adj[b].push(a); }
    return adj;
  }

  // Every word of length L that can be traced (as a set).
  function traceable(p, L) {
    const words = new Set(Words.byLen[L] || []);
    const prefix = new Set();
    for (const w of words) for (let i = 1; i <= L; i++) prefix.add(w.slice(0, i));
    const found = new Map();
    const path = [];
    const walk = (x, str) => {
      if (!prefix.has(str)) return;
      if (str.length === L) { if (words.has(str)) { found.set(str, (found.get(str) || 0) + 1); } return; }
      for (const y of p.adj[x]) {
        if (path.includes(y)) continue;
        path.push(y); walk(y, str + p.letters[y]); path.pop();
      }
    };
    for (let x = 0; x < p.letters.length; x++) { path.push(x); walk(x, p.letters[x]); path.pop(); }
    return found;
  }

  function generate(m) {
    const deadline = Date.now() + 8000;
    const L = Math.min(7, m + 1);
    while (Date.now() < deadline) {
      const N = m * m;
      // Random spanning tree plus extra lines (some diagonal).
      const links = [];
      const seen = new Uint8Array(N);
      const st = [Math.floor(Math.random() * N)];
      seen[st[0]] = 1;
      const near = (k) => { const r = Math.floor(k / m), c = k % m; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < m && b < m).map(([a, b]) => a * m + b); };
      while (st.length) {
        const k = st.at(-1);
        const opts = near(k).filter((j) => !seen[j]);
        if (!opts.length) { st.pop(); continue; }
        const j = opts[Math.floor(Math.random() * opts.length)];
        seen[j] = 1; links.push([k, j]); st.push(j);
      }
      const has = (a, b) => links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      for (let k = 0; k < N; k++) for (const j of near(k)) if (j > k && !has(k, j) && Math.random() < 0.35) links.push([k, j]);
      for (let r = 0; r + 1 < m; r++) for (let c = 0; c + 1 < m; c++) {
        const x = Math.random();
        if (x < 0.2) links.push([r * m + c, (r + 1) * m + c + 1]);
        else if (x < 0.36) links.push([r * m + c + 1, (r + 1) * m + c]);
      }
      const adj = edgesOf(m, links);
      // The key word along a random path.
      const word = Words.byLen[L][Math.floor(Math.random() * Words.byLen[L].length)];
      let path = null;
      for (let t = 0; t < 50 && !path; t++) {
        const pth = [Math.floor(Math.random() * N)];
        while (pth.length < L) {
          const opts = adj[pth.at(-1)].filter((y) => !pth.includes(y));
          if (!opts.length) break;
          pth.push(opts[Math.floor(Math.random() * opts.length)]);
        }
        if (pth.length === L) path = pth;
      }
      if (!path) continue;
      const letters = Array.from({ length: N }, () => FREQ[Math.floor(Math.random() * FREQ.length)]);
      path.forEach((k, i) => { letters[k] = word[i]; });
      const p = { m, links, adj, letters: letters.join(''), L };
      const found = traceable(p, L);
      if (found.size !== 1 || found.get(word) !== 1) continue;
      p.solution = path;
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function render(p, s, opts = {}) {
    const { m, links, adj, letters, solution, L } = p;
    const { readonly, result, hint, onChange } = opts;
    const gap = Math.max(44, Math.min(70, Math.floor((Math.min(window.innerWidth, 900) - 40) / m)));
    const W = m * gap;
    const wrap = document.createElement('div');
    const svg = el('svg', { width: W, height: W, class: 'sw-board' }, wrap);
    const xy = (k) => [(k % m) * gap + gap / 2, Math.floor(k / m) * gap + gap / 2];
    const path = (result ? solution : Array.from(s)).filter((x) => x >= 0);
    const onEdge = (a, b) => path.some((x, i) => i && ((path[i - 1] === a && x === b) || (path[i - 1] === b && x === a)));
    for (const [a, b] of links) {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      el('line', { x1, y1, x2, y2, class: 'sw-edge' + (onEdge(a, b) ? ' on' : '') }, svg);
    }
    const hintSet = new Set(hint ? hint.cells : []);
    const solved = !result && path.length === L && path.map((x) => letters[x]).join('') === solution.map((x) => letters[x]).join('');
    for (let k = 0; k < m * m; k++) {
      const [x, y] = xy(k);
      let cls = 'sw-node';
      // Result: answer circles the player has on the path are ok, the rest
      // are not entered yet.
      if (path.includes(k)) cls += result ? (Array.from(s).includes(k) ? ' ok' : ' miss') : solved ? ' ok' : ' on';
      if (hintSet.has(k)) cls += ' hint';
      const c = el('circle', { cx: x, cy: y, r: gap * 0.3, class: cls }, svg);
      el('text', { x, y, 'font-size': gap * 0.32, class: 'sw-letter' }, svg).textContent = letters[k];
      if (!readonly && !result) {
        c.addEventListener('click', () => {
          const cur = Array.from(s).filter((x) => x >= 0);
          const last = cur.at(-1);
          let next;
          if (k === last) next = cur.slice(0, -1);
          else if (cur.length && adj[last].includes(k) && !cur.includes(k) && cur.length < L) next = cur.concat([k]);
          else next = [k];
          s.fill(-1);
          next.forEach((x, i) => { s[i] = x; });
          onChange();
        });
      }
    }
    const info = document.createElement('div');
    info.className = 'sw-info';
    info.textContent = `Find a ${L}-letter word` + (path.length ? `: ${path.map((x) => letters[x]).join('')}` : '');
    wrap.append(info);
    return wrap;
  }

  PuzzleShell.start({
    id: 'spider-web',
    name: 'Spider Web',
    rules: 'Circles with letters are joined by lines. One English word of the shown length runs along joined circles, ' +
      'each circle used once. Find it and trace it from its first letter to its last.',
    controls: 'Click circles one after the other along the lines. Click the last circle again to step back; click another circle to start over.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'You found the hidden word — nicely done.',
    generate,
    encode: (p) => ({ m: p.m, l: p.letters, e: p.links.map(([a, b]) => a + '-' + b).join(','), n: p.L }),
    decode(d) {
      const m = d?.m, L = d?.n;
      if (!Number.isInteger(m) || m < 3 || m > 8 || !Number.isInteger(L) || L < 3 || L > 9) throw new Error('Invalid size');
      if (typeof d.l !== 'string' || d.l.length !== m * m || !/^[A-Z]+$/.test(d.l)) throw new Error('Invalid letters');
      const links = String(d.e).split(',').map((t) => t.split('-').map(Number));
      if (links.some((x) => x.length !== 2 || x.some((v) => !(v >= 0 && v < m * m)))) throw new Error('Invalid lines');
      const p = { m, links, adj: edgesOf(m, links), letters: d.l, L };
      const found = traceable(p, L);
      if (found.size !== 1) throw new Error('Puzzle has no unique word');
      const word = [...found.keys()][0];
      // Find its path.
      const path = [];
      const walk = (x, i) => {
        if (p.letters[x] !== word[i] || path.includes(x)) return false;
        path.push(x);
        if (i === L - 1) return true;
        for (const y of p.adj[x]) if (walk(y, i + 1)) return true;
        path.pop();
        return false;
      };
      for (let x = 0; x < m * m; x++) if (walk(x, 0)) break;
      p.solution = path;
      return p;
    },
    newState: (p) => new Int16Array(p.L).fill(-1),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int16Array(p.L).fill(-1);
      const parts = typeof v === 'string' ? v.split(',') : [];
      if (parts.length === s.length) parts.forEach((x, i) => { const k = Number(x); if (k >= -1 && k < p.m * p.m) s[i] = k; });
      return s;
    },
    render,
    // Mistakes: circles on the path that are not the answer's circle there.
    mistakes: (p, s) => Array.from(s).filter((x, i) => x >= 0 && p.letters[x] !== p.letters[p.solution[i]]).length,
    check: (p, s) => Array.from(s).map((x) => (x >= 0 ? p.letters[x] : '')).join('') === p.solution.map((x) => p.letters[x]).join(''),
    hints(p, s) {
      const cur = Array.from(s).filter((x) => x >= 0);
      const ok = cur.every((x, i) => x === p.solution[i]);
      if (!ok) return [{ cells: [p.solution[0]], v: 1, reason: `No simple step is left. The word starts here, with ${p.letters[p.solution[0]]}.` }];
      const i = cur.length;
      if (i >= p.L) return [];
      return [{ cells: [p.solution[i]], v: i + 1, reason: i ? `No simple step is left. The next letter is ${p.letters[p.solution[i]]}.` : `No simple step is left. The word starts here, with ${p.letters[p.solution[0]]}.` }];
    },
    applyHint(p, s, h) {
      s.fill(-1);
      for (let i = 0; i < h.v; i++) s[i] = p.solution[i];
    },
  });
})();
