// Miraringutairu (Mirroring Tile). Shade more cells so the shaded cells
// form blocks. Blocks never share a side. Each block holds at least one of
// the given black cells; a number tells the size of its block. Every block
// touches, at a corner, at least one other block with the same shape and
// size (it may be turned or mirrored).
// Built on the shared Binary game page (YES = shaded).
// Clues: 0 none, 1 given black cell, v + 1 given black cell with number v.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function shapeKey(C, cells) {
    const pts = cells.map((k) => [Math.floor(k / C), k % C]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let a = r, b = c;
        if (t & 1) [a, b] = [b, -a];
        if (t & 2) [a, b] = [-a, -b];
        if (t & 4) b = -b;
        return [a, b];
      });
      const r0 = Math.min(...q.map((x) => x[0])), c0 = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - r0},${b - c0}`).sort().join(' '));
    }
    return keys.sort()[0];
  }

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k]) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Given black cells are shaded.' });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const diag = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) if (a >= 0 && b >= 0 && a < R && b < C) out.push(a * C + b);
      return out;
    };
    function check(s, done) {
      const area = new Int32Array(N).fill(-1);
      const areas = [];
      for (let k = 0; k < N; k++) {
        if (area[k] >= 0 || s[k] !== YES) continue;
        const cells = [k];
        area[k] = areas.length;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (area[j] < 0 && s[j] === YES) { area[j] = areas.length; cells.push(j); }
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        areas.push({ cells, closed });
      }
      for (const A of areas) {
        const nums = A.cells.filter((x) => clues[x] > 1).map((x) => clues[x] - 1);
        if (nums.some((v) => v < A.cells.length || (A.closed && v !== A.cells.length))) return false;
        if (A.closed && !A.cells.some((x) => clues[x])) return false;
      }
      if (done) {
        const keys = areas.map((A) => shapeKey(C, A.cells));
        for (let i = 0; i < areas.length; i++) {
          const near = new Set();
          for (const x of areas[i].cells) for (const j of diag(x)) if (area[j] >= 0 && area[j] !== i) near.add(area[j]);
          if (![...near].some((j) => keys[j] === keys[i])) return false;
        }
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = new Uint8Array(N).fill(NO);
      const blocks = [];
      const inGrid = (r, c) => r >= 0 && c >= 0 && r < R && c < C;
      const free = (k, own) => {
        if (sol[k] === YES) return false;
        const r = Math.floor(k / C), c = k % C;
        return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].every(([a, b]) => !inGrid(a, b) || own.has(a * C + b) || sol[a * C + b] !== YES);
      };
      for (let t = 0; t < 60 && blocks.length < Math.round(N / 6); t++) {
        // A random shape.
        const size = 1 + Math.floor(Math.random() * 4);
        const shape = [[0, 0]];
        while (shape.length < size) {
          const [r, c] = shape[Math.floor(Math.random() * shape.length)];
          const [dr, dc] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
          if (!shape.some(([a, b]) => a === r + dr && b === c + dc)) shape.push([r + dr, c + dc]);
        }
        const place = (r0, c0, tr) => shape.map(([r, c]) => {
          let a = r, b = c;
          if (tr & 1) [a, b] = [b, -a];
          if (tr & 2) [a, b] = [-a, -b];
          if (tr & 4) b = -b;
          return inGrid(r0 + a, c0 + b) ? (r0 + a) * C + c0 + b : -1;
        });
        const first = place(Math.floor(Math.random() * R), Math.floor(Math.random() * C), 0);
        const own1 = new Set(first);
        if (first.some((k) => k < 0 || !free(k, own1))) continue;
        // A copy touching it at a corner.
        let second = null;
        for (let u = 0; u < 40 && !second; u++) {
          const x = first[Math.floor(Math.random() * first.length)];
          const r = Math.floor(x / C) + (Math.random() < 0.5 ? -1 : 1), c = (x % C) + (Math.random() < 0.5 ? -1 : 1);
          const cand = place(r, c, Math.floor(Math.random() * 8));
          const own2 = new Set(cand);
          if (cand.some((k) => k < 0 || own1.has(k) || !free(k, own2))) continue;
          // No side contact between the two copies.
          if (cand.some((k) => first.some((j) => Math.abs(j - k) === C || (Math.abs(j - k) === 1 && Math.floor(j / C) === Math.floor(k / C))))) continue;
          second = cand;
        }
        if (!second) continue;
        for (const b of [first, second]) { b.forEach((k) => { sol[k] = YES; }); blocks.push(b); }
      }
      if (blocks.length < 2) continue;
      // Given cells: all block cells, with numbers; then thin out.
      const clues = new Int16Array(N);
      for (const b of blocks) for (const k of b) clues[k] = b.length + 1;
      const p = { R, C, clues };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      const blockOf = new Int32Array(N).fill(-1);
      blocks.forEach((b, i) => b.forEach((k) => { blockOf[k] = i; }));
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (!clues[k]) continue;
        const keep = clues[k];
        // First try to drop the number, then the cell itself (each block keeps one).
        if (keep > 1) { clues[k] = 1; if (!unique()) { clues[k] = keep; continue; } }
        if (blocks[blockOf[k]].filter((j) => clues[j]).length > 1) { const v = clues[k]; clues[k] = 0; if (!unique()) clues[k] = v; }
        if (Date.now() > deadline + 3000) break;
      }
      // The player must shade at least one cell.
      if (sol.every((v, k) => v !== YES || clues[k])) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'miraringutairu',
    name: 'Miraringutairu',
    rules: 'Shade more cells so the shaded cells form blocks. Blocks never share a side. Each block holds at least one of ' +
      'the given black cells, and a number tells the size of its block. Every block touches, at a corner, at least one ' +
      'other block with the same shape and size (it may be turned or mirrored).',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Mirror twins everywhere — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const clues = Int16Array.from(String(d.g).split(','), Number);
      if (clues.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues };
    },
    model,
    fixed: (p, k) => (p.clues[k] ? YES : 0),
    draw(p, k, el) {
      const v = p.clues[k];
      if (!v) return;
      el.classList.add('mr-given');
      if (v > 1) el.textContent = v - 1;
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'mr-board',
  });
})();
