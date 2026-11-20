// Gaidoaro (Guide Arrow). Shade some cells. Shaded cells never touch by a
// side. Arrow cells and the star stay white. All white cells connect, and
// from every white cell there is only one way to the star (no loops of
// white cells). An arrow shows the first step on that way.
// Built on the shared Binary game page (YES = shaded).
// p.arrow: -1 none, 0 up, 1 down, 2 left, 3 right; p.star: star cell.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function model(p) {
    const { R, C, arrow, star } = p;
    const N = R * C;
    const to = (k, d) => {
      const r = Math.floor(k / C) + STEP[d][0], c = (k % C) + STEP[d][1];
      return r >= 0 && c >= 0 && r < R && c < C ? r * C + c : -1;
    };
    const cons = [];
    for (let k = 0; k < N; k++) {
      for (const d of [1, 3]) { const j = to(k, d); if (j >= 0) cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Shaded cells must never touch by a side.' }); }
      if (arrow[k] >= 0 || k === star) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Arrows and the star stay white.' });
      if (arrow[k] >= 0) {
        const j = to(k, arrow[k]);
        if (j >= 0) cons.push({ cells: [j], min: 0, max: 0, why: () => 'The arrow points the way to the star, so the cell it points at is white.' });
      }
    }
    function check(s, done) {
      // No loop of white cells (union-find on white-white sides).
      const parent = Int32Array.from({ length: N }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (let k = 0; k < N; k++) {
        if (s[k] !== NO) continue;
        for (const d of [1, 3]) {
          const j = to(k, d);
          if (j < 0 || s[j] !== NO) continue;
          const a = find(k), b = find(j);
          if (a === b) return false;
          parent[a] = b;
        }
      }
      if (!Binary.canConnect(R, C, s, NO)) return false;
      if (!done) return true;
      // Arrows: the first step from each arrow toward the star.
      const dist = new Int32Array(N).fill(-1);
      dist[star] = 0;
      const queue = [star];
      for (let i = 0; i < queue.length; i++) {
        for (let d = 0; d < 4; d++) {
          const j = to(queue[i], d);
          if (j >= 0 && s[j] === NO && dist[j] < 0) { dist[j] = dist[queue[i]] + 1; queue.push(j); }
        }
      }
      for (let k = 0; k < N; k++) {
        if (arrow[k] < 0) continue;
        const j = to(k, arrow[k]);
        if (j < 0 || dist[j] !== dist[k] - 1) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const base = { R, C, arrow: new Int8Array(N).fill(-1), star: -1 };
      const fill = Binary.randomFill(model(base), 0.4, 10);
      if (!fill) continue;
      const whites = [...fill.keys()].filter((k) => fill[k] === NO);
      const star = whites[Math.floor(Math.random() * whites.length)];
      // Arrows from the tree of white cells.
      const dist = new Int32Array(N).fill(-1);
      dist[star] = 0;
      const queue = [star];
      const to = (k, d) => {
        const r = Math.floor(k / n) + STEP[d][0], c = (k % n) + STEP[d][1];
        return r >= 0 && c >= 0 && r < n && c < n ? r * n + c : -1;
      };
      for (let i = 0; i < queue.length; i++) {
        for (let d = 0; d < 4; d++) {
          const j = to(queue[i], d);
          if (j >= 0 && fill[j] === NO && dist[j] < 0) { dist[j] = dist[queue[i]] + 1; queue.push(j); }
        }
      }
      const arrow = new Int8Array(N).fill(-1);
      for (const k of whites) {
        if (k === star) continue;
        arrow[k] = [0, 1, 2, 3].find((d) => { const j = to(k, d); return j >= 0 && fill[j] === NO && dist[j] === dist[k] - 1; });
      }
      const p = { R, C, arrow, star };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.arrow, -1, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'gaidoaro',
    name: 'Gaidoaro',
    rules: 'Shade some cells. Shaded cells must never touch by a side. Arrow cells and the star stay white. All white cells ' +
      'connect, and from every white cell there is only one way to the star — white cells never form a loop. ' +
      'An arrow shows the first step on the way from its cell to the star.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Every arrow points home — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, s: p.star, a: Array.from(p.arrow, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (!Number.isInteger(d.s) || d.s < 0 || d.s >= R * C) throw new Error('Invalid star');
      if (typeof d.a !== 'string' || d.a.length !== R * C || !/^[.0-3]+$/.test(d.a)) throw new Error('Invalid arrows');
      return { R, C, star: d.s, arrow: Int8Array.from(d.a, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    fixed: (p, k) => (p.arrow[k] >= 0 || k === p.star ? NO : 0),
    draw(p, k, el) {
      if (k === p.star) { el.classList.add('ga-star'); el.textContent = '★'; return; }
      if (p.arrow[k] >= 0) el.append(PuzzleShell.arrowIcon([0, 4, 6, 2][p.arrow[k]]));
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ga-board',
  });
})();
