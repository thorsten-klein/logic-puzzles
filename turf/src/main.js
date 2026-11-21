// Turf. Shade some cells; the grid splits into shaded and white regions
// (cells of one colour joined by their sides). Every region holds at
// least one number. One number in it is the region's size; any other
// number tells how many white cells are in the 3×3 block around it
// (itself included). Numbered cells may be shaded or white.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const box = Array.from({ length: N }, (_, k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (let a = r - 1; a <= r + 1; a++) for (let b = c - 1; b <= c + 1; b++) if (a >= 0 && b >= 0 && a < R && b < C) out.push(a * C + b);
      return out;
    });
    // White count around k: exact, or -1 if not known yet.
    const around = (s, k) => (box[k].some((j) => s[j] === UNKNOWN) ? -1 : box[k].filter((j) => s[j] === NO).length);
    const cons = [];
    function check(s, done) {
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (seen[k] || s[k] === UNKNOWN) continue;
        const col = s[k];
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (!seen[j] && s[j] === col) { seen[j] = 1; cells.push(j); }
        const nums = cells.filter((x) => clues[x]);
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        // A number that can not be its 3×3 count must be the region size.
        for (const y of nums) {
          const w = box[y].filter((j) => s[j] === NO).length, u = box[y].filter((j) => s[j] === UNKNOWN).length;
          const canCount = w <= clues[y] && w + u >= clues[y];
          if (!canCount && cells.length > clues[y]) return false;
        }
        if (!closed) continue;
        if (!nums.length) return false;
        // Some number is the size; all others must match their 3×3 count.
        const fits = nums.some((x) => clues[x] === cells.length && nums.every((y) => {
          if (y === x) return true;
          const a = around(s, y);
          return a < 0 || a === clues[y];
        }));
        if (!fits) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = new Uint8Array(N);
      for (let k = 0; k < N; k++) sol[k] = Math.random() < 0.5 ? YES : NO;
      // Smooth a little so regions are not all tiny.
      for (let t = 0; t < 2 * N; t++) {
        const k = Math.floor(Math.random() * N), r = Math.floor(k / C), c = k % C;
        const nbs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => sol[a * C + b]);
        const yes = nbs.filter((v) => v === YES).length;
        if (yes * 2 > nbs.length) sol[k] = YES; else if (yes * 2 < nbs.length) sol[k] = NO;
      }
      // Regions and their size clues.
      const id = new Int32Array(N).fill(-1);
      const regions = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0) continue;
        const cells = [k];
        id[k] = regions.length;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i], r = Math.floor(x / C), c = x % C;
          for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            const j = a * C + b;
            if (a >= 0 && b >= 0 && a < R && b < C && id[j] < 0 && sol[j] === sol[k]) { id[j] = regions.length; cells.push(j); }
          }
        }
        regions.push(cells);
      }
      if (regions.some((c) => c.length > 30)) continue;
      const clues = new Int16Array(N);
      const white = (k) => {
        const r = Math.floor(k / C), c = k % C;
        let w = 0;
        for (let a = r - 1; a <= r + 1; a++) for (let b = c - 1; b <= c + 1; b++) if (a >= 0 && b >= 0 && a < R && b < C && sol[a * C + b] === NO) w++;
        return w;
      };
      for (const cells of regions) {
        clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
        // Extra count clues help logic.
        for (const k of cells) if (!clues[k] && white(k) && Math.random() < 0.6) clues[k] = white(k);
      }
      const p = { R, C, clues };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      const sizeClue = new Set(regions.map((cells) => cells.find((k) => clues[k] === cells.length)));
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!clues[k] || sizeClue.has(k)) continue;
        const keep = clues[k];
        clues[k] = 0;
        if (!unique()) clues[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'turf',
    name: 'Turf',
    rules: 'Shade some cells. The grid splits into shaded and white regions (cells of one colour joined by their sides). ' +
      'Every region holds at least one number. One number in it is the region\'s size; any other number tells how many ' +
      'white cells are in the 3×3 block around it, itself included. Numbered cells may be shaded or white.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every patch of turf in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const clues = Int16Array.from(String(d.g).split(','), Number);
      if (clues.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues };
    },
    model,
    draw(p, k, el) { if (p.clues[k]) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nb-board',
  });
})();
