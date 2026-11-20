// Choco Banana. Shade some cells. Every shaded area is a rectangle (or
// square); no white area is a rectangle. A number tells the size of the
// area (shaded or white) it sits in.
// Built on the shared Binary game page (YES = shaded). Clue -1 = none.

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
    function propagate(s, log) {
      // Next-door cells with different numbers lie in different areas,
      // so they have different colours.
      for (let k = 0; k < N; k++) {
        if (clues[k] < 0 || s[k] === UNKNOWN) continue;
        for (const j of nb(k)) {
          if (clues[j] < 0 || clues[j] === clues[k]) continue;
          if (s[j] === s[k]) return false;
          if (s[j] !== UNKNOWN) continue;
          s[j] = s[k] === YES ? NO : YES;
          if (log) log.push({ cells: [j], v: s[j], reason: `Next-door numbers ${clues[k]} and ${clues[j]} differ, so these cells are in different areas and have different colours.` });
          return 1;
        }
      }
      // Three shaded cells of a 2×2 block need the fourth (rectangles).
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const cells = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
        const yes = cells.filter((k) => s[k] === YES).length;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (yes === 3 && open.length === 1) {
          s[open[0]] = YES;
          if (log) log.push({ cells: open, v: YES, reason: 'Shaded areas are rectangles. Three shaded cells in a 2×2 block need the fourth.' });
          return 1;
        }
      }
      return 0;
    }
    const areas = (s, ok) => {
      const id = new Int32Array(N).fill(-1), list = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || !ok(k)) continue;
        const cells = [k];
        id[k] = list.length;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (id[j] < 0 && ok(j)) { id[j] = list.length; cells.push(j); }
        list.push(cells);
      }
      return { id, list };
    };
    const box = (cells) => {
      const rows = cells.map((k) => Math.floor(k / C)), cols = cells.map((k) => k % C);
      return [Math.min(...rows), Math.min(...cols), Math.max(...rows), Math.max(...cols)];
    };
    function check(s, done) {
      for (const v of [YES, NO]) {
        const a = areas(s, (k) => s[k] === v);
        const reach = areas(s, (k) => s[k] !== (v === YES ? NO : YES));
        for (const cells of a.list) {
          const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
          const [r1, c1, r2, c2] = box(cells);
          const rect = cells.length === (r2 - r1 + 1) * (c2 - c1 + 1);
          if (v === YES) {
            // A shaded area must fill its bounding box.
            for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (s[r * C + c] === NO) return false;
            if (closed && !rect) return false;
          } else if (closed && rect) return false;
          // Number bounds inside this area.
          const high = reach.list[reach.id[cells[0]]].length;
          for (const k of cells) {
            const n = clues[k];
            if (n < 0) continue;
            if (cells.length > n || high < n || (closed && cells.length !== n)) return false;
          }
        }
      }
      return true;
    }
    return { N, cons: [], propagate, check };
  }

  // Answer: random shaded rectangles that never touch by a side; every
  // white area must not be a rectangle.
  function makeAnswer(n) {
    const N = n * n;
    const shade = new Uint8Array(N);
    const near = (k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && shade[a * n + b]);
    };
    for (let t = 0; t < n * 5; t++) {
      const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
      const r = Math.floor(Math.random() * (n - h + 1)), c = Math.floor(Math.random() * (n - w + 1));
      const cells = [];
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) cells.push((r + i) * n + c + j);
      if (cells.some((k) => shade[k] || near(k))) continue;
      cells.forEach((k) => { shade[k] = 1; });
    }
    return shade;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const shade = makeAnswer(n);
      const sol = Uint8Array.from(shade, (x) => (x ? YES : NO));
      const probe = { R: n, C: n, clues: new Int8Array(N).fill(-1) };
      if (!model(probe).check(sol, true)) continue;
      // Area size at each cell.
      const size = new Int8Array(N);
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i], r = Math.floor(x / n), c = x % n;
          for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            const j = a * n + b;
            if (a >= 0 && b >= 0 && a < n && b < n && !seen[j] && shade[j] === shade[x]) { seen[j] = 1; cells.push(j); }
          }
        }
        for (const x of cells) size[x] = Math.min(cells.length, 35);
      }
      const p = { R: n, C: n, clues: Int8Array.from(size) };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'choco-banana',
    name: 'Choco Banana',
    rules: 'Shade some cells. Every shaded area is a rectangle (or square). No white area is a rectangle. ' +
      'A number tells how many cells the area it sits in has, shaded or white. An area may hold several numbers.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Choc and banana in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : parseInt(ch, 36))) };
    },
    model,
    draw(p, k, el) { if (p.clues[k] >= 0) el.append(String(p.clues[k])); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cb-board',
  });
})();
