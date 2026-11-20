// Douieru. Split the grid into L shapes whose legs are one cell wide.
// Every L bends at a circle. A double circle means both legs are equally
// long, a black circle means different lengths, a white circle can be
// either. Built on the shared Pieces engine.
// Clue codes: 1 = double circle (equal), 2 = black (different), 3 = white.

(() => {
  const MAX = 4; // longest leg when building puzzles (the solver allows any)

  // All L shapes bending at cell k: legs of 1..max cells in two
  // perpendicular directions. Returns { cells, a, b } (leg lengths).
  function ells(R, C, k, max = Math.max(R, C)) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [v, h] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      for (let a = 1; a <= max; a++) for (let b = 1; b <= max; b++) {
        if (r + v * a < 0 || r + v * a >= R || c + h * b < 0 || c + h * b >= C) continue;
        const cells = [k];
        for (let i = 1; i <= a; i++) cells.push((r + v * i) * C + c);
        for (let j = 1; j <= b; j++) cells.push(r * C + c + h * j);
        out.push({ cells: cells.sort((x, y) => x - y), a, b });
      }
    }
    return out;
  }

  // Random tiling by L shapes (backtracking on the first open cell).
  function split(R, C) {
    const N = R * C;
    const used = new Uint8Array(N);
    const pieces = [];
    let nodes = 0;
    const all = Array.from({ length: N }, (_, k) => ells(R, C, k, MAX));
    const rec = (k) => {
      while (k < N && used[k]) k++;
      if (k === N) return true;
      if (++nodes > 4000) return false;
      const opts = [];
      for (let b = 0; b < N; b++) for (const L of all[b]) if (L.cells.includes(k) && L.cells.every((x) => !used[x] && x >= k)) opts.push({ ...L, bend: b });
      for (const L of PuzzleShell.shuffle(opts).slice(0, 5)) {
        L.cells.forEach((x) => { used[x] = 1; });
        pieces.push(L);
        if (rec(k + 1)) return true;
        pieces.pop();
        L.cells.forEach((x) => { used[x] = 0; });
      }
      return false;
    };
    if (!rec(0)) return null;
    return pieces.map((L) => Object.assign(L.cells, { bend: L.bend, a: L.a, b: L.b }));
  }

  Pieces.startGame({
    id: 'douieru',
    name: 'Douieru',
    rules: 'Divide the grid into L shapes with legs one cell wide. Every L bends at a circle. ' +
      'At a double circle both legs are equally long; at a black circle the legs differ in length; a white circle allows either.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Same and different, all sorted — nicely done.',
    shapes: (p, k) => ells(p.R, p.C, k)
      .filter((L) => (p.clues[k] === 1 ? L.a === L.b : p.clues[k] === 2 ? L.a !== L.b : true))
      .map((L) => L.cells),
    split,
    clueFor: (p, cells) => [cells.bend, Math.random() < 0.25 ? 3 : cells.a === cells.b ? 1 : 2],
    clueText: (v) => ['', '◎', '⬤', '○'][v],
  });
})();
