// Hundred. Every cell shows a digit. Add one more digit in front of or
// behind it in some cells, so the numbers in each row and each column add
// up to exactly 100.
// p.base: the shown digit per cell. Answer: the number per cell.

(() => {
  const options = (d, full) => {
    if (full) return [full];
    const out = new Set([d]);
    for (let x = 1; x <= 9; x++) out.add(10 * x + d);
    if (d) for (let x = 0; x <= 9; x++) out.add(10 * d + x);
    return [...out];
  };

  function solve(p, stopAt = 2, maxNodes = 300000) {
    const { n, base } = p;
    const opts = Array.from(base, (d, k) => options(d, p.full[k]));
    const v = new Int32Array(n * n);
    const row = new Int32Array(n), col = new Int32Array(n);
    const out = [];
    let nodes = 0;
    (function rec(k) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (k === n * n) { out.push(Int32Array.from(v)); return; }
      const r = Math.floor(k / n), c = k % n;
      for (const x of opts[k]) {
        const rs = row[r] + x, cs = col[c] + x;
        if (rs > 100 || cs > 100) continue;
        if (c === n - 1 && rs !== 100) continue;
        if (r === n - 1 && cs !== 100) continue;
        // The rest of the row must still reach 100.
        if (rs + (n - 1 - c) * 99 < 100 || cs + (n - 1 - r) * 99 < 100) continue;
        v[k] = x; row[r] = rs; col[c] = cs;
        rec(k + 1);
        row[r] -= x; col[c] -= x;
      }
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const sol = new Int32Array(N);
      const hi = Math.floor(200 / n);
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) sol[r * n + c] = 1 + Math.floor(Math.random() * hi);
      for (let r = 0; r < n - 1; r++) sol[r * n + n - 1] = 100 - [...Array(n - 1).keys()].reduce((a, c) => a + sol[r * n + c], 0);
      for (let c = 0; c < n; c++) sol[(n - 1) * n + c] = 100 - [...Array(n - 1).keys()].reduce((a, r) => a + sol[r * n + c], 0);
      if (sol.some((x) => x < 0 || x > 99)) continue;
      const base = Int8Array.from(sol, (x) => (x < 10 ? x : Math.random() < 0.5 ? Math.floor(x / 10) : x % 10));
      // Show full numbers in some cells until the answer is unique.
      const p = { n, base, full: new Int32Array(N) };
      const unique = () => { const r = solve(p, 2, 200000); return r.solutions.length === 1 && !r.capped; };
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (unique()) break;
        if (sol[k] >= 10) p.full[k] = sol[k];
      }
      if (!unique()) continue;
      for (let k = 0; k < N; k++) {
        if (!p.full[k]) continue;
        const keep = p.full[k];
        p.full[k] = 0;
        if (!unique()) p.full[k] = keep;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, s) {
    for (let k = 0; k < s.length; k++) if (s[k] && s[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    const k = [...s.keys()].find((i) => !p.full[i] && !s[i] && p.solution[i] !== p.base[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
  }

  function render(p, s, opts = {}) {
    const { n, base, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const wrap = document.createElement('div');
    const board = PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 56), className: 'pz-board hd-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (p.full[k]) { el.classList.add('given'); el.append(String(p.full[k])); return; }
        if (readonly && !result) {
          const t = document.createElement('span');
          t.className = s[k] ? '' : 'hd-plain';
          t.textContent = s[k] || base[k];
          el.append(t);
          return;
        }
        const b = document.createElement('span');
        b.className = 'hd-base';
        b.textContent = base[k];
        el.append(b);
        if (result) {
          el.append(String(solution[k]));
          el.classList.add(s[k] === solution[k] || (!s[k] && solution[k] === base[k]) ? 'ok' : s[k] ? 'bad' : 'show');
        } else {
          const input = PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: s[k], max: 99,
            onSet: (v) => { s[k] = v; onChange(false); } });
          input.placeholder = base[k];
          el.appendChild(input);
        }
      },
    });
    wrap.append(board);
    if (!readonly && !result) {
      const sums = document.createElement('div');
      sums.className = 'hd-sum';
      const val = (k) => p.full[k] || s[k] || base[k];
      const rows = [...Array(n).keys()].map((r) => [...Array(n).keys()].reduce((a, c) => a + val(r * n + c), 0));
      const cols = [...Array(n).keys()].map((c) => [...Array(n).keys()].reduce((a, r) => a + val(r * n + c), 0));
      sums.textContent = `Rows: ${rows.join(', ')} · Columns: ${cols.join(', ')}`;
      wrap.append(sums);
    }
    return wrap;
  }

  PuzzleShell.start({
    id: 'hundred',
    name: 'Hundred',
    rules: 'Every cell shows a digit. In some cells, add one more digit in front of it or behind it, so that the numbers ' +
      'in each row and each column add up to exactly 100. Underlined numbers are already complete.',
    controls: 'Click a cell and type its full number (for 7 you might type 27 or 74). Leave a cell blank to keep its digit.',
    size: { min: 3, max: 5, def: 3 },
    solvedText: 'A hundred all round — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, b: Array.from(p.base).join(''), f: Array.from(p.full).join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 6) throw new Error('Invalid board size');
      if (typeof d.b !== 'string' || d.b.length !== n * n || !/^[0-9]+$/.test(d.b)) throw new Error('Invalid digits');
      const full = d.f ? Int32Array.from(String(d.f).split(','), Number) : new Int32Array(n * n);
      if (full.length !== n * n) throw new Error('Invalid numbers');
      const p = { n, base: Int8Array.from(d.b, Number), full };
      const res = solve(p, 2, 3000000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int32Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int32Array(p.n * p.n);
      const parts = typeof v === 'string' ? v.split(',') : [];
      if (parts.length === s.length) parts.forEach((x, k) => { s[k] = Number(x) || 0; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => (p.full[k] || v || p.base[k]) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.full[k]) s[k] = h.v; },
  });
})();
