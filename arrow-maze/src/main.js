// Arrow Maze. Every cell holds an arrow (the last cell holds none).
// Number the cells 1 to N along one path that visits every cell once:
// from each cell the path jumps to some cell along that cell's arrow.
// Some numbers are given (always 1 and N).

(() => {
  const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];

  const ray = (n, k, d) => {
    const [dr, dc] = DIRS[d], out = [];
    let r = Math.floor(k / n) + dr, c = (k % n) + dc;
    while (r >= 0 && c >= 0 && r < n && c < n) { out.push(r * n + c); r += dr; c += dc; }
    return out;
  };

  // Random path: from each cell jump along one of 8 lines to a free cell.
  function randomPath(n) {
    const N = n * n;
    for (let t = 0; t < 200; t++) {
      const used = new Uint8Array(N);
      const path = [Math.floor(Math.random() * N)];
      used[path[0]] = 1;
      const dir = new Int8Array(N).fill(-1);
      let ok = true;
      while (path.length < N) {
        const k = path.at(-1);
        const opts = [];
        for (let d = 0; d < 8; d++) for (const j of ray(n, k, d)) if (!used[j]) opts.push([j, d]);
        if (!opts.length) { ok = false; break; }
        // Prefer cells with few onward moves (keeps the walk going).
        const onward = (j) => { let c = 0; for (let d = 0; d < 8; d++) { for (const x of ray(n, j, d)) { if (!used[x] && x !== j) { c++; } } } return c; };
        opts.sort((a, b) => onward(a[0]) - onward(b[0]) + (Math.random() - 0.5) * 6);
        const [j, d] = opts[0];
        dir[k] = d;
        used[j] = 1;
        path.push(j);
      }
      if (ok) {
        dir[path[N - 1]] = -1;
        return { path, dir };
      }
    }
    return null;
  }

  // Count paths matching the arrows and given numbers (up to stopAt).
  function solve(p, stopAt = 2, maxNodes = 200000) {
    const { n, dir, given } = p;
    const N = n * n;
    const posOf = new Int32Array(N + 1).fill(-1);
    given.forEach((v, k) => { if (v) posOf[v] = k; });
    const num = new Int32Array(N);
    const out = [];
    let nodes = 0;
    const rec = (k, v) => {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      num[k] = v;
      if (v === N) { out.push(Int32Array.from(num)); num[k] = 0; return; }
      if (dir[k] < 0) { num[k] = 0; return; }
      const next = posOf[v + 1];
      for (const j of ray(n, k, dir[k])) {
        if (num[j]) continue;
        if (next >= 0 && j !== next) continue;
        if (next < 0 && given[j]) continue;
        rec(j, v + 1);
      }
      num[k] = 0;
    };
    if (posOf[1] >= 0) rec(posOf[1], 1);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const rp = randomPath(n);
      if (!rp) continue;
      const N = n * n;
      const sol = new Int32Array(N);
      rp.path.forEach((k, i) => { sol[k] = i + 1; });
      const p = { n, dir: rp.dir, given: new Int32Array(N) };
      p.given[rp.path[0]] = 1;
      p.given[rp.path[N - 1]] = N;
      for (let guard = 0; guard < N; guard++) {
        const res = solve(p, 2, 50000);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
        const diff = [...new Array(N).keys()].filter((k) => !p.given[k] && (other?.[k] !== sol[k]));
        if (!diff.length) break;
        const k = diff[Math.floor(Math.random() * diff.length)];
        p.given[k] = sol[k];
      }
      const unique = () => { const r = solve(p, 2, 50000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        const v = p.given[k];
        if (!v || v === 1 || v === N) continue;
        p.given[k] = 0;
        if (!unique()) p.given[k] = v;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const N = p.n * p.n;
    for (let k = 0; k < N; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    const val = Int32Array.from(entries, (v, k) => p.given[k] || v);
    const pos = new Int32Array(N + 2).fill(-1);
    val.forEach((v, k) => { if (v) pos[v] = k; });
    // The next number after a placed one, when only one free cell on its arrow fits.
    for (let v = 1; v < N; v++) {
      const k = pos[v];
      if (k < 0 || pos[v + 1] >= 0 || p.dir[k] < 0) continue;
      const free = ray(p.n, k, p.dir[k]).filter((j) => !val[j]);
      if (free.length === 1) return [{ cells: free, v: v + 1, reason: `${v + 1} follows ${v}, and only one free cell lies along the arrow of ${v}.` }];
    }
    const k = [...val.keys()].find((i) => !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, dir, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 52), className: 'pz-board am-board', readonly,
      renderCell(k, el) {
        if (dir[k] >= 0) { const a = PuzzleShell.arrowIcon(dir[k]); a.classList.add('am-arrow'); el.append(a); }
        if (hintCells.has(k)) el.classList.add('hint');
        const label = document.createElement('span');
        label.className = 'am-num';
        if (given[k]) { el.classList.add('given'); label.textContent = given[k]; el.append(label); return; }
        if (result) {
          label.textContent = solution[k];
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
          el.append(label);
        } else if (readonly) {
          label.textContent = entries[k] || '';
          el.append(label);
        } else {
          const inp = PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: n * n,
            onSet: (v) => { entries[k] = v; onChange(false); } });
          inp.classList.add('am-input');
          el.append(inp);
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'arrow-maze',
    name: 'Arrow Maze',
    rules: 'Number all cells from 1 to N along one path that visits every cell once, starting at 1. From each cell the ' +
      'path jumps to a cell somewhere along that cell\'s arrow (straight or diagonal, any distance). Some numbers are given.',
    controls: 'Click a cell and type its number. Arrow keys move between cells.',
    size: { min: 3, max: 7, def: 5 },
    solvedText: 'You followed every arrow — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, d: Array.from(p.dir, (v) => (v < 0 ? '.' : v)).join(''), g: Array.from(p.given).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 10) throw new Error('Invalid size');
      if (typeof d.d !== 'string' || d.d.length !== n * n || !/^[.0-7]+$/.test(d.d)) throw new Error('Invalid arrows');
      const given = Int32Array.from(String(d.g).split(','), Number);
      if (given.length !== n * n) throw new Error('Invalid numbers');
      const p = { n, dir: Int8Array.from(d.d, (ch) => (ch === '.' ? -1 : Number(ch))), given };
      const res = solve(p, 2);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int32Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int32Array(p.n * p.n);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const y = Number(x); if (y >= 0 && y <= s.length) s[k] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
