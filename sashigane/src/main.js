// Sashigane. Divide the grid into L shapes whose legs are one cell wide.
// A circle marks the bend of its L; a number in the circle is the size of
// the L. An arrow sits at the end of a leg and points along the leg
// toward the bend. Built on the Parts engine.
// Clues: 1 = circle, v + 1 = circle with number v (v >= 2), 40 + d = arrow
// (d: 0 up, 1 down, 2 left, 3 right).

(() => {
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const ARROW = ['↑︎', '↓︎', '←︎', '→︎'];

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

  // Do the clues inside fit this L?
  function cluesFit(p, cells, L) {
    for (const k of cells) {
      const v = p.clues[k];
      if (!v) continue;
      if (v < 40) {
        if (k !== L.bend) return false;
        if (v > 1 && v - 1 !== cells.length) return false;
      } else {
        const d = v - 40;
        // An arrow at a leg end, pointing back toward the bend.
        const ok = L.legs.some(({ d: ld, leg }) => leg.at(-1) === k && d === (ld ^ 1));
        if (!ok) return false;
      }
    }
    return true;
  }

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
          out.push(cells.sort((x, y) => x - y));
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
    id: 'sashigane',
    name: 'Sashigane',
    rules: 'Divide the grid into L shapes with legs one cell wide by drawing walls. A circle marks the bend of its L; a ' +
      'number in the circle tells the size of the L. An arrow sits at the end of a leg and points along the leg toward ' +
      'the bend. L shapes without any mark are allowed.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Every corner squared — nicely done.',
    // An L can not be bigger than one full row plus one full column.
    maxSize: (p) => p.R + p.C - 1,
    grow(p, cells) {
      // All cells on one row and one column through a common cell.
      const rows = new Set(cells.map((k) => Math.floor(k / p.C))), cols = new Set(cells.map((k) => k % p.C));
      if (rows.size > 1 && cols.size > 1) {
        const fits = cells.some((x) => { const r = Math.floor(x / p.C), c = x % p.C; return cells.every((k) => Math.floor(k / p.C) === r || k % p.C === c); });
        if (!fits) return false;
      }
      return cells.filter((k) => p.clues[k] && p.clues[k] < 40).length <= 1;
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
        // Circle (sometimes with the size) and arrows on both leg ends.
        p.clues[L.bend] = Math.random() < 0.5 ? cells.length + 1 : 1;
        for (const { d, leg } of L.legs) p.clues[leg.at(-1)] = 40 + (d ^ 1);
      }
      return true;
    },
    cellText: (p, k) => { const v = p.clues[k]; return v >= 40 ? ARROW[v - 40] : v > 1 ? String(v - 1) : ''; },
    decorate(p, k, g, x, y, s) {
      const v = p.clues[k];
      if (!v || v >= 40) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.34);
      o.setAttribute('class', 'll-white');
      g.appendChild(o);
    },
  });
})();
