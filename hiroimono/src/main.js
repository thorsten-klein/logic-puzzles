// Hiroimono. Pick up all stones in one trip. Start at any stone and move
// in a straight line; the first stone you meet is picked up. At a stone
// you may go on or turn left or right, but never turn back. Number the
// stones in the order you pick them up.
// p.stone marks stone cells; the answer gives each stone its number.

(() => {
  const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // up, right, down, left

  // All pick-up orders (up to stopAt). An order lists stone cells.
  function orders(p, stopAt = 2, maxNodes = 200000, firstStone = -1) {
    const { n, stone } = p;
    const N = n * n;
    const stones = [...Array(N).keys()].filter((k) => stone[k]);
    const taken = new Uint8Array(N);
    const out = [];
    const path = [];
    let nodes = 0;
    const next = (k, d) => {
      let r = Math.floor(k / n) + STEP[d][0], c = (k % n) + STEP[d][1];
      while (r >= 0 && c >= 0 && r < n && c < n) {
        const j = r * n + c;
        if (stone[j] && !taken[j]) return j;
        r += STEP[d][0]; c += STEP[d][1];
      }
      return -1;
    };
    const rec = (k, dir) => {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (path.length === stones.length) { out.push(path.slice()); return; }
      for (let d = 0; d < 4; d++) {
        if (dir >= 0 && d === (dir + 2) % 4) continue;
        const j = next(k, d);
        if (j < 0) continue;
        taken[j] = 1; path.push(j);
        rec(j, d);
        taken[j] = 0; path.pop();
      }
    };
    for (const s of firstStone >= 0 ? [firstStone] : stones) {
      taken[s] = 1; path.push(s);
      rec(s, -1);
      taken[s] = 0; path.pop();
    }
    return { orders: out, capped: nodes > maxNodes };
  }

  // A random trip: walk from a random cell, dropping stones where it turns
  // and here and there on straight runs.
  function randomTrip(n, count) {
    const N = n * n;
    for (let t = 0; t < 200; t++) {
      const stone = new Uint8Array(N);
      let k = Math.floor(Math.random() * N), dir = -1;
      stone[k] = 1;
      const order = [k];
      let fails = 0;
      while (order.length < count && fails < 50) {
        const dirs = [0, 1, 2, 3].filter((d) => dir < 0 || d !== (dir + 2) % 4);
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        // Move 1..n-1 cells in d over empty cells, place a stone there.
        const r0 = Math.floor(k / n), c0 = k % n;
        const free = [];
        for (let s = 1; s < n; s++) {
          const r = r0 + STEP[d][0] * s, c = c0 + STEP[d][1] * s;
          if (r < 0 || c < 0 || r >= n || c >= n) break;
          if (stone[r * n + c]) break;
          free.push(r * n + c);
        }
        if (!free.length) { fails++; continue; }
        const j = free[Math.floor(Math.random() * free.length)];
        stone[j] = 1;
        order.push(j);
        k = j; dir = d;
      }
      if (order.length === count) return { stone, order };
    }
    return null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const trip = randomTrip(n, Math.round(n * 1.6));
      if (!trip) continue;
      const p = { n, stone: trip.stone };
      const res = orders(p, 2, 100000);
      if (res.capped || res.orders.length !== 1) continue;
      p.solution = new Int32Array(n * n);
      res.orders[0].forEach((k, i) => { p.solution[k] = i + 1; });
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const N = p.n * p.n;
    for (let k = 0; k < N; k++) if (entries[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    // The next number after the highest correct run from 1.
    let v = 1;
    while ([...entries].includes(v)) v++;
    const k = p.solution.indexOf(v);
    if (k < 0) return [];
    return [{ cells: [k], v, reason: v === 1 ? 'No simple step is left. The trip starts at this stone.' : `No simple step is left. Stone ${v} comes next.` }];
  }

  function render(p, entries, opts = {}) {
    const { n, stone, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, 46), className: 'pz-board hr-board', readonly,
      renderCell(k, el) {
        if (!stone[k]) return;
        el.classList.add('hr-stone');
        if (hintCells.has(k)) el.classList.add('hint');
        const label = (text) => { const t = document.createElement('span'); t.className = 'hr-num'; t.textContent = text; el.append(t); };
        if (result) {
          label(solution[k]);
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) label(entries[k] || '');
        else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: 99,
            onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  PuzzleShell.start({
    id: 'hiroimono',
    name: 'Hiroimono',
    rules: 'Pick up all stones in one trip. Start at any stone and move in a straight line up, down, left or right; the ' +
      'first stone you meet is picked up. At a stone you may go on or turn left or right, but never turn back. Number ' +
      'the stones in the order you pick them up, starting with 1.',
    controls: 'Click a stone and type its number. Arrow keys move between cells.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Every stone collected — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, s: Array.from(p.stone).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.s !== 'string' || d.s.length !== n * n || !/^[01]+$/.test(d.s)) throw new Error('Invalid stones');
      const p = { n, stone: Uint8Array.from(d.s, Number) };
      const res = orders(p, 2, 400000);
      if (res.orders.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = new Int32Array(n * n);
      res.orders[0].forEach((k, i) => { p.solution[k] = i + 1; });
      return p;
    },
    newState: (p) => new Int32Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int32Array(p.n * p.n);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, k) => { const y = Number(x); if (y >= 0 && y < 100) s[k] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => !p.stone[k] || v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
