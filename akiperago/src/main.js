// Akiperago (Archipelago). Shade some cells into islands; islands never
// touch by a side. Islands that touch at corners form an archipelago of
// two or more islands. An archipelago of N islands has one island of each
// size 1 to N. Some shaded cells are given; a number in one tells the size
// of its island. Built on the shared Binary game page (YES = shaded).
// Clues: -1 none, 0 given shaded cell, v > 0 shaded with island size v.

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
    const diag = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) if (a >= 0 && b >= 0 && a < R && b < C) out.push(a * C + b);
      return out;
    };
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k] >= 0) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Clue cells are shaded.' });
    const blocks = (s) => {
      const id = new Int32Array(N).fill(-1), list = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || s[k] !== YES) continue;
        const cells = [k];
        id[k] = list.length;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (id[j] < 0 && s[j] === YES) { id[j] = list.length; cells.push(j); }
        list.push(cells);
      }
      return { id, list };
    };
    function propagate(s, log) {
      const { id, list } = blocks(s);
      for (let k = 0; k < N; k++) {
        if (s[k] !== UNKNOWN) continue;
        // Shading this cell must not join islands with different numbers
        // or grow a numbered island past its size.
        const near = [...new Set(nb(k).filter((j) => s[j] === YES).map((j) => id[j]))];
        const nums = [...new Set(near.flatMap((b) => list[b].filter((x) => clues[x] > 0).map((x) => clues[x])))];
        const size = near.reduce((t, b) => t + list[b].length, 0) + 1;
        let why = '';
        if (nums.length > 1) why = 'This cell would join islands with different numbers.';
        else if (nums.length === 1 && size > nums[0]) why = `The island with ${nums[0]} would grow too big.`;
        if (!why) continue;
        s[k] = NO;
        if (log) log.push({ cells: [k], v: NO, reason: why });
        return 1;
      }
      return 0;
    }
    function check(s, done) {
      const { id, list } = blocks(s);
      for (const cells of list) {
        const nums = [...new Set(cells.filter((x) => clues[x] > 0).map((x) => clues[x]))];
        if (nums.length > 1) return false;
        const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        if (nums.length && (cells.length > nums[0] || (closed && cells.length !== nums[0]))) return false;
      }
      if (!done) return true;
      // Archipelagos: islands joined at corners; sizes 1..N, each once.
      const seen = new Uint8Array(list.length);
      for (let a = 0; a < list.length; a++) {
        if (seen[a]) continue;
        const group = [a];
        seen[a] = 1;
        for (let i = 0; i < group.length; i++) {
          for (const k of list[group[i]]) for (const j of diag(k)) {
            if (s[j] === YES && !seen[id[j]]) { seen[id[j]] = 1; group.push(id[j]); }
          }
        }
        if (group.length < 2) return false;
        const sizes = group.map((g) => list[g].length).sort((x, y) => x - y);
        if (sizes.some((v, i) => v !== i + 1)) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  // Answer: archipelagos built one at a time. Each has 2–4 islands of
  // sizes 1..N, joined at corners. Islands never touch by a side, and
  // different archipelagos do not touch at all.
  function makeAnswer(n) {
    const N = n * n;
    const id = new Int32Array(N).fill(-1), groupOf = new Int32Array(N).fill(-1);
    const islands = [];
    const around = (k, diagToo) => {
      const r = Math.floor(k / n), c = k % n, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if ((!dr && !dc) || (!diagToo && dr && dc)) continue;
        const a = r + dr, b = c + dc;
        if (a >= 0 && b >= 0 && a < n && b < n) out.push(a * n + b);
      }
      return out;
    };
    const canUse = (k, b, g) => id[k] < 0 &&
      around(k, false).every((j) => id[j] < 0 || id[j] === b) &&
      around(k, true).every((j) => groupOf[j] < 0 || groupOf[j] === g);
    const grow = (seed, g, want) => {
      const b = islands.length, cells = [seed];
      id[seed] = b; groupOf[seed] = g;
      for (let t = 0; t < 30 && cells.length < want; t++) {
        const x = cells[Math.floor(Math.random() * cells.length)];
        const opts = around(x, false).filter((j) => canUse(j, b, g));
        if (!opts.length) continue;
        const j = opts[Math.floor(Math.random() * opts.length)];
        id[j] = b; groupOf[j] = g;
        cells.push(j);
      }
      if (cells.length !== want) { cells.forEach((k) => { id[k] = -1; groupOf[k] = -1; }); return false; }
      islands.push(cells);
      return true;
    };
    for (let g = 0, fails = 0; fails < 30; g++) {
      const starts = [...new Array(N).keys()].filter((k) => id[k] < 0 && around(k, true).every((j) => id[j] < 0));
      if (!starts.length) break;
      const size = 2 + Math.floor(Math.random() * 3);
      const order = PuzzleShell.shuffle(Array.from({ length: size }, (_, i) => i + 1));
      const first = islands.length;
      let ok = grow(starts[Math.floor(Math.random() * starts.length)], g, order[0]);
      for (let i = 1; ok && i < size; i++) {
        let placed = false;
        for (let t = 0; t < 20 && !placed; t++) {
          const mine = [];
          for (let x = first; x < islands.length; x++) mine.push(...islands[x]);
          const seeds = [...new Set(mine.flatMap((k) => around(k, true)))].filter((k) => canUse(k, islands.length, g));
          if (!seeds.length) break;
          placed = grow(seeds[Math.floor(Math.random() * seeds.length)], g, order[i]);
        }
        ok = placed;
      }
      if (!ok) {
        for (const cells of islands.splice(first)) cells.forEach((k) => { id[k] = -1; groupOf[k] = -1; });
        fails++; g--;
      }
    }
    return { id, blocks: islands };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const { id, blocks } = makeAnswer(n);
      const sol = Uint8Array.from(id, (b) => (b >= 0 ? YES : NO));
      // Every island starts with a numbered cell; then drop numbers and
      // given cells while it stays unique.
      const clues = new Int8Array(N).fill(-1);
      for (const cells of blocks) clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      const p = { R: n, C: n, clues };
      if (!model(p).check(sol, true)) continue;
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (clues[k] < 0) continue;
        const keep = clues[k];
        clues[k] = keep > 0 ? 0 : -1;
        if (!unique()) { clues[k] = keep; continue; }
        if (clues[k] === 0) { clues[k] = -1; if (!unique()) clues[k] = 0; }
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'akiperago',
    name: 'Akiperago',
    rules: 'Shade cells to form islands; islands never touch by a side. Islands that touch at corners form an ' +
      'archipelago, and every archipelago has at least two islands. An archipelago of N islands has exactly one island ' +
      'of each size from 1 to N. Dark cells are given; a number tells the size of its island.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'Islands all charted — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v === 0 ? '?' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : ch === '?' ? 0 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? YES : 0),
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ak-board',
  });
})();
