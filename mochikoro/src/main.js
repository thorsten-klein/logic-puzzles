// Mochikoro. Shade some cells. The white cells form rectangles that touch
// each other only at corners, and all of them connect through corners.
// A numbered rectangle has exactly that many cells (at most one number
// each). No 2x2 block is fully shaded. Built on the shared Binary page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function flood(starts, ok, nbf) {
    const seen = new Set(starts);
    const stack = [...starts];
    while (stack.length) { const k = stack.pop(); for (const j of nbf(k)) if (!seen.has(j) && ok(j)) { seen.add(j); stack.push(j); } }
    return seen;
  }

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k] > 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells are white.' });
    const nb4 = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const nb8 = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
      }
      return out;
    };
    // 2x2 blocks: white count is never 3 (rectangles) and never 0.
    function propagate(s, log) {
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const white = cells.filter((k) => s[k] === NO).length, black = cells.filter((k) => s[k] === YES).length;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (black === 4 || (white === 3 && black === 1)) return -1;
        if (open.length !== 1) continue;
        let v = 0, why = '';
        if (white === 3) { v = NO; why = 'White areas are rectangles. Three white cells in a 2×2 block need the fourth.'; }
        else if (black === 3) { v = NO; why = 'A 2×2 block may not be fully shaded.'; }
        else if (white === 2 && black === 1) { v = YES; why = 'White areas are rectangles. This cell would make an L shape, so it is shaded.'; }
        if (!v) continue;
        s[open[0]] = v;
        if (log) log.push({ cells: open, v, reason: why });
        return 1;
      }
      return 0;
    }
    function check(s) {
      // All white cells joinable through corners.
      const start = s.indexOf(NO);
      if (start >= 0) {
        const seen = flood([start], (j) => s[j] !== YES, nb8);
        for (let k = 0; k < N; k++) if (s[k] === NO && !seen.has(k)) return false;
      }
      for (let k = 0; k < N; k++) {
        const v = clues[k];
        if (v <= 0) continue;
        const low = flood([k], (j) => s[j] === NO, nb4);
        if (low.size > v) return false;
        for (const j of low) if (j !== k && clues[j] > 0) return false;
        if (flood([k], (j) => s[j] !== YES && !(clues[j] > 0 && j !== k), nb4).size < v) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const blank = { R, C, clues: new Int8Array(N) };
      const sol = Binary.randomFill(model(blank), 0.45, 3);
      if (!sol) continue;
      // Number one cell in most white rectangles.
      const clues = new Int16Array(N);
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (sol[k] !== NO || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (const cur of cells) {
          const x = cur, r = Math.floor(x / C), c = x % C;
          for (const j of [r > 0 ? x - C : -1, r < R - 1 ? x + C : -1, c > 0 ? x - 1 : -1, c < C - 1 ? x + 1 : -1]) {
            if (j >= 0 && !seen[j] && sol[j] === NO) { seen[j] = 1; cells.push(j); }
          }
        }
        if (Math.random() < 0.85) clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      }
      const p = { R, C, clues };
      const s = Binary.logicSolve(model(p));
      if (s && !s.includes(UNKNOWN)) Binary.thinClues(clues, 0, () => model(p));
      else {
        // Not solved by simple logic: accept if the answer is unique.
        const res = Binary.solve(model(p), 2, 20000);
        if (res.solutions.length !== 1 || res.capped) continue;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'mochikoro',
    name: 'Mochikoro',
    rules: 'Shade some cells. The white cells form rectangles that touch each other only at corners, and all white ' +
      'rectangles connect through their corners. A numbered rectangle has exactly that many cells; a rectangle holds ' +
      'at most one number. No 2×2 block is fully shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Rice cakes in a row — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int16Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) };
    },
    model,
    fixed: (p, k) => (p.clues[k] > 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'mk-board',
  });
})();
