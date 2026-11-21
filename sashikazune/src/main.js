// Sashikazune. Divide the grid into L shapes whose legs are one cell
// wide. A number tells how many cells there are from it to the bend of its
// L, both counted (so the bend shows 1). An L holds at most three numbers;
// L shapes without numbers are allowed. Built on the Parts engine.

(() => {
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // L shape info: bend cell and the two legs (cell lists from the bend
  // outward), or null if the cells are not an L.
  function shape(C, cells) {
    const set = new Set(cells);
    for (const k of cells) {
      const r = Math.floor(k / C), c = k % C;
      const legs = [];
      for (let d = 0; d < 4; d++) {
        const leg = [];
        for (let i = 1; ; i++) {
          const a = r + STEP[d][0] * i, b = c + STEP[d][1] * i;
          if (a < 0 || b < 0 || b >= C || !set.has(a * C + b)) break;
          leg.push(a * C + b);
        }
        if (leg.length) legs.push({ d, leg });
      }
      if (legs.length === 2 && (legs[0].d >> 1) !== (legs[1].d >> 1) && 1 + legs[0].leg.length + legs[1].leg.length === cells.length) {
        return { bend: k, legs };
      }
    }
    return null;
  }

  // Distance (in cells, both ends counted) from k to the bend.
  const dist = (C, k, bend) => Math.abs(Math.floor(k / C) - Math.floor(bend / C)) + Math.abs((k % C) - (bend % C)) + 1;
  const cluesFit = (p, cells, L) => cells.every((k) => !p.clues[k] || p.clues[k] === dist(p.C, k, L.bend));

  // Random L tiling (legs up to 4 long).
  function split(R, C) {
    const N = R * C;
    const used = new Uint8Array(N);
    const pieces = [];
    let nodes = 0;
    const ells = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (const [v, h] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
          if (r + v * a < 0 || r + v * a >= R || c + h * b < 0 || c + h * b >= C) continue;
          const cells = [k];
          for (let i = 1; i <= a; i++) cells.push((r + v * i) * C + c);
          for (let j = 1; j <= b; j++) cells.push(r * C + c + h * j);
          cells.sort((x, y) => x - y);
          out.push(cells);
        }
      }
      return out;
    };
    const all = Array.from({ length: N }, (_, k) => ells(k));
    const rec = (k) => {
      while (k < N && used[k]) k++;
      if (k === N) return true;
      if (++nodes > 4000) return false;
      const opts = [];
      for (let b = 0; b < N; b++) for (const cells of all[b]) if (cells.includes(k) && cells.every((x) => !used[x] && x >= k)) opts.push(cells);
      for (const cells of PuzzleShell.shuffle(opts).slice(0, 5)) {
        cells.forEach((x) => { used[x] = 1; });
        pieces.push(cells);
        if (rec(k + 1)) return true;
        pieces.pop();
        cells.forEach((x) => { used[x] = 0; });
      }
      return false;
    };
    return rec(0) ? pieces : null;
  }

  Parts.startGame({
    id: 'sashikazune',
    name: 'Sashikazune',
    rules: 'Draw walls to split the grid into L shapes. An L is two straight lines of cells that meet in a corner. ' +
      'Each line is one cell wide and at least two cells long. ' +
      'A number tells how many cells it is to the corner of its L, including the number\'s own cell and the corner. ' +
      'So a 1 is the corner itself. An L can hold up to three numbers, or none.',
    // Ls by their two line lengths, corner counted in both, longer line first:
    // "4-2" is 4 cells up and 2 to the side, both with the corner.
    info: () => PuzzleShell.shapeFigures([[1, 1], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2], [4, 3]].map(([a, b]) => ({
      caption: `${a + 1}-${b + 1}`,
      cells: [...Array.from({ length: a + 1 }, (_, i) => [i, 0]), ...Array.from({ length: b }, (_, j) => [a, j + 1])],
    })), null, 'Some examples:'),
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every corner found — nicely done.',
    // An L can not be bigger than one full row plus one full column.
    maxSize: (p) => p.R + p.C - 1,
    grow(p, cells) {
      // All cells on one row and one column through a common cell.
      const rows = new Set(cells.map((k) => Math.floor(k / p.C))), cols = new Set(cells.map((k) => k % p.C));
      if (rows.size > 1 && cols.size > 1) {
        const fits = cells.some((x) => { const r = Math.floor(x / p.C), c = x % p.C; return cells.every((k) => Math.floor(k / p.C) === r || k % p.C === c); });
        if (!fits) return false;
      }
      return cells.filter((k) => p.clues[k]).length <= 3;
    },
    region(p, cells) {
      const L = shape(p.C, cells);
      return !!L && cluesFit(p, cells, L);
    },
    split,
    clues(p, pieces) {
      for (const cells of pieces) {
        const L = shape(p.C, cells);
        if (!L) return false;
        for (const k of PuzzleShell.shuffle(cells.slice()).slice(0, 3)) p.clues[k] = dist(p.C, k, L.bend);
      }
      return true;
    },
    cellText: (p, k) => String(p.clues[k]),
  });
})();
