// Rectslider. Move the black cells across or down so that together they
// form rectangles of two or more cells. Rectangles never share a side. A
// number tells how many cells its black cell moves (0 = it stays); black
// cells without a number may move any distance or stay. Black cells never
// cross, pass or land on each other's tracks.
// Built on the shared Moves engine.

(() => {
  function partial(p, ends, done) {
    if (!done) return true;
    const { R, C } = p;
    const on = new Uint8Array(R * C);
    for (const e of ends) on[e] = 1;
    const seen = new Uint8Array(R * C);
    for (let k = 0; k < R * C; k++) {
      if (!on[k] || seen[k]) continue;
      const cells = [k];
      seen[k] = 1;
      for (const cur of cells) {
        const x = cur, r = Math.floor(x / C), c = x % C;
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          const j = a * C + b;
          if (a >= 0 && b >= 0 && a < R && b < C && on[j] && !seen[j]) { seen[j] = 1; cells.push(j); }
        }
      }
      if (cells.length < 2) return false;
      const rs = cells.map((x) => Math.floor(x / C)), cs = cells.map((x) => x % C);
      if ((Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1) !== cells.length) return false;
    }
    return true;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const on = new Uint8Array(N);
      // Rectangles that never share a side.
      for (let t = 0; t < 30; t++) {
        const h = 1 + Math.floor(Math.random() * 2), w = 1 + Math.floor(Math.random() * 3);
        if (h * w < 2) continue;
        const r0 = Math.floor(Math.random() * (n - h + 1)), c0 = Math.floor(Math.random() * (n - w + 1));
        let ok = true;
        for (let r = r0 - 1; r <= r0 + h && ok; r++) for (let c = c0 - 1; c <= c0 + w && ok; c++) {
          if (r < 0 || c < 0 || r >= n || c >= n) continue;
          const corner = (r === r0 - 1 || r === r0 + h) && (c === c0 - 1 || c === c0 + w);
          if (!corner && on[r * n + c]) ok = false;
        }
        if (!ok) continue;
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) on[r * n + c] = 1;
        if (on.reduce((a, b) => a + b, 0) > N / 5) break;
      }
      const ends = [...new Array(N).keys()].filter((k) => on[k]);
      if (ends.length < 4) continue;
      const used = Uint8Array.from(on);
      const pieces = [];
      let ok = true;
      for (const end of PuzzleShell.shuffle(ends)) {
        let placed = false;
        for (let t = 0; t < 20 && !placed; t++) {
          const d = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 3);
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
      const p = { R: n, C: n, pieces };
      const unique = () => { const r = Moves.solve(p, partial, 2, 30000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const i of PuzzleShell.shuffle([...pieces.keys()])) {
        const keep = pieces[i].num;
        pieces[i].num = -1;
        if (!unique()) pieces[i].num = keep;
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
    id: 'rectslider',
    name: 'Rectslider',
    rules: 'Move the black cells across or down so that together they form rectangles of two or more cells. Rectangles ' +
      'never share a side. A number tells how many cells its black cell moves (0 means it stays); black cells without a ' +
      'number may move any distance or stay. Black cells never cross, pass or land on another one\'s track.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every block in shape — nicely done.',
    generate,
    partial,
    dark: true,
    pieceText: (p, i) => (p.pieces[i].num >= 0 ? String(p.pieces[i].num) : ''),
  });
})();
