// Rukkuea (Look-Air). Shade some cells. Shaded areas are squares that
// never touch by a side. Two squares of the same size may not see each
// other: a straight line between them in a row or column must pass a
// square of another size. A number counts the shaded cells among itself
// and its four neighbours. Built on the shared Binary game page.

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
    // True when no cell next to k is still open.
    const settled = (k, s) => nb(k).every((j) => s[j] !== UNKNOWN);
    const cons = [];
    for (let k = 0; k < N; k++) {
      if (clues[k] < 0) continue;
      const v = clues[k];
      cons.push({ cells: [k, ...nb(k)], min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs more shaded cells in its plus shape.` : `This ${v} already has its shaded cells.`) });
    }
    function propagate(s, log) {
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const yes = cells.filter((k) => s[k] === YES).length, no = cells.filter((k) => s[k] === NO).length;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (yes === 3 && no === 1) return false;
        if (open.length !== 1) continue;
        if (yes === 3) { s[open[0]] = YES; if (log) { log.push({ cells: open, v: YES, reason: 'Shaded areas are squares. Three shaded cells in a 2×2 block need the fourth.' }); } return 1; }
        if (yes === 2 && no === 1) { s[open[0]] = NO; if (log) { log.push({ cells: open, v: NO, reason: 'Shaded areas are squares. This cell would make an L shape.' }); } return 1; }
      }
      return 0;
    }
    function check(s, done) {
      const id = new Int32Array(N).fill(-1), list = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || s[k] !== YES) continue;
        const cells = [k];
        id[k] = list.length;
        for (const cur of cells) for (const j of nb(cur)) if (id[j] < 0 && s[j] === YES) { id[j] = list.length; cells.push(j); }
        list.push(cells);
      }
      const size = list.map((cells) => {
        const rows = cells.map((k) => Math.floor(k / C)), cols = cells.map((k) => k % C);
        const r1 = Math.min(...rows), r2 = Math.max(...rows), c1 = Math.min(...cols), c2 = Math.max(...cols);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (s[r * C + c] === NO) return -2;
        const closed = done || cells.every((k) => settled(k, s));
        if (!closed) return 0;
        return r2 - r1 === c2 - c1 && cells.length === (r2 - r1 + 1) * (c2 - c1 + 1) ? r2 - r1 + 1 : -2;
      });
      if (size.includes(-2)) return false;
      // Sight: from each closed square, the first shaded cell seen along
      // a row or column must not belong to a closed square of equal size.
      for (let a = 0; a < list.length; a++) {
        if (!size[a]) continue;
        for (const k of list[a]) {
          const r = Math.floor(k / C), c = k % C;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let x = r + dr, y = c + dc;
            while (x >= 0 && y >= 0 && x < R && y < C) {
              const j = x * C + y;
              if (s[j] === UNKNOWN) break;
              if (s[j] === YES) {
                if (id[j] !== a && size[id[j]] === size[a]) return false;
                break;
              }
              x += dr; y += dc;
            }
          }
        }
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  // Answer: random squares, not touching by a side, obeying the sight rule.
  function makeAnswer(n) {
    const N = n * n;
    const m = model({ R: n, C: n, clues: new Int8Array(N).fill(-1) });
    const shade = new Uint8Array(N);
    const near = (k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && shade[a * n + b]);
    };
    for (let t = 0; t < n * 5; t++) {
      const size = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
      const r = Math.floor(Math.random() * (n - size + 1)), c = Math.floor(Math.random() * (n - size + 1));
      const cells = [];
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) cells.push((r + i) * n + c + j);
      if (cells.some((k) => shade[k] || near(k))) continue;
      cells.forEach((k) => { shade[k] = 1; });
      if (!m.check(Uint8Array.from(shade, (x) => (x ? YES : NO)), true)) cells.forEach((k) => { shade[k] = 0; });
    }
    return Uint8Array.from(shade, (x) => (x ? YES : NO));
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const sol = makeAnswer(n);
      const p = { R: n, C: n, clues: new Int8Array(N) };
      for (let k = 0; k < N; k++) {
        const r = Math.floor(k / n), c = k % n;
        p.clues[k] = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && sol[a * n + b] === YES).length;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'rukkuea',
    name: 'Rukkuea',
    rules: 'Shade some cells. Every shaded area is a square, and squares never touch by a side. Two squares of the same ' +
      'size may not see each other: a straight line between them along a row or column must pass a square of another size. ' +
      'A number tells how many of five cells — itself and its four neighbours — are shaded. Numbered cells may be shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Look, fresh air — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-5]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    draw(p, k, el) { if (p.clues[k] >= 0) el.append(String(p.clues[k])); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'rk-board',
  });
})();
