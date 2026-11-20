// Chenburo (Chain Block). Shade some cells into blocks. Blocks never
// touch by a side. Each block holds exactly one clue cell: a number (the
// block's size) or "?" (any size). Blocks touching at corners form
// chains; every chain has two or more blocks, and the blocks of one chain
// all differ in shape (turned or mirrored shapes count as equal).
// Built on the shared Binary game page (YES = shaded).
// Clues: -1 none, 0 "?", v > 0 size.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Canonical shape key (smallest over turns and mirrors).
  function shapeKey(cells, C) {
    const pts = cells.map((k) => [Math.floor(k / C), k % C]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let [a, b] = t & 4 ? [c, r] : [r, c];
        if (t & 1) a = -a;
        if (t & 2) b = -b;
        return [a, b];
      });
      const ma = Math.min(...q.map((x) => x[0])), mb = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - ma},${b - mb}`).sort().join(' '));
    }
    return keys.sort()[0];
  }

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
        // Joining two blocks that both hold a clue is not allowed.
        const near = [...new Set(nb(k).filter((j) => s[j] === YES).map((j) => id[j]))];
        const clued = near.filter((b) => list[b].some((x) => clues[x] >= 0));
        let why = '';
        if (clued.length > 1) why = 'This cell would join two blocks that each have a clue.';
        else if (clued.length === 1) {
          const cl = list[clued[0]].find((x) => clues[x] >= 0);
          const size = near.reduce((t, b) => t + list[b].length, 0) + 1;
          if (clues[cl] > 0 && size > clues[cl]) why = `The block with ${clues[cl]} would grow too big.`;
        }
        if (!why) continue;
        s[k] = NO;
        if (log) log.push({ cells: [k], v: NO, reason: why });
        return 1;
      }
      return 0;
    }
    function check(s, done) {
      const { id, list } = blocks(s);
      const info = list.map((cells) => {
        const cl = cells.filter((x) => clues[x] >= 0);
        const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        return { cells, cl, closed };
      });
      for (const b of info) {
        if (b.cl.length > 1) return false;
        if (b.closed && b.cl.length !== 1) return false;
        if (b.cl.length === 1) {
          const v = clues[b.cl[0]];
          if (v > 0 && (b.cells.length > v || (b.closed && b.cells.length !== v))) return false;
        }
      }
      if (!done) return true;
      // Chains: blocks joined at corners; two or more, all shapes different.
      const seen = new Uint8Array(list.length);
      for (let a = 0; a < list.length; a++) {
        if (seen[a]) continue;
        const chain = [a];
        seen[a] = 1;
        for (let i = 0; i < chain.length; i++) {
          for (const k of list[chain[i]]) for (const j of diag(k)) {
            if (s[j] === YES && !seen[id[j]]) { seen[id[j]] = 1; chain.push(id[j]); }
          }
        }
        if (chain.length < 2) return false;
        const keys = chain.map((b) => shapeKey(list[b], C));
        if (new Set(keys).size !== keys.length) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  // Answer: chains built one at a time. Each chain gets 2–4 blocks of
  // 1–5 cells with different shapes, joined at corners. Blocks never touch
  // by a side, and different chains do not touch at all.
  function makeAnswer(n) {
    const N = n * n;
    const id = new Int32Array(N).fill(-1), chainOf = new Int32Array(N).fill(-1);
    const blocks = [];
    const around = (k, diagToo) => {
      const r = Math.floor(k / n), c = k % n, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if ((!dr && !dc) || (!diagToo && dr && dc)) continue;
        const a = r + dr, b = c + dc;
        if (a >= 0 && b >= 0 && a < n && b < n) out.push(a * n + b);
      }
      return out;
    };
    const canUse = (k, b, ch) => id[k] < 0 &&
      around(k, false).every((j) => id[j] < 0 || id[j] === b) &&
      around(k, true).every((j) => chainOf[j] < 0 || chainOf[j] === ch);
    const tryBlock = (seed, ch, used) => {
      const b = blocks.length, cells = [seed];
      id[seed] = b; chainOf[seed] = ch;
      const want = 1 + Math.floor(Math.random() * 5);
      for (let g = 0; g < 30 && cells.length < want; g++) {
        const x = cells[Math.floor(Math.random() * cells.length)];
        const opts = around(x, false).filter((j) => canUse(j, b, ch));
        if (!opts.length) continue;
        const j = opts[Math.floor(Math.random() * opts.length)];
        id[j] = b; chainOf[j] = ch;
        cells.push(j);
      }
      const key = shapeKey(cells, n);
      if (used.has(key)) { cells.forEach((k) => { id[k] = -1; chainOf[k] = -1; }); return false; }
      used.add(key);
      blocks.push(cells);
      return true;
    };
    for (let ch = 0, fails = 0; fails < 30; ch++) {
      const starts = [...Array(N).keys()].filter((k) => id[k] < 0 && around(k, true).every((j) => id[j] < 0));
      if (!starts.length) break;
      const used = new Set();
      const first = blocks.length;
      if (!tryBlock(starts[Math.floor(Math.random() * starts.length)], ch, used)) { fails++; ch--; continue; }
      const goal = 2 + Math.floor(Math.random() * 3);
      for (let t = 0; t < 40 && blocks.length - first < goal; t++) {
        const mine = [];
        for (let i = first; i < blocks.length; i++) mine.push(...blocks[i]);
        const seeds = [...new Set(mine.flatMap((k) => around(k, true)))].filter((k) => canUse(k, blocks.length, ch));
        if (!seeds.length) break;
        tryBlock(seeds[Math.floor(Math.random() * seeds.length)], ch, used);
      }
      if (blocks.length - first < 2) {
        for (const cells of blocks.splice(first)) cells.forEach((k) => { id[k] = -1; chainOf[k] = -1; });
        fails++; ch--;
      }
    }
    return { id, blocks };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const { id, blocks } = makeAnswer(n);
      const sol = Uint8Array.from(id, (b) => (b >= 0 ? YES : NO));
      const clues = new Int8Array(N).fill(-1);
      for (const cells of blocks) clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      const p = { R: n, C: n, clues };
      if (!model(p).check(sol, true)) continue;
      // Unique: by logic alone, else proven by the full solver.
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 4000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      // Turn numbers into "?" while it stays unique.
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (clues[k] <= 0) continue;
        const keep = clues[k];
        clues[k] = 0;
        if (!unique()) clues[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'chenburo',
    name: 'Chenburo',
    rules: 'Shade cells to form blocks that never touch by a side. Each block holds exactly one clue: a number tells the ' +
      'block\'s size, a "?" allows any size. Blocks that touch at corners form chains. Every chain has at least two blocks, ' +
      'and the blocks in one chain all have different shapes (turned or mirrored shapes count as the same).',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'Every chain unbroken — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v === 0 ? '?' : v.toString(36))).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : ch === '?' ? 0 : parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? YES : 0),
    draw(p, k, el) { if (p.clues[k] >= 0) el.textContent = p.clues[k] || '?'; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cb2-board',
  });
})();
