// Corral (Bag, Cave). One closed fence along the grid lines goes around
// all numbers. Here you mark the cells inside the fence: inside cells
// connect, and every outside cell reaches the edge of the grid (no holes).
// A number tells how many inside cells it sees up, down, left and right,
// itself included. Built on the shared Binary game page (YES = inside).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k]) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Numbers are inside the corral.' });
    // Seen inside cells: sure ones (low) and possible ones (high).
    const view = (s, k) => {
      let low = 1, high = 1;
      for (const [dr, dc] of DIRS) {
        let sure = true;
        for (let r = Math.floor(k / C) + dr, c = (k % C) + dc; r >= 0 && c >= 0 && r < R && c < C; r += dr, c += dc) {
          const v = s[r * C + c];
          if (v === NO) break;
          if (v === UNKNOWN) sure = false;
          high++;
          if (sure) low++;
        }
      }
      return [low, high];
    };
    // Outside cells reach the edge through outside or open cells.
    const outsideOk = (s) => {
      const seen = new Uint8Array(N);
      const stack = [];
      for (let k = 0; k < N; k++) {
        const r = Math.floor(k / C), c = k % C;
        if ((r === 0 || c === 0 || r === R - 1 || c === C - 1) && s[k] !== YES) { seen[k] = 1; stack.push(k); }
      }
      while (stack.length) {
        const k = stack.pop(), r = Math.floor(k / C), c = k % C;
        for (const [dr, dc] of DIRS) {
          const a = r + dr, b = c + dc, j = a * C + b;
          if (a >= 0 && b >= 0 && a < R && b < C && !seen[j] && s[j] !== YES) { seen[j] = 1; stack.push(j); }
        }
      }
      return [...new Array(N).keys()].every((k) => s[k] !== NO || seen[k]);
    };
    function check(s) {
      for (let k = 0; k < N; k++) {
        if (!clues[k]) continue;
        const [low, high] = view(s, k);
        if (low > clues[k] || high < clues[k]) return false;
      }
      return Binary.canConnect(R, C, s, YES) && outsideOk(s);
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      // A random inside area: grow a blob, then fill holes.
      const inside = new Uint8Array(N);
      inside[Math.floor(Math.random() * N)] = 1;
      const target = Math.round(N * (0.45 + Math.random() * 0.2));
      for (let t = 0; t < N * 20 && inside.reduce((a, b) => a + b, 0) < target; t++) {
        const k = Math.floor(Math.random() * N);
        if (inside[k]) continue;
        const r = Math.floor(k / C), c = k % C;
        if (DIRS.some(([dr, dc]) => { const a = r + dr, b = c + dc; return a >= 0 && b >= 0 && a < R && b < C && inside[a * C + b]; })) inside[k] = 1;
      }
      const sol = Uint8Array.from(inside, (v) => (v ? YES : NO));
      const base = model({ R, C, clues: new Int8Array(N) });
      if (!base.check(sol)) continue;
      // Numbers on all inside cells, then thin.
      const clues = new Int8Array(N);
      for (let k = 0; k < N; k++) {
        if (!inside[k]) continue;
        let seen = 1;
        for (const [dr, dc] of DIRS) for (let r = Math.floor(k / C) + dr, c = (k % C) + dc; r >= 0 && c >= 0 && r < R && c < C && inside[r * C + c]; r += dr, c += dc) seen++;
        clues[k] = seen;
      }
      const p = { R, C, clues };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'corral',
    name: 'Corral',
    rules: 'One closed fence along the grid lines goes around all numbers. Mark the cells inside the fence: the inside ' +
      'cells connect, and every outside cell reaches the edge of the grid (the fence has no holes). A number tells how ' +
      'many inside cells it sees up, down, left and right, itself included.',
    controls: 'Click a cell to mark it inside, click again to mark it outside. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'The herd is safe — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] ? YES : 0),
    draw(p, k, el) { if (p.clues[k]) el.textContent = p.clues[k]; },
    yesClass: 'cr-in', noClass: 'cr-out',
    noun: 'inside cell', noNoun: 'outside cell',
    className: 'cr-board',
  });
})();
