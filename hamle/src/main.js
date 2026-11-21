// Hamle (Move). Every numbered block moves exactly its number of cells up,
// down, left or right. After all moves the blocks sit on different cells,
// never touch by a side, and all white cells connect.
// The player picks a direction per block; the board shows where it lands.
// p.blocks: [{ k, n }]; answer: a direction (0 up, 1 right, 2 down,
// 3 left) per block.

(() => {
  const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  const target = (p, b, d) => {
    const r = Math.floor(b.k / p.C) + STEP[d][0] * b.n, c = (b.k % p.C) + STEP[d][1] * b.n;
    return r >= 0 && c >= 0 && r < p.R && c < p.C ? r * p.C + c : -1;
  };

  // Do the landing cells (one per block, -1 = not set) break a rule?
  function fine(p, land, done) {
    const { R, C } = p;
    const taken = new Map();
    for (let i = 0; i < land.length; i++) {
      const k = land[i];
      if (k < 0) continue;
      if (taken.has(k)) return false;
      taken.set(k, i);
    }
    for (const [k] of taken) {
      const r = Math.floor(k / C), c = k % C;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (a >= 0 && b >= 0 && a < R && b < C && taken.has(a * C + b)) return false;
    }
    if (!done) return true;
    // White cells connect.
    const N = R * C;
    const start = [...new Array(N).keys()].find((k) => !taken.has(k));
    const seen = new Uint8Array(N);
    seen[start] = 1;
    const stack = [start];
    let count = 1;
    while (stack.length) {
      const k = stack.pop(), r = Math.floor(k / C), c = k % C;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const j = a * C + b;
        if (a >= 0 && b >= 0 && a < R && b < C && !seen[j] && !taken.has(j)) { seen[j] = 1; count++; stack.push(j); }
      }
    }
    return count === N - taken.size;
  }

  function solve(p, stopAt = 2, maxNodes = 200000) {
    const out = [];
    const land = new Array(p.blocks.length).fill(-1), dirs = new Int8Array(p.blocks.length);
    let nodes = 0;
    (function rec(i) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (i === p.blocks.length) { if (fine(p, land, true)) { out.push(Int8Array.from(dirs)); } return; }
      for (let d = 0; d < 4; d++) {
        const t = target(p, p.blocks[i], d);
        if (t < 0) continue;
        land[i] = t; dirs[i] = d;
        if (fine(p, land, false)) rec(i + 1);
        land[i] = -1;
      }
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      // Landing cells first (not touching), then where each block came from.
      const land = [];
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (land.length >= Math.round(N / 6)) break;
        const r = Math.floor(k / n), c = k % n;
        if (land.some((j) => Math.abs(Math.floor(j / n) - r) + Math.abs((j % n) - c) <= 1)) continue;
        land.push(k);
      }
      const p0 = { R: n, C: n, blocks: [] };
      if (!fine(p0, land, true)) continue;
      const blocks = [];
      let ok = true;
      const used = new Set();
      for (const k of land) {
        const opts = [];
        for (let d = 0; d < 4; d++) for (let m = 1; m < n; m++) {
          const r = Math.floor(k / n) - STEP[d][0] * m, c = (k % n) - STEP[d][1] * m;
          if (r >= 0 && c >= 0 && r < n && c < n && !used.has(r * n + c)) opts.push({ k: r * n + c, n: m });
        }
        if (!opts.length) { ok = false; break; }
        const b = opts[Math.floor(Math.random() * opts.length)];
        used.add(b.k);
        blocks.push(b);
      }
      if (!ok) continue;
      const p = { R: n, C: n, blocks };
      const res = solve(p, 2);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = res.solutions[0];
      return p;
    }
    return null;
  }

  function render(p, state, opts = {}) {
    const { R, C, blocks, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const dirs = result ? solution : state;
    const hintSet = new Set(hint ? hint.blocks : []);
    const at = new Map(blocks.map((b, i) => [b.k, i]));
    const landAt = new Map();
    blocks.forEach((b, i) => { if (dirs[i] >= 0) { const t = target(p, b, dirs[i]); if (t >= 0) landAt.set(t, i); } });
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 46), className: 'pz-board hm2-board', readonly,
      renderCell(k, el) {
        if (landAt.has(k)) { el.classList.add('hm2-land'); el.textContent = blocks[landAt.get(k)].n; }
        if (at.has(k)) {
          const i = at.get(k);
          const tag = document.createElement('span');
          tag.className = 'hm2-start' + (dirs[i] >= 0 ? ' moved' : '');
          tag.textContent = blocks[i].n;
          el.append(tag);
          if (dirs[i] >= 0) el.append(PuzzleShell.arrowIcon(dirs[i] * 2));
          if (hintSet.has(i)) el.classList.add('hint');
          if (result && state[i] >= 0) el.classList.add(state[i] === solution[i] ? 'ok' : 'bad');
          else if (result) el.classList.add('miss'); // not entered yet
        }
      },
      onCell(k, ev) {
        if (!at.has(k)) return;
        const i = at.get(k);
        const order = [-1, 0, 1, 2, 3];
        state[i] = order[(order.indexOf(state[i]) + (ev.button === 2 ? 4 : 1)) % 5];
        onChange();
      },
    });
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] >= 0 && state[i] !== p.solution[i]) return [{ blocks: [i], set: [i, -1], reason: 'This block moves another way.' }];
    // A block with only one direction that still allows an answer.
    for (let i = 0; i < state.length; i++) {
      if (state[i] >= 0) continue;
      const ok = [0, 1, 2, 3].filter((d) => {
        const t = target(p, p.blocks[i], d);
        if (t < 0) return false;
        const land = p.blocks.map((b, j) => (j === i ? t : state[j] >= 0 ? target(p, b, state[j]) : -1));
        return fine(p, land, false);
      });
      if (ok.length === 1) return [{ blocks: [i], set: [i, ok[0]], reason: 'This block has only one way to go: the others leave the grid or touch another block.' }];
    }
    const i = state.findIndex((v) => v < 0);
    return i < 0 ? [] : [{ blocks: [i], set: [i, p.solution[i]], reason: 'No simple step is left. This block moves this way.' }];
  }

  PuzzleShell.start({
    id: 'hamle',
    name: 'Hamle',
    rules: 'Move every numbered block exactly its number of cells up, down, left or right. After all moves the blocks ' +
      'sit on different cells, never touch each other by a side, and all white cells are connected.',
    controls: 'Click a block to choose its direction (up, right, down, left, none). Right click goes back. ' +
      'The dark cell shows where it lands.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Every block in place — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, b: p.blocks.map((b) => `${b.k}.${b.n}`).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      const blocks = String(d.b).split(',').map((t) => { const [k, m] = t.split('.').map(Number); return { k, n: m }; });
      if (blocks.some((b) => !(b.k >= 0 && b.k < n * n && b.n >= 1 && b.n < n))) throw new Error('Invalid blocks');
      const p = { R: n, C: n, blocks };
      const res = solve(p, 2, 400000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.blocks.length).fill(-1),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.blocks.length).fill(-1);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, i) => { const y = Number(x); if (y >= -1 && y <= 3) s[i] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => v === p.solution[i]),
    hints,
    applyHint(p, s, h) { s[h.set[0]] = h.set[1]; },
  });
})();
