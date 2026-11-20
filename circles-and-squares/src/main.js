// Circles and Squares. Shade some cells. Cells with black circles are
// shaded, cells with white circles stay white. Every white area is a
// square. No 2×2 block is all shaded, and all shaded cells connect.
// Built on the shared Binary game page (YES = shaded).
// Clues: 0 none, 1 black circle, 2 white circle.

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
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) {
      if (clues[k] === 1) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Black circles are shaded.' });
      if (clues[k] === 2) cons.push({ cells: [k], min: 0, max: 0, why: () => 'White circles stay white.' });
    }
    function propagate(s, log) {
      // Three white cells of a 2×2 block need the fourth (squares).
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const no = cells.filter((k) => s[k] === NO).length;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (no === 3 && open.length === 1) {
          s[open[0]] = NO;
          if (log) log.push({ cells: open, v: NO, reason: 'White areas are squares. Three white cells in a 2×2 block need the fourth.' });
          return 1;
        }
      }
      return 0;
    }
    function check(s, done) {
      const id = new Int32Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || s[k] !== NO) continue;
        const cells = [k];
        id[k] = k;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (id[j] < 0 && s[j] === NO) { id[j] = k; cells.push(j); }
        const rows = cells.map((x) => Math.floor(x / C)), cols = cells.map((x) => x % C);
        const r1 = Math.min(...rows), r2 = Math.max(...rows), c1 = Math.min(...cols), c2 = Math.max(...cols);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (s[r * C + c] === YES) return false;
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        if (closed && (r2 - r1 !== c2 - c1 || cells.length !== (r2 - r1 + 1) * (c2 - c1 + 1))) return false;
      }
      return Binary.canConnect(R, C, s, YES);
    }
    return { N, cons, propagate, check };
  }

  // Answer: white squares that never touch by a side; the rest shaded.
  function makeAnswer(n) {
    const N = n * n;
    const white = new Uint8Array(N);
    const near = (k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && white[a * n + b]);
    };
    for (let t = 0; t < n * 8; t++) {
      const size = Math.random() < 0.45 ? 1 : Math.random() < 0.7 ? 2 : 3;
      const r = Math.floor(Math.random() * (n - size + 1)), c = Math.floor(Math.random() * (n - size + 1));
      const cells = [];
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) cells.push((r + i) * n + c + j);
      if (cells.some((k) => white[k] || near(k))) continue;
      cells.forEach((k) => { white[k] = 1; });
      const s = Uint8Array.from(white, (x) => (x ? NO : YES));
      if (!Binary.canConnect(n, n, s, YES)) cells.forEach((k) => { white[k] = 0; });
    }
    // Break up all-shaded 2×2 blocks with single white cells.
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const block = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      if (block.some((k) => white[k])) continue;
      for (const k of PuzzleShell.shuffle(block)) {
        if (near(k)) continue;
        white[k] = 1;
        if (Binary.canConnect(n, n, Uint8Array.from(white, (x) => (x ? NO : YES)), YES)) break;
        white[k] = 0;
      }
    }
    return Uint8Array.from(white, (x) => (x ? NO : YES));
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const sol = makeAnswer(n);
      const p = { R: n, C: n, clues: Uint8Array.from(sol, (v) => (v === YES ? 1 : 2)) };
      const m = model(p);
      if (!m.check(sol, true) || !m.cons.every((c) => { const y = c.cells.filter((k) => sol[k] === YES).length; return y >= c.min && y <= c.max; })) continue;
      Binary.thinClues(p.clues, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'circles-and-squares',
    name: 'Circles and Squares',
    rules: 'Shade some cells. Cells with black circles are shaded; cells with white circles stay white. Every white area ' +
      'is a square. No 2×2 block is all shaded, and all shaded cells connect by their sides.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Squared away — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[012]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => (p.clues[k] === 1 ? YES : p.clues[k] === 2 ? NO : 0),
    draw(p, k, el) {
      if (!p.clues[k]) return;
      const o = document.createElement('span');
      o.className = 'cs-circle ' + (p.clues[k] === 1 ? 'black' : 'white');
      el.append(o);
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cs-board',
  });
})();
