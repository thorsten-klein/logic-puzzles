// Peintoeria (Paint Area). Shade whole rooms: all cells of a room have
// the same colour. A number tells how many of its four neighbours are
// shaded. All shaded cells connect, and no 2×2 block is all one colour.
// Built on the shared Binary game page (YES = shaded).
// p.room: room per cell; p.clues: -1 none, else count.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
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
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 1, max: 3,
        why: (v) => (v === YES ? 'No 2×2 block may be all white.' : 'No 2×2 block may be all shaded.') });
    }
    for (let k = 0; k < N; k++) {
      if (clues[k] < 0) continue;
      const v = clues[k];
      cons.push({ cells: nb(k), min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs more shaded neighbours.` : `This ${v} already has its shaded neighbours.`) });
    }
    function propagate(s, log) {
      // A room takes one colour.
      for (const cells of rooms) {
        const known = cells.find((k) => s[k] !== UNKNOWN);
        if (known === undefined) continue;
        const v = s[known];
        if (cells.some((k) => s[k] !== UNKNOWN && s[k] !== v)) return false;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (!open.length) continue;
        open.forEach((k) => { s[k] = v; });
        if (log) log.push({ cells: open, v, reason: 'All cells of a room have the same colour.' });
        return open.length;
      }
      return 0;
    }
    const check = (s) => Binary.canConnect(R, C, s, YES);
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 3));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const base = { R, C, room, clues: new Int8Array(N).fill(-1) };
      const fill = Binary.randomFill(model(base), 0.5, 10);
      if (!fill) continue;
      const p = { R, C, room, clues: new Int8Array(N) };
      for (let k = 0; k < N; k++) {
        const r = Math.floor(k / C), c = k % C;
        p.clues[k] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && fill[a * C + b] === YES).length;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'peintoeria',
    name: 'Peintoeria',
    rules: 'Shade whole rooms: all cells of an outlined room have the same colour. A number tells how many of its four ' +
      'neighbours are shaded. All shaded cells connect by their sides, and no 2×2 block is all one colour.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Freshly painted — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      if (typeof d.n !== 'string' || d.n.length !== R * C || !/^[.0-4]+$/.test(d.n)) throw new Error('Invalid clues');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R, C, room, clues: Int8Array.from(d.n, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (p.clues[k] >= 0) el.append(String(p.clues[k]));
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions pe-board',
  });
})();
