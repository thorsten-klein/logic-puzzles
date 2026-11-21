// Nurimisaki. Shade some cells. Circles are white dead ends: exactly one
// white neighbour. Every other white cell has two or more white
// neighbours. A number in a circle counts the white cells seen in a
// straight line from it, itself included. White cells connect. No 2×2
// block is all shaded or all white.
// Built on the shared Binary game page (YES = shaded).
// Clues: -1 = none, 0 = circle, v > 0 = circle with number v.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Cells next to cell k (by a side).
  function neighbours(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [dr, dc] of DIRS) if (r + dr >= 0 && r + dr < R && c + dc >= 0 && c + dc < C) out.push(k + dr * C + dc);
    return out;
  }

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const nb = (k) => neighbours(R, C, k);
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 1, max: 3,
        why: (v) => (v === YES ? 'No 2×2 block is all white.' : 'No 2×2 block is all shaded.') });
    }
    for (let k = 0; k < N; k++) {
      if (clues[k] < 0) continue;
      const n = nb(k);
      cons.push({ cells: n, min: n.length - 1, max: n.length - 1, at: k,
        why: (v) => (v === YES ? 'A circle has exactly one white neighbour.' : 'A circle needs one white neighbour, and only this one is left.') });
    }
    // Possible directions for a numbered circle: v - 1 white cells, then
    // a shaded cell or the edge.
    const ways = (s, k) => {
      const v = clues[k], r = Math.floor(k / C), c = k % C, out = [];
      for (const [dr, dc] of DIRS) {
        const line = [];
        for (let i = 1; i <= v; i++) {
          const a = r + dr * i, b = c + dc * i;
          line.push(a >= 0 && b >= 0 && a < R && b < C ? a * C + b : -1);
        }
        const white = line.slice(0, v - 1), end = line[v - 1];
        if (white.some((j) => j < 0 || s[j] === YES)) continue;
        if (end >= 0 && s[end] === NO) continue;
        out.push({ white, end });
      }
      return out;
    };
    function propagate(s, log) {
      let set = 0;
      for (let k = 0; k < N; k++) {
        // Plain white cells are no dead ends.
        if (clues[k] >= 0) continue;
        const n = nb(k);
        const maybe = n.filter((j) => s[j] !== YES);
        if (s[k] === UNKNOWN && maybe.length < 2) {
          s[k] = YES; set++;
          if (log) { log.push({ cells: [k], v: YES, reason: 'A white cell without a circle needs two white neighbours. This one can not get them.' }); return set; }
        }
        if (s[k] === NO) {
          if (maybe.length < 2) return false;
          const open = maybe.filter((j) => s[j] === UNKNOWN);
          if (maybe.length === 2 && open.length) {
            open.forEach((j) => { s[j] = NO; });
            set += open.length;
            if (log) { log.push({ cells: open, v: NO, reason: 'A white cell without a circle needs two white neighbours, and only these are left.' }); return set; }
          }
        }
      }
      for (let k = 0; k < N; k++) {
        if (clues[k] <= 0) continue;
        const w = ways(s, k);
        if (!w.length) return false;
        if (w.length > 1) continue;
        const open = w[0].white.filter((j) => s[j] === UNKNOWN);
        const end = w[0].end >= 0 && s[w[0].end] === UNKNOWN ? [w[0].end] : [];
        if (!open.length && !end.length) continue;
        open.forEach((j) => { s[j] = NO; });
        end.forEach((j) => { s[j] = YES; });
        set += open.length + end.length;
        if (log) {
          if (open.length) log.push({ cells: open, v: NO, reason: `The ${clues[k]} can only see its white cells in one direction.` });
          else log.push({ cells: end, v: YES, reason: `The ${clues[k]} sees exactly ${clues[k]} white cells, so its line stops here.` });
          return set;
        }
      }
      return set;
    }
    function check(s) {
      if (!Binary.canConnect(R, C, s, NO)) return false;
      for (let k = 0; k < N; k++) if (clues[k] > 0 && !ways(s, k).length) return false;
      return true;
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      // A random shading with the 2×2 rules and connected white cells.
      const base = { R, C, clues: new Int8Array(N).fill(-1) };
      const free = model(base);
      const fill = Binary.randomFill({ N, cons: free.cons, check: (s) => Binary.canConnect(R, C, s, NO) }, 0.5, 10);
      if (!fill) continue;
      const nb = (k) => neighbours(R, C, k);
      const whiteNb = (k) => nb(k).filter((j) => fill[j] === NO).length;
      if ([...fill.keys()].some((k) => fill[k] === NO && whiteNb(k) === 0)) continue;
      // Circles on every dead end, with the number seen.
      const clues = new Int8Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (fill[k] !== NO || whiteNb(k) !== 1) continue;
        const r = Math.floor(k / C), c = k % C;
        const j = nb(k).find((x) => fill[x] === NO);
        const dr = Math.floor(j / C) - r, dc = (j % C) - c;
        let len = 1;
        while (true) {
          const a = r + dr * len, b = c + dc * len;
          if (a < 0 || b < 0 || a >= R || b >= C || fill[a * C + b] !== NO) break;
          len++;
        }
        clues[k] = len;
      }
      if ([...clues].filter((v) => v >= 0).length < 2) continue;
      const p = { R, C, clues };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      // Drop numbers (keep the circles) while logic still solves it.
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (clues[k] <= 0) continue;
        const keep = clues[k];
        clues[k] = 0;
        const t = Binary.logicSolve(model(p));
        if (!t || t.includes(UNKNOWN)) clues[k] = keep;
      }
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nurimisaki',
    name: 'Nurimisaki',
    rules: 'Shade some cells. Circles stay white and are dead ends: each has exactly one white neighbour. ' +
      'Every other white cell has at least two white neighbours. A number in a circle counts the white cells seen in a ' +
      'straight line from it, itself included. All white cells connect. No 2×2 block is all shaded or all white.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Every cape in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? NO : 0),
    draw(p, k, el) {
      if (p.clues[k] < 0) return;
      const o = document.createElement('span');
      o.className = 'nm-circle';
      o.textContent = p.clues[k] || '';
      el.append(o);
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nm-board',
  });
})();
