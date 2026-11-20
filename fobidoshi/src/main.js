// Fobidoshi (Forbidden Four). Place circles so that all circles form one
// connected group, and no row or column has four circles in a row.
// Some circles are given. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, given } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) if (given[k]) cons.push({ cells: [k], min: 1, max: 1 });
    const why = () => 'Four circles in a line are not allowed. This cell stays empty.';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = r * C + c;
      if (c + 3 < C) cons.push({ cells: [k, k + 1, k + 2, k + 3], min: 0, max: 3, why });
      if (r + 3 < R) cons.push({ cells: [k, k + C, k + 2 * C, k + 3 * C], min: 0, max: 3, why });
    }
    return { N: R * C, cons, check: (s) => Binary.canConnect(R, C, s, YES) };
  }

  // Circles: grow a connected group while no line of four appears.
  function grow(n) {
    const N = n * n;
    const s = new Uint8Array(N).fill(NO);
    const four = (k) => {
      const r = Math.floor(k / n), c = k % n;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        let run = 1;
        for (let i = 1; i < 4; i++) { const nr = r + dr * i, nc = c + dc * i; if (nr < n && nc < n && s[nr * n + nc] === YES) run++; else break; }
        for (let i = 1; i < 4; i++) { const nr = r - dr * i, nc = c - dc * i; if (nr >= 0 && nc >= 0 && s[nr * n + nc] === YES) run++; else break; }
        if (run >= 4) return true;
      }
      return false;
    };
    s[Math.floor(Math.random() * N)] = YES;
    const target = Math.round(N * (0.5 + Math.random() * 0.1));
    let size = 1;
    for (let fails = 0; size < target && fails < 500;) {
      const front = [];
      for (let k = 0; k < N; k++) {
        const r = Math.floor(k / n), c = k % n;
        if (s[k] === NO && [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && s[a * n + b] === YES)) front.push(k);
      }
      const k = front[Math.floor(Math.random() * front.length)];
      s[k] = YES;
      if (four(k)) { s[k] = NO; fails++; } else size++;
    }
    return size >= target * 0.9 ? s : null;
  }

  function generate(n) {
    for (let t = 0; t < 300; t++) {
      const sol = grow(n);
      if (!sol) continue;
      const p = { R: n, C: n, given: Uint8Array.from(sol, (v) => (v === YES ? 1 : 0)) };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.given, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'fobidoshi',
    name: 'Fobidoshi',
    rules: 'Place circles in empty cells. All circles (given and placed) must form one group joined by sides. ' +
      'No row or column may have four or more circles next to each other.',
    controls: 'Click a cell to place a circle, click again to mark it empty. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'No forbidden fours — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.given).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 4 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[01]+$/.test(d.g)) throw new Error('Invalid circles');
      return { R, C, given: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => (p.given[k] ? YES : 0),
    noun: 'circle', noNoun: 'empty cell',
    className: 'fb-board', yesClass: 'circle', noClass: 'dot',
  });
})();
