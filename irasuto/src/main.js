// Irasuto. Shade some cells. Numbers sit in white or shaded cells. A
// number counts the cells of its own colour it can see in its row and
// column, up to the first cell of the other colour on each side. Other
// numbered cells do not count (but do not block the view either).
// Built on the shared Binary game page (YES = shaded).
// p.num: -1 none, else count; p.col: YES or NO for numbered cells.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function model(p) {
    const { R, C, num, col } = p;
    const N = R * C;
    const cons = [];
    for (let k = 0; k < N; k++) if (num[k] >= 0) cons.push({ cells: [k], min: col[k] === YES ? 1 : 0, max: col[k] === YES ? 1 : 0, why: () => 'A numbered cell keeps its colour.' });
    // low: cells surely seen; high: cells that may be seen.
    const view = (s, k) => {
      const me = col[k];
      let low = 0, high = 0;
      for (const [dr, dc] of DIRS) {
        let r = Math.floor(k / C) + dr, c = (k % C) + dc, sure = true;
        while (r >= 0 && c >= 0 && r < R && c < C) {
          const j = r * C + c, v = s[j];
          if (v !== UNKNOWN && v !== me) break;
          if (v === UNKNOWN) sure = false;
          if (num[j] < 0) { high++; if (sure) low++; }
          r += dr; c += dc;
        }
      }
      return [low, high];
    };
    function check(s) {
      for (let k = 0; k < N; k++) {
        if (num[k] < 0) continue;
        const [low, high] = view(s, k);
        if (low > num[k] || high < num[k]) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function computeSeen(N, C, R, sol, num) {
    for (let j = 0; j < N; j++) {
      if (num[j] < 0) continue;
      let seen = 0;
      for (const [dr, dc] of DIRS) {
        let r = Math.floor(j / C) + dr, c = (j % C) + dc;
        while (r >= 0 && c >= 0 && r < R && c < C && sol[r * C + c] === sol[j]) {
          if (num[r * C + c] < 0) { seen++; }
          r += dr; c += dc;
        }
      }
      num[j] = seen;
    }
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = Uint8Array.from({ length: N }, () => (Math.random() < 0.5 ? YES : NO));
      // Numbers on about a third of the cells, then thin.
      const num = new Int8Array(N).fill(-1), col = new Uint8Array(N);
      for (let k = 0; k < N; k++) if (Math.random() < 0.35) { num[k] = 0; col[k] = sol[k]; }
      computeSeen(N, C, R, sol, num);
      const p = { R, C, num, col };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      // Drop numbers while logic still solves it. Counts of the others
      // stay right: numbered cells never count.
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (num[k] < 0) continue;
        const keep = num[k];
        num[k] = -1;
        // Removing a number changes what the others see; recount.
        const before = Int8Array.from(num);
        computeSeen(N, C, R, sol, num);
        const t = Binary.logicSolve(model(p));
        if (!t || t.includes(UNKNOWN)) { num.set(before); num[k] = keep; }
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'irasuto',
    name: 'Irasuto',
    rules: 'Shade some cells. Numbers sit in white or shaded cells and keep their colour. A number tells how many cells ' +
      'of its own colour it can see in its row and column, up to the first cell of the other colour on each side. ' +
      'Other numbered cells are not counted, but they do not block the view.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'The picture is complete — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.num, (v, k) => {
      if (v < 0) return '.';
      return (p.col[k] === YES ? 'b' : 'w') + v.toString(36);
    }).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const parts = String(d.g).split(',');
      if (parts.length !== R * C || parts.some((t) => t !== '.' && !/^[bw][0-9a-z]+$/.test(t))) throw new Error('Invalid clues');
      const num = new Int8Array(R * C).fill(-1), col = new Uint8Array(R * C);
      parts.forEach((t, k) => { if (t !== '.') { col[k] = t[0] === 'b' ? YES : NO; num[k] = Number.parseInt(t.slice(1), 36); } });
      return { R, C, num, col };
    },
    model,
    fixed: (p, k) => (p.num[k] >= 0 ? p.col[k] : 0),
    draw(p, k, el) { if (p.num[k] >= 0) el.append(String(p.num[k])); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ir-board',
  });
})();
