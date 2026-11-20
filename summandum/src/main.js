// Summandum. Place the numbers 1 to N once each along the top and once
// each down the left. A number in a cell is the sum of its column's top
// number and its row's left number. Adapted from Factorism (the field
// names still say "prod").
// State: entries for top (0..N-1) then left (N..2N-1); 0 = empty.

(() => {
  // Counts (top, left) assignments that fit the products.
  function solve(p, stopAt = 2) {
    const { n, prod } = p;
    const top = new Int8Array(n), left = new Int8Array(n);
    const usedT = new Uint8Array(n + 1), usedL = new Uint8Array(n + 1);
    const out = [];
    // Fill rows and columns alternately so products prune early.
    const order = [];
    for (let i = 0; i < n; i++) order.push(['t', i], ['l', i]);
    (function rec(i) {
      if (out.length >= stopAt) return;
      if (i === order.length) { out.push(Int8Array.from([...top, ...left])); return; }
      const [side, j] = order[i];
      for (let v = 1; v <= n; v++) {
        if (side === 't' ? usedT[v] : usedL[v]) continue;
        if (side === 't') top[j] = v; else left[j] = v;
        let ok = true;
        for (let r = 0; r < n && ok; r++) for (let c = 0; c < n && ok; c++) {
          const x = prod[r * n + c];
          if (!x || !top[c] || !left[r]) continue;
          if (top[c] + left[r] !== x) ok = false;
        }
        if (ok) {
          if (side === 't') usedT[v] = 1; else usedL[v] = 1;
          rec(i + 1);
          if (side === 't') usedT[v] = 0; else usedL[v] = 0;
        }
        if (side === 't') top[j] = 0; else left[j] = 0;
      }
    })(0);
    return out;
  }

  function generate(n) {
    const top = PuzzleShell.shuffle(Array.from({ length: n }, (_, i) => i + 1));
    const left = PuzzleShell.shuffle(Array.from({ length: n }, (_, i) => i + 1));
    const full = Int32Array.from({ length: n * n }, (_, k) => top[k % n] + left[Math.floor(k / n)]);
    const p = { n, prod: Int32Array.from(full) };
    if (solve(p).length !== 1) return null;
    for (const k of PuzzleShell.shuffle([...full.keys()])) {
      const keep = p.prod[k];
      p.prod[k] = 0;
      if (solve(p).length !== 1) p.prod[k] = keep;
    }
    p.solution = Int8Array.from([...top, ...left]);
    return p;
  }

  function hints(p, s) {
    const n = p.n;
    for (let i = 0; i < 2 * n; i++) if (s[i] && s[i] !== p.solution[i]) return [{ slot: i, v: 0, reason: 'This number is wrong.' }];
    // A slot whose value is forced by a sum with a filled partner.
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = p.prod[r * n + c];
      if (!x) continue;
      if (s[c] && !s[n + r]) return [{ slot: n + r, v: x - s[c], reason: `${x} = ${s[c]} + ${x - s[c]}, so row ${r + 1} starts with ${x - s[c]}.` }];
      if (s[n + r] && !s[c]) return [{ slot: c, v: x - s[n + r], reason: `${x} = ${s[n + r]} + ${x - s[n + r]}, so column ${c + 1} has ${x - s[n + r]} on top.` }];
    }
    const i = [...s.keys()].find((j) => !s[j]);
    return i === undefined ? [] : [{ slot: i, v: p.solution[i], reason: `No simple step is left. This number is ${p.solution[i]}.` }];
  }

  function render(p, s, opts = {}) {
    const { n, prod, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    return PuzzleShell.gridBoard({
      rows: n + 1, cols: n + 1, cellPx: PuzzleShell.fitCell(n + 1, 46), className: 'pz-board sd-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / (n + 1)) - 1, c = (K % (n + 1)) - 1;
        if (r < 0 && c < 0) { el.className = 'corner'; el.textContent = '+'; return; }
        if (r >= 0 && c >= 0) { el.className = 'cell prod'; el.textContent = prod[r * n + c] || ''; return; }
        const slot = r < 0 ? c : n + r;
        el.classList.add('slot');
        if (hint && hint.slot === slot) el.classList.add('hint');
        if (result) {
          el.textContent = solution[slot];
          el.classList.add(s[slot] === solution[slot] ? 'ok' : s[slot] ? 'bad' : 'show');
        } else if (readonly) el.textContent = s[slot] || '';
        else {
          el.appendChild(PuzzleShell.digitInput({ r: r < 0 ? -1 : r, c: c < 0 ? -1 : c, value: s[slot], max: n,
            onSet: (v) => { s[slot] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'summandum',
    name: 'Summandum',
    rules: 'Write the numbers 1 to N once each along the top, and once each down the left side. ' +
      'A number inside the grid is the sum of the top number of its column and the left number of its row.',
    controls: 'Click a box on the top or left and type a number. Arrow keys move between boxes.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Everything adds up — nicely done.',
    generate(n) { for (let t = 0; t < 50; t++) { const p = generate(n); if (p) return p; } return null; },
    encode: (p) => ({ n: p.n, g: Array.from(p.prod).join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 12) throw new Error('Invalid size');
      const prod = Int32Array.from(String(d.g).split(','), Number);
      if (prod.length !== n * n) throw new Error('Invalid products');
      const p = { n, prod };
      const sols = solve(p);
      if (sols.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = sols[0];
      return p;
    },
    newState: (p) => new Int8Array(2 * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(2 * p.n);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, i) => { const y = Number(x); if (y >= 0 && y <= p.n) s[i] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => v === p.solution[i]),
    hints,
    applyHint(p, s, h) { s[h.slot] = h.v; },
  });
})();
