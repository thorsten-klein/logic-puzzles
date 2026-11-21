// Nanro. Put numbers into some cells. In each room all numbers are the
// same: the count of numbered cells in that room (at least one). Numbers
// next to each other across a room border differ. Numbered cells never
// fill a 2×2 block, and they all connect. Some numbers are given.
// Built on the shared Binary game page: YES = a numbered cell. The page
// writes the room's count into every marked cell.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, given } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'Numbered cells never fill a 2×2 block.' });
    }
    rooms.forEach((cells) => {
      const g = cells.find((k) => given[k]);
      if (g !== undefined) {
        const v = given[g];
        cons.push({ cells, min: v, max: v, at: g, why: (x) => (x === YES ? `This room needs ${v} numbered cells.` : `This room already has its ${v} numbered cells.`) });
      } else cons.push({ cells, min: 1, max: cells.length, why: () => 'Every room needs at least one number.' });
    });
    for (let k = 0; k < N; k++) if (given[k]) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Given numbers stay.' });
    const pairs = [];
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (const j of [c < C - 1 ? k + 1 : -1, r < R - 1 ? k + C : -1]) if (j >= 0 && room[j] !== room[k]) pairs.push([k, j]);
    }
    // Known count of a room, or -1 while open (or the given number).
    const countOf = (s, g) => {
      const cells = rooms[g];
      const giv = cells.find((k) => given[k]);
      if (giv !== undefined) return given[giv];
      return cells.some((k) => s[k] === UNKNOWN) ? -1 : cells.filter((k) => s[k] === YES).length;
    };
    function propagate(s, log) {
      // A known count rules out the same count next door.
      for (const [a, b] of pairs) {
        for (const [x, y] of [[a, b], [b, a]]) {
          if (s[x] !== YES || s[y] !== UNKNOWN) continue;
          const cx = countOf(s, room[x]), cy = countOf(s, room[y]);
          if (cx < 0 || cx !== cy) continue;
          s[y] = NO;
          if (log) { log.push({ cells: [y], v: NO, reason: `Both rooms hold ${cx}s. Equal numbers may not touch across a room border.` }); }
          return 1;
        }
      }
      return 0;
    }
    function check(s) {
      for (const [a, b] of pairs) {
        if (s[a] !== YES || s[b] !== YES) continue;
        const ca = countOf(s, room[a]), cb = countOf(s, room[b]);
        if (ca >= 0 && ca === cb) return false;
      }
      return Binary.canConnect(R, C, s, YES);
    }
    return { N, cons, propagate, check, countOf };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4.5));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const p = { R, C, room, given: new Int8Array(N) };
      const fill = Binary.randomFill(model(p), 0.5, 10);
      if (!fill) continue;
      // Give the count in one numbered cell of each room, then thin.
      const m0 = model(p);
      const count = Math.max(...room) + 1;
      for (let g = 0; g < count; g++) {
        const cells = [...new Array(N).keys()].filter((k) => room[k] === g && fill[k] === YES);
        const k = cells[Math.floor(Math.random() * cells.length)];
        p.given[k] = m0.countOf(fill, g);
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.given, 0, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nanro',
    name: 'Nanro',
    rules: 'Mark some cells as numbered cells. In each room, all numbers are the count of numbered cells in that room, ' +
      'and every room has at least one. Numbers next to each other across a room border must differ. Numbered cells never ' +
      'fill a 2×2 block, and all of them connect by their sides. Some numbers are given.',
    controls: 'Click a cell to mark it as numbered, click again to mark it empty. Right click cycles the other way. ' +
      'Marked cells show how many cells of their room are marked.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'All numbers in order — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.given, (v) => v.toString(36)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      if (typeof d.n !== 'string' || d.n.length !== R * C) throw new Error('Invalid numbers');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R, C, room, given: Int8Array.from(d.n, (ch) => Number.parseInt(ch, 36) || 0) };
    },
    model,
    fixed: (p, k) => (p.given[k] ? YES : 0),
    yesClass: 'nr-num',
    draw(p, k, el, v, shown) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (p.given[k]) { el.textContent = p.given[k]; return; }
      if (v !== YES) return;
      // The count of marked cells in this room so far.
      let c = 0;
      for (let j = 0; j < shown.length; j++) if (p.room[j] === p.room[k] && shown[j] === YES) c++;
      el.textContent = c;
    },
    noun: 'numbered cell', noNoun: 'empty cell',
    className: 'pz-regions nr-board',
  });
})();
