// Tasukuea. Shade some cells so the shaded areas are squares that never
// touch by a side. A number counts all shaded cells in the squares next
// to it (by a side); a "?" needs at least one square next to it. Clue
// cells stay white, and all white cells connect.
// Built on the shared Binary game page (YES = shaded). Clue -2 = "?".

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const Q = -2;

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
    for (let k = 0; k < N; k++) {
      if (clues[k] === -1) continue;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'Clue cells stay white.' });
      if (clues[k] === Q) cons.push({ cells: nb(k), min: 1, max: 4, at: k, why: () => 'A "?" needs a shaded square next to it.' });
    }
    function propagate(s, log) {
      // Rectangles: no 2x2 block with exactly 3 shaded cells.
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const yes = cells.filter((k) => s[k] === YES).length, no = cells.filter((k) => s[k] === NO).length;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (yes === 3 && no === 1) return false;
        if (open.length !== 1) continue;
        if (yes === 3) { s[open[0]] = YES; if (log) log.push({ cells: open, v: YES, reason: 'Shaded areas are squares. Three shaded cells in a 2×2 block need the fourth.' }); return 1; }
        if (yes === 2 && no === 1) { s[open[0]] = NO; if (log) log.push({ cells: open, v: NO, reason: 'Shaded areas are squares. This cell would make an L shape.' }); return 1; }
      }
      return 0;
    }
    function areas(s, ok) {
      const id = new Int32Array(N).fill(-1);
      const list = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || !ok(k)) continue;
        const cells = [k];
        id[k] = list.length;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (id[j] < 0 && ok(j)) { id[j] = list.length; cells.push(j); }
        list.push(cells);
      }
      return { id, list };
    }
    function check(s, done) {
      if (!Binary.canConnect(R, C, s, NO)) return false;
      const black = areas(s, (k) => s[k] === YES);
      // A shaded area that can not grow any more must be a square.
      const sizeOf = black.list.map((cells) => {
        const rows = cells.map((k) => Math.floor(k / C)), cols = cells.map((k) => k % C);
        const h = Math.max(...rows) - Math.min(...rows) + 1, w = Math.max(...cols) - Math.min(...cols) + 1;
        const closed = cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        if ((closed || done) && h !== w) return -1;
        return cells.length;
      });
      if (sizeOf.includes(-1)) return false;
      // Number bounds: shaded squares next to the clue (low) and what
      // could still join (high, through shaded and open cells).
      const reach = areas(s, (k) => s[k] !== NO && clues[k] === -1);
      for (let k = 0; k < N; k++) {
        const v = clues[k];
        if (v < 0) continue;
        const near = new Set(nb(k).filter((j) => s[j] === YES).map((j) => black.id[j]));
        let low = 0;
        for (const a of near) low += black.list[a].length;
        const nearR = new Set(nb(k).filter((j) => reach.id[j] >= 0).map((j) => reach.id[j]));
        let high = 0;
        for (const a of nearR) high += reach.list[a].length;
        if (low > v || high < v) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  // Answer: random non-touching squares, white cells connected.
  function makeSquares(n) {
    const N = n * n;
    const shade = new Uint8Array(N);
    const near = (k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && shade[a * n + b]);
    };
    for (let t = 0; t < n * 4; t++) {
      const size = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3;
      const r = Math.floor(Math.random() * (n - size + 1)), c = Math.floor(Math.random() * (n - size + 1));
      const cells = [];
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) cells.push((r + i) * n + c + j);
      if (cells.some((k) => shade[k] || near(k))) continue;
      cells.forEach((k) => { shade[k] = 1; });
      if (!Binary.openConnected(n, n, Uint8Array.from(shade, (x) => (x ? YES : NO)))) cells.forEach((k) => { shade[k] = 0; });
    }
    return shade;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const shade = makeSquares(n);
      const sol = Uint8Array.from(shade, (x) => (x ? YES : NO));
      const p = { R: n, C: n, clues: new Int8Array(N).fill(-1) };
      const black = new Int32Array(N).fill(-1);
      // Square sizes by cell, for clue values.
      const seen = new Uint8Array(N);
      const sizeAt = new Int32Array(N);
      for (let k = 0; k < N; k++) {
        if (!shade[k] || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i], r = Math.floor(x / n), c = x % n;
          for (const j of [r > 0 ? x - n : -1, r < n - 1 ? x + n : -1, c > 0 ? x - 1 : -1, c < n - 1 ? x + 1 : -1]) {
            if (j >= 0 && shade[j] && !seen[j]) { seen[j] = 1; cells.push(j); }
          }
        }
        cells.forEach((x) => { black[x] = k; sizeAt[x] = cells.length; });
      }
      for (let k = 0; k < N; k++) {
        if (shade[k] || Math.random() < 0.5) continue;
        const r = Math.floor(k / n), c = k % n;
        const ids = new Set([r > 0 ? k - n : -1, r < n - 1 ? k + n : -1, c > 0 ? k - 1 : -1, c < n - 1 ? k + 1 : -1]
          .filter((j) => j >= 0 && shade[j]).map((j) => black[j]));
        let v = 0;
        for (const id of ids) v += sizeAt[id];
        p.clues[k] = v > 0 && Math.random() < 0.2 ? Q : v;
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
    id: 'tasukuea',
    name: 'Tasukuea',
    rules: 'Shade some cells so that every shaded area is a square (1×1, 2×2, ...). Squares never touch by a side. ' +
      'Clue cells stay white. A number counts all shaded cells in the squares next to it (by a side). ' +
      'A "?" needs at least one square next to it. All white cells are connected.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 7 },
    solvedText: 'All squares found — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v === -1 ? '..' : v === Q ? '??' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid clues');
      const clues = Int8Array.from({ length: R * C }, (_, k) => {
        const t = d.g.slice(2 * k, 2 * k + 2);
        return t === '..' ? -1 : t === '??' ? Q : parseInt(t, 36);
      });
      return { R, C, clues };
    },
    model,
    fixed: (p, k) => (p.clues[k] !== -1 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] !== -1) el.textContent = p.clues[k] === Q ? '?' : p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'tq-board',
  });
})();
