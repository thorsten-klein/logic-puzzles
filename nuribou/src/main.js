// Nuribou. Shade some cells. Shaded cells form straight stripes one cell
// wide; stripes never touch by a side, and stripes that touch at a corner
// have different lengths. The white cells form areas; each area holds
// exactly one number, its size. Built on the shared Binary game page.

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
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 2, why: () => 'Stripes are straight and never touch by a side.' });
    }
    for (let k = 0; k < N; k++) if (clues[k] > 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
    const comps = (s, ok) => {
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
    function check(s, done) {
      // Stripes: straight, and closed stripes touching at corners differ.
      const black = comps(s, (k) => s[k] === YES);
      const len = black.list.map((cells) => {
        const rows = new Set(cells.map((k) => Math.floor(k / C))), cols = new Set(cells.map((k) => k % C));
        if (rows.size > 1 && cols.size > 1) return -2;
        const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        return closed ? cells.length : 0;
      });
      if (len.includes(-2)) return false;
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        const r = Math.floor(k / C), c = k % C;
        for (const [a, b] of [[r + 1, c - 1], [r + 1, c + 1]]) {
          if (a >= R || b < 0 || b >= C || s[a * C + b] !== YES) continue;
          const x = black.id[k], y = black.id[a * C + b];
          if (x !== y && len[x] && len[x] === len[y]) return false;
        }
      }
      // White areas: one number each, of the right size.
      const white = comps(s, (k) => s[k] === NO);
      const reach = comps(s, (k) => s[k] !== YES);
      for (const cells of white.list) {
        const nums = cells.filter((k) => clues[k] > 0);
        if (nums.length > 1) return false;
        const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        if (closed && (nums.length !== 1 || cells.length !== clues[nums[0]])) return false;
        if (nums.length === 1) {
          const v = clues[nums[0]];
          if (cells.length > v) return false;
          if (reach.list[reach.id[cells[0]]].length < v) return false;
        }
      }
      return true;
    }
    return { N, cons, check };
  }

  // Answer: straight stripes (1–4 long) that never touch by a side and
  // differ in length where they touch at corners.
  function makeAnswer(n) {
    const N = n * n;
    const id = new Int32Array(N).fill(-1);
    const lens = [];
    const at = (r, c) => (r >= 0 && c >= 0 && r < n && c < n ? id[r * n + c] : -1);
    for (let t = 0; t < N * 3; t++) {
      const L = 1 + Math.floor(Math.random() * 4), horiz = Math.random() < 0.5;
      const r0 = Math.floor(Math.random() * (horiz ? n : n - L + 1)), c0 = Math.floor(Math.random() * (horiz ? n - L + 1 : n));
      const cells = Array.from({ length: L }, (_, i) => (horiz ? [r0, c0 + i] : [r0 + i, c0]));
      if (cells.some(([r, c]) => at(r, c) >= 0)) continue;
      const me = new Set(cells.map(([r, c]) => r * n + c));
      let ok = true;
      for (const [r, c] of cells) {
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (!me.has(a * n + b) && at(a, b) >= 0) ok = false;
        for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) if (at(a, b) >= 0 && lens[at(a, b)] === L) ok = false;
      }
      if (!ok) continue;
      cells.forEach(([r, c]) => { id[r * n + c] = lens.length; });
      lens.push(L);
    }
    return Uint8Array.from(id, (x) => (x >= 0 ? YES : NO));
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const sol = makeAnswer(n);
      // One number per white area: its size, in a random cell.
      const clues = new Int8Array(N);
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (sol[k] !== NO || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i], r = Math.floor(x / n), c = x % n;
          for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            const j = a * n + b;
            if (a >= 0 && b >= 0 && a < n && b < n && !seen[j] && sol[j] === NO) { seen[j] = 1; cells.push(j); }
          }
        }
        if (cells.length > 35) { clues[0] = -1; break; }
        clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      }
      if (clues[0] < 0) continue;
      const p = { R: n, C: n, clues };
      const t = Binary.logicSolve(model(p));
      let ok = t && !t.includes(UNKNOWN);
      if (!ok && t) { const r = Binary.solve(model(p), 2, 3000, t); ok = r.solutions.length === 1 && !r.capped; }
      if (!ok) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nuribou',
    name: 'Nuribou',
    rules: 'Shade some cells. Shaded cells form straight stripes, one cell wide. Stripes never touch each other by a side, ' +
      'and stripes that touch at a corner have different lengths. The white cells form areas; each area holds exactly ' +
      'one number, which tells its size.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'Stripes all in line — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v > 0 ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] > 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nb-board',
  });
})();
