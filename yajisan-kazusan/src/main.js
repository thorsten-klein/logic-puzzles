// Yajisan-Kazusan. Shade some cells. Shaded cells never touch by a side,
// and all white cells connect. A number with an arrow counts the shaded
// cells in that direction — but only if its own cell stays white. A clue
// cell may be shaded; a wrong clue must be shaded.
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
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (const j of [c < C - 1 ? k + 1 : -1, r < R - 1 ? k + C : -1]) {
        if (j >= 0) cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Shaded cells must never touch by a side.' });
      }
    }
    const rays = Array.from(num, (v, k) => (v >= 0 ? ray(R, C, k, dir[k]) : null));
    function propagate(s, log) {
      for (let k = 0; k < N; k++) {
        if (num[k] < 0 || s[k] === YES) continue;
        const v = num[k];
        const yes = rays[k].filter((j) => s[j] === YES).length;
        const open = rays[k].filter((j) => s[j] === UNKNOWN);
        const broken = yes > v || yes + open.length < v;
        if (s[k] === UNKNOWN) {
          if (!broken) continue;
          s[k] = YES;
          if (log) log.push({ cells: [k], v: YES, at: k, reason: `This clue can not be true any more, so its cell must be shaded.` });
          return 1;
        }
        // The clue cell is white, so the clue is true.
        if (broken) {
          const seen = yes > v ? yes : yes + open.length;
          const sees = yes > v ? `already sees ${seen}` : `can see at most ${seen}`;
          if (log) log.push({ fail: true, at: k, reason: `This white clue must be true, but it ${sees} shaded ${seen === 1 ? 'cell' : 'cells'}, not ${v}.` });
          return false;
        }
        if (!open.length) continue;
        if (yes === v) {
          open.forEach((j) => { s[j] = NO; });
          if (log) log.push({ cells: open, v: NO, at: k, reason: `This white clue already sees its ${v} shaded cells.` });
          return open.length;
        }
        if (yes + open.length === v) {
          open.forEach((j) => { s[j] = YES; });
          if (log) log.push({ cells: open, v: YES, at: k, reason: `This white clue needs every open cell in its direction shaded.` });
          return open.length;
        }
      }
      return 0;
    }
    function check(s) {
      for (let k = 0; k < N; k++) {
        if (num[k] < 0 || s[k] !== NO) continue;
        const yes = rays[k].filter((j) => s[j] === YES).length;
        const open = rays[k].filter((j) => s[j] === UNKNOWN).length;
        if (yes > num[k] || yes + open < num[k]) return false;
      }
      return Binary.canConnect(R, C, s, NO);
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const base = { R, C, num: new Int8Array(N).fill(-1), dir: new Int8Array(N) };
      const fill = Binary.randomFill(model(base), 0.35, 10);
      if (!fill) continue;
      const p = { R, C, num: new Int8Array(N).fill(-1), dir: new Int8Array(N) };
      for (let k = 0; k < N; k++) {
        const opts = [0, 1, 2, 3].filter((d) => ray(R, C, k, d).length);
        const d = opts[Math.floor(Math.random() * opts.length)];
        const truth = ray(R, C, k, d).filter((j) => fill[j] === YES).length;
        if (fill[k] === NO) { p.dir[k] = d; p.num[k] = truth; }
        else if (Math.random() < 0.5) {
          // Shaded cell with a false clue.
          p.dir[k] = d;
          p.num[k] = truth === 0 ? 1 + Math.floor(Math.random() * 2) : Math.random() < 0.5 ? truth - 1 : truth + 1;
        }
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
    id: 'yajisan-kazusan',
    name: 'Yajisan-Kazusan',
    rules: 'Shade some cells. Shaded cells must never touch by a side. All white cells form one connected area. ' +
      'Each clue is a number with an arrow. A white clue tells the truth: the number is how many shaded cells ' +
      'lie in the arrow\'s direction. A shaded clue is switched off: its number means nothing. ' +
      'So a clue whose number cannot be true must be shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Truth and lies sorted — nicely done.',
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
    draw(p, k, el) { if (p.num[k] >= 0) el.append(p.num[k] + ARROW[p.dir[k]]); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'yk2-board yz-board',
  });
})();
