// Satogaeri (Coming Home). Move the circles across or down so each room
// ends up with exactly one circle. A number tells how many cells its
// circle moves (0 = it stays); circles without a number may move any
// distance or stay. Circles never cross or pass over each other's tracks.
// Built on the shared Moves engine.

(() => {
  function partial(p, ends, done) {
    const cnt = new Int32Array(p.rooms);
    for (const e of ends) if (e >= 0 && ++cnt[p.room[e]] > 1) return false;
    if (done) for (let g = 0; g < p.rooms; g++) if (cnt[g] !== 1) return false;
    return true;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const rooms = Math.max(...room) + 1;
      const cells = [];
      room.forEach((g, k) => { (cells[g] = cells[g] || []).push(k); });
      const used = new Uint8Array(N);
      const ends = cells.map((list) => list[Math.floor(Math.random() * list.length)]);
      ends.forEach((k) => { used[k] = 1; });
      const pieces = [];
      let ok = true;
      for (const end of ends) {
        let placed = false;
        for (let t = 0; t < 20 && !placed; t++) {
          const d = Math.random() < 0.2 ? 0 : 1 + Math.floor(Math.random() * 3);
          const [dr, dc] = [[-1, 0], [1, 0], [0, -1], [0, 1]][Math.floor(Math.random() * 4)];
          const r0 = Math.floor(end / n), c0 = end % n;
          const track = [];
          for (let i = 1; i <= d; i++) {
            const r = r0 + dr * i, c = c0 + dc * i;
            if (r < 0 || c < 0 || r >= n || c >= n || used[r * n + c]) { track.length = 0; break; }
            track.push(r * n + c);
          }
          if (track.length !== d) continue;
          track.forEach((x) => { used[x] = 1; });
          pieces.push({ k: d ? track[d - 1] : end, num: d });
          placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (!ok) continue;
      const p = { R: n, C: n, pieces, room, rooms };
      const unique = () => { const r = Moves.solve(p, partial, 2, 20000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const i of PuzzleShell.shuffle([...pieces.keys()])) {
        const keep = pieces[i].num;
        pieces[i].num = -1;
        if (!unique()) pieces[i].num = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = Moves.solve(p, partial, 1).solutions[0];
      // At least one circle must move.
      if (p.solution.every((e, i) => e === pieces[i].k)) continue;
      return p;
    }
    return null;
  }

  Moves.startGame({
    id: 'satogaeri',
    name: 'Satogaeri',
    rules: 'Move the circles across or down so that each outlined room ends up with exactly one circle. A number tells ' +
      'how many cells its circle moves (0 means it stays). Circles without a number may move any distance or stay. ' +
      'Circles never cross, pass or land on another circle\'s track.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Everyone made it home — nicely done.',
    generate,
    encodeExtra: (p) => Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== 2 * p.R * p.C) throw new Error('Invalid rooms');
      p.room = Int32Array.from({ length: p.R * p.C }, (_, k) => Number.parseInt(x.slice(2 * k, 2 * k + 2), 36));
      p.rooms = Math.max(...p.room) + 1;
    },
    partial,
    pieceText: (p, i) => (p.pieces[i].num >= 0 ? String(p.pieces[i].num) : ''),
  });
})();
