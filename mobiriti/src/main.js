// Mobiriti (Mobility). Shade some cells. Circles stay white. A number in
// a circle tells how many empty white cells (cells without a circle) can
// be reached from it, moving up, down, left and right over white cells.
// Built on the shared Binary game page (YES = shaded).
// p.num: -1 no circle, else the count.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, num } = p;
    const N = R * C;
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const cons = [];
    for (let k = 0; k < N; k++) if (num[k] >= 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Circles stay white.' });
    // Empty cells reached from k through cells that pass `ok`.
    const reach = (k, ok) => {
      const seen = new Uint8Array(N);
      seen[k] = 1;
      const stack = [k];
      let count = 0;
      while (stack.length) {
        const x = stack.pop();
        for (const j of nb(x)) if (!seen[j] && ok(j)) { seen[j] = 1; stack.push(j); if (num[j] < 0) count++; }
      }
      return count;
    };
    function check(s) {
      for (let k = 0; k < N; k++) {
        if (num[k] < 0) continue;
        const low = reach(k, (j) => s[j] === NO), high = reach(k, (j) => s[j] !== YES);
        if (low > num[k] || high < num[k]) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = Uint8Array.from({ length: N }, () => (Math.random() < 0.4 ? YES : NO));
      const nb = (k) => { const r = Math.floor(k / C), c = k % C; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => a * C + b); };
      // A shaded cell with no white neighbour could be white unseen: avoid.
      for (let k = 0; k < N; k++) if (sol[k] === YES && nb(k).every((j) => sol[j] === YES)) sol[k] = NO;
      // Circles on about a third of the white cells; counts from the answer.
      const num = new Int8Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (sol[k] === NO && Math.random() < 0.35) num[k] = 0;
      // Every white area gets at least one circle.
      const area = new Int32Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (sol[k] !== NO || area[k] >= 0) continue;
        const cells = [k];
        area[k] = k;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (sol[j] === NO && area[j] < 0) { area[j] = k; cells.push(j); }
        if (!cells.some((x) => num[x] >= 0)) num[cells[Math.floor(Math.random() * cells.length)]] = 0;
      }
      const recount = () => {
        for (let k = 0; k < N; k++) {
          if (num[k] < 0) continue;
          const seen = new Uint8Array(N);
          seen[k] = 1;
          const stack = [k];
          let count = 0;
          while (stack.length) { const x = stack.pop(); for (const j of nb(x)) if (!seen[j] && sol[j] === NO) { seen[j] = 1; stack.push(j); if (num[j] < 0) count++; } }
          num[k] = count;
        }
      };
      recount();
      if ([...num].some((v) => v > 35)) continue;
      const p = { R, C, num };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      // Drop circles while it stays unique (the other counts change).
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (num[k] < 0) continue;
        const before = Int8Array.from(num);
        num[k] = -1;
        recount();
        if (!unique()) num.set(before);
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'mobiriti',
    name: 'Mobiriti',
    rules: 'Shade some cells. Circles stay white. A number in a circle tells how many empty white cells (cells without a ' +
      'circle) can be reached from it by moving up, down, left and right over white cells.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Room to move — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.num, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid circles');
      return { R, C, num: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.num[k] >= 0 ? NO : 0),
    draw(p, k, el) {
      if (p.num[k] < 0) return;
      const o = document.createElement('span');
      o.className = 'nm-circle';
      o.textContent = p.num[k];
      el.append(o);
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nm-board',
  });
})();
