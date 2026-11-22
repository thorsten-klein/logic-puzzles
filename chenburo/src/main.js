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
    return keys.find((k) => keys.every((o) => k <= o));
  }

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const nb = (k) => Binary.sideNeighbours(R, C, k);
    // True when no cell next to k is still open.
    const settled = (k, s) => nb(k).every((j) => s[j] !== UNKNOWN);
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k] >= 0) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Clue cells are shaded.' });
    const blocks = (s) => Binary.areas(R, C, s);
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
    // A block has one clue (exactly one once closed), and fits its number.
    function blockOk(s, cells, done) {
      const cl = cells.filter((x) => clues[x] >= 0);
      const closed = done || cells.every((k) => settled(k, s));
      if (cl.length > 1 || (closed && cl.length !== 1)) return false;
      const v = cl.length ? clues[cl[0]] : 0;
      return !(v > 0 && (cells.length > v || (closed && cells.length !== v)));
    }
    function check(s, done) {
      const all = blocks(s);
      if (!all.list.every((cells) => blockOk(s, cells, done))) return false;
      if (!done) return true;
      // Chains: blocks joined at corners; two or more, all shapes different.
      return Binary.cornerGroups(R, C, s, all).every((chain) => {
        const keys = chain.map((b) => shapeKey(all.list[b], C));
        return chain.length >= 2 && new Set(keys).size === keys.length;
      });
    }
    return { N, cons, propagate, check };
  }

  // Answer: chains built one at a time. Each chain gets 2–4 blocks of
  // 1–5 cells with different shapes, joined at corners. Blocks never touch
  // by a side, and different chains do not touch at all.
  function makeAnswer(n) {
    const b = Binary.cornerBuilder(n);
    // A block of 1-5 cells from seed with a shape new in its chain.
    const tryBlock = (seed, ch, used) => {
      const cells = b.grow(seed, ch, 1 + Math.floor(Math.random() * 5));
      const key = shapeKey(cells, n);
      if (used.has(key)) { b.remove(cells); return false; }
      used.add(key);
      b.keep(cells);
      return true;
    };
    // Chain ch of 2-4 blocks from a start cell; undone if too short.
    const addChain = (ch, start) => {
      const used = new Set();
      const first = b.blocks.length;
      if (!tryBlock(start, ch, used)) return false;
      const goal = 2 + Math.floor(Math.random() * 3);
      for (let t = 0; t < 40 && b.blocks.length - first < goal; t++) {
        const seeds = b.seeds(first, ch);
        if (!seeds.length) break;
        tryBlock(b.pick(seeds), ch, used);
      }
      if (b.blocks.length - first >= 2) return true;
      b.undo(first);
      return false;
    };
    let fails = 0;
    for (let ch = 0; fails < 30;) {
      const starts = b.starts();
      if (!starts.length) break;
      if (addChain(ch, b.pick(starts))) ch++;
      else fails++;
    }
    return { id: b.id, blocks: b.blocks };
  }

  // Turns numbers into "?" while it stays unique.
  function hideNumbers(clues, unique, until) {
    for (const k of PuzzleShell.shuffle([...clues.keys()])) {
      if (clues[k] <= 0) continue;
      const keep = clues[k];
      clues[k] = 0;
      if (!unique()) clues[k] = keep;
      if (Date.now() > until) return;
    }
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
      const unique = () => Binary.isUnique(model(p), 4000);
      if (!unique()) continue;
      hideNumbers(clues, unique, deadline + 3000);
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
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => {
      if (v < 0) return '.';
      if (v === 0) return '?';
      return v.toString(36);
    }).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => {
        if (ch === '.') return -1;
        if (ch === '?') return 0;
        return Number.parseInt(ch, 36);
      }) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? YES : 0),
    draw(p, k, el) { if (p.clues[k] >= 0) el.textContent = p.clues[k] || '?'; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cb2-board',
  });
})();
