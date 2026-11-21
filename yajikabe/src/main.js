// Yajikabe. Shade some cells. Clue cells stay white. A number with an
// arrow counts the shaded cells in that direction. All shaded cells
// connect, and no 2×2 block is all shaded.
// Built on the shared Binary game page (YES = shaded).
// p.num: -1 none, else count; p.dir: 0 up, 1 down, 2 left, 3 right.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const ARROW = ['↑︎', '↓︎', '←︎', '→︎'];

  const ray = (R, C, k, d) => {
    const [dr, dc] = [[-1, 0], [1, 0], [0, -1], [0, 1]][d], out = [];
    let r = Math.floor(k / C) + dr, c = (k % C) + dc;
    while (r >= 0 && c >= 0 && r < R && c < C) { out.push(r * C + c); r += dr; c += dc; }
    return out;
  };

  function model(p) {
    const { R, C, num, dir } = p;
    const N = R * C;
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) {
      if (num[k] < 0) continue;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'Clue cells stay white.' });
      const v = num[k];
      cons.push({ cells: ray(R, C, k, dir[k]), min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs more shaded cells in its direction.` : `This ${v} already sees its ${v} shaded cells.`) });
    }
    const check = (s) => Binary.canConnect(R, C, s, YES);
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const base = { R, C, num: new Int8Array(N).fill(-1), dir: new Int8Array(N) };
      const fill = Binary.randomFill(model(base), 0.55, 10);
      if (!fill) continue;
      const yes = fill.filter((v) => v === YES).length;
      if (yes < N * 0.3 || yes > N * 0.6) continue;
      // Clues on every white cell, pointing the way that sees the most.
      const p = { R, C, num: new Int8Array(N).fill(-1), dir: new Int8Array(N) };
      for (let k = 0; k < N; k++) {
        if (fill[k] !== NO) continue;
        const opts = [0, 1, 2, 3].filter((d) => ray(R, C, k, d).length);
        const d = opts[Math.floor(Math.random() * opts.length)];
        p.dir[k] = d;
        p.num[k] = ray(R, C, k, d).filter((j) => fill[j] === YES).length;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.num, -1, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'yajikabe',
    name: 'Yajikabe',
    rules: 'Shade some cells. Clue cells stay white. A number with an arrow tells how many shaded cells lie in the ' +
      'arrow\'s direction. All shaded cells connect by their sides, and no 2×2 block is all shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'One solid wall — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, n: Array.from(p.num, (v, k) => (v < 0 ? '.' : v.toString(36) + p.dir[k])).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const parts = String(d.n).split(',');
      if (parts.length !== R * C) throw new Error('Invalid clues');
      const num = new Int8Array(R * C).fill(-1), dir = new Int8Array(R * C);
      parts.forEach((t, k) => {
        if (t === '.') return;
        num[k] = Number.parseInt(t.slice(0, -1), 36);
        dir[k] = Number(t.slice(-1)) % 4;
        if (!Number.isInteger(num[k]) || num[k] < 0) throw new Error('Invalid clues');
      });
      return { R, C, num, dir };
    },
    model,
    fixed: (p, k) => (p.num[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.num[k] >= 0) el.textContent = p.num[k] + ARROW[p.dir[k]]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'yk2-board',
  });
})();
