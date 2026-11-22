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
    const nb = (k) => Binary.sideNeighbours(R, C, k);
    const cons = [];
    for (let k = 0; k < N; k++) if (clues[k] >= 0) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Clue cells are shaded.' });
    const blocks = (s) => Binary.areas(R, C, s);
    // Numbers of the islands in a list of island ids.
    const numsOf = (ids, list) => [...new Set(ids.flatMap((b) => list[b].filter((x) => clues[x] > 0).map((x) => clues[x])))];
    // Why cell k can not be shaded, or ''.
    function shadeProblem(s, k, id, list) {
      const near = [...new Set(nb(k).filter((j) => s[j] === YES).map((j) => id[j]))];
      const nums = numsOf(near, list);
      const size = near.reduce((t, b) => t + list[b].length, 0) + 1;
      if (nums.length > 1) return 'This cell would join islands with different numbers.';
      if (nums.length === 1 && size > nums[0]) return `The island with ${nums[0]} would grow too big.`;
      return '';
    }
    function propagate(s, log) {
      const { id, list } = blocks(s);
      for (let k = 0; k < N; k++) {
        if (s[k] !== UNKNOWN) continue;
        // Shading this cell must not join islands with different numbers
        // or grow a numbered island past its size.
        const why = shadeProblem(s, k, id, list);
        if (!why) continue;
        s[k] = NO;
        if (log) log.push({ cells: [k], v: NO, reason: why });
        return 1;
      }
      return 0;
    }
    // An island fits its number: one number at most, not too big, and
    // the right size once closed.
    function islandOk(s, cells, b, list, done) {
      const nums = numsOf([b], list);
      if (nums.length > 1) return false;
      if (!nums.length) return true;
      const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
      return cells.length <= nums[0] && !(closed && cells.length !== nums[0]);
    }
    function check(s, done) {
      const all = blocks(s);
      const { list } = all;
      if (!list.every((cells, b) => islandOk(s, cells, b, list, done))) return false;
      if (!done) return true;
      // Archipelagos: at least two islands; sizes 1..N, each once.
      return Binary.cornerGroups(R, C, s, all).every((group) => {
        const sizes = group.map((g) => list[g].length).sort((x, y) => x - y);
        return group.length >= 2 && sizes.every((v, i) => v === i + 1);
      });
    }
    return { N, cons, propagate, check };
  }

  // Answer: archipelagos built one at a time. Each has 2–4 islands of
  // sizes 1..N, joined at corners. Islands never touch by a side, and
  // different archipelagos do not touch at all.
  function makeAnswer(n) {
    const b = Binary.cornerBuilder(n);
    // An island of exactly `want` cells from seed, or false.
    const island = (seed, g, want) => {
      const cells = b.grow(seed, g, want);
      if (cells.length !== want) { b.remove(cells); return false; }
      b.keep(cells);
      return true;
    };
    // One more island of size `want` at a corner of archipelago g
    // (its islands start at index `first`).
    const addIsland = (g, first, want) => {
      for (let t = 0; t < 20; t++) {
        const seeds = b.seeds(first, g);
        if (!seeds.length) return false;
        if (island(b.pick(seeds), g, want)) return true;
      }
      return false;
    };
    // Archipelago g of 2-4 islands from a start cell; undone if it fails.
    const addArchipelago = (g, start) => {
      const size = 2 + Math.floor(Math.random() * 3);
      const order = PuzzleShell.shuffle(Array.from({ length: size }, (_, i) => i + 1));
      const first = b.blocks.length;
      if (island(start, g, order[0]) && order.slice(1).every((want) => addIsland(g, first, want))) return true;
      b.undo(first);
      return false;
    };
    let fails = 0;
    for (let g = 0; fails < 30;) {
      const starts = b.starts();
      if (!starts.length) break;
      if (addArchipelago(g, b.pick(starts))) g++;
      else fails++;
    }
    return { id: b.id, blocks: b.blocks };
  }

  // Drops numbers (to a plain given cell), then given cells, while the
  // puzzle stays unique.
  function thin(clues, unique, until) {
    for (const k of PuzzleShell.shuffle([...clues.keys()])) {
      if (clues[k] < 0) continue;
      const keep = clues[k];
      clues[k] = keep > 0 ? 0 : -1;
      if (!unique()) { clues[k] = keep; continue; }
      if (clues[k] === 0) { clues[k] = -1; if (!unique()) clues[k] = 0; }
      if (Date.now() > until) break;
    }
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
      const unique = () => Binary.isUnique(model(p));
      if (!unique()) continue;
      thin(clues, unique, deadline + 3000);
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
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ak-board',
  });
})();
