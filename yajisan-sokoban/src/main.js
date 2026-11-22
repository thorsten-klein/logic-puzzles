// Yajisan-Sokoban. Move the grey squares across or down (some may stay).
// Squares never cross, pass or land on each other's tracks, but they may
// pass over clue cells. A clue (number and arrow) tells how many grey
// squares end up in its row or column in the arrow's direction. A clue
// with a square on top of it no longer counts.
// Built on the shared Moves engine. p.clue: 0 none, 10 * v + d + 1 with
// d 0 up, 1 down, 2 left, 3 right.

(() => {
  const ARROW = ['↑', '↓', '←', '→'];
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function count(p, on, k) {
    const d = (p.clue[k] % 10) - 1;
    let r = Math.floor(k / p.C) + STEP[d][0], c = (k % p.C) + STEP[d][1], n = 0;
    while (r >= 0 && c >= 0 && r < p.R && c < p.C) { n += on[r * p.C + c]; r += STEP[d][0]; c += STEP[d][1]; }
    return n;
  }

  function partial(p, ends, done) {
    if (!done) return true;
    const on = new Uint8Array(p.R * p.C);
    for (const e of ends) on[e] = 1;
    for (let k = 0; k < p.R * p.C; k++) {
      if (!p.clue[k] || on[k]) continue;
      if (count(p, on, k) !== Math.floor(p.clue[k] / 10)) return false;
    }
    return true;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const on = new Uint8Array(N);
      const finals = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 6));
      finals.forEach((k) => { on[k] = 1; });
      // Clues on free cells.
      const clue = new Int16Array(N);
      for (const k of new Array(N).keys()) {
        if (on[k]) continue;
        const d = Math.floor(Math.random() * 4);
        clue[k] = d + 1;
        clue[k] = 10 * count({ R: n, C: n, clue }, on, k) + d + 1;
      }
      const used = Uint8Array.from(on);
      const pieces = [];
      let ok = true;
      for (const end of finals) {
        let placed = false;
        for (let t = 0; t < 20 && !placed; t++) {
          const d = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 3);
          const [dr, dc] = STEP[Math.floor(Math.random() * 4)];
          const r0 = Math.floor(end / n), c0 = end % n;
          const track = [];
          for (let i = 1; i <= d; i++) {
            const r = r0 + dr * i, c = c0 + dc * i;
            if (r < 0 || c < 0 || r >= n || c >= n || used[r * n + c]) { track.length = 0; break; }
            track.push(r * n + c);
          }
          if (track.length !== d) continue;
          track.forEach((x) => { used[x] = 1; });
          pieces.push({ k: d ? track[d - 1] : end, num: -1 });
          placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (!ok) continue;
      const p = { R: n, C: n, pieces, clue };
      const unique = () => { const r = Moves.solve(p, partial, 2, 30000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!clue[k]) continue;
        const keep = clue[k];
        clue[k] = 0;
        if (!unique()) clue[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = Moves.solve(p, partial, 1).solutions[0];
      // At least one piece must move.
      if (p.solution.every((e, i) => e === pieces[i].k)) continue;
      return p;
    }
    return null;
  }

  Moves.startGame({
    id: 'yajisan-sokoban',
    name: 'Yajisan-Sokoban',
    rules: 'Move the grey squares across or down (some may stay). Squares never cross, pass or land on another ' +
      'square\'s track, but they may pass over clues. A clue tells how many grey squares end up in its row or column in ' +
      'the arrow\'s direction. A clue with a square on top of it no longer counts.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every crate in its place — nicely done.',
    generate,
    encodeExtra: (p) => Array.from(p.clue).join(','),
    decodeExtra(p, x) {
      const clue = Int16Array.from(String(x).split(','), Number);
      if (clue.length !== p.R * p.C) throw new Error('Invalid clues');
      p.clue = clue;
    },
    partial,
    dark: true,
    cellText: (p, k) => (p.clue[k] ? Math.floor(p.clue[k] / 10) + ARROW[(p.clue[k] % 10) - 1] + '︎' : ''),
    pieceText: () => '',
  });
})();
