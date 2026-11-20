// Tren (Parking). Place cars: blocks of 1×2 or 1×3 cells. Each car holds
// exactly one number, and every number is in a car. A car moves only
// sideways to its long side (a flat car moves up and down, a standing car
// left and right). The number tells how many cells in total it could move
// that way before it hits another car or the edge. Other cells stay empty.
// Built on the Parts engine; cars are listed as candidates.

(() => {
  // Free moves of a car (cells) when `id` holds all cars (-2 = empty).
  function moves(p, id, cells, free = (v) => v === -2) {
    const { R, C } = p;
    const flat = Math.floor(cells[0] / C) === Math.floor(cells[cells.length - 1] / C);
    let total = 0;
    for (const d of [-1, 1]) {
      for (let step = 1; ; step++) {
        const ok = cells.every((x) => {
          const r = Math.floor(x / C) + (flat ? d * step : 0), c = (x % C) + (flat ? 0 : d * step);
          return r >= 0 && c >= 0 && r < R && c < C && free(id[r * C + c]);
        });
        if (!ok) break;
        total++;
      }
    }
    return total;
  }

  Parts.startGame({
    id: 'tren',
    name: 'Tren',
    rules: 'Place cars by drawing walls: blocks of 1×2 or 1×3 cells. Each car holds exactly one number, and every number ' +
      'is in a car. A car moves only sideways (a flat car up and down, a standing car left and right). Its number tells ' +
      'how many cells in total it could move before it hits another car or the edge. Wall in each empty cell on its own.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Every car parked — nicely done.',
    maxSize: () => 3,
    skip: (p, k) => !p.clues[k],
    candidates(p, k, id) {
      const { R, C } = p;
      const r0 = Math.floor(k / C), c0 = k % C;
      const out = [];
      for (const len of [2, 3]) {
        if (c0 + len <= C) out.push([...Array(len).keys()].map((i) => k + i));
        if (r0 + len <= R) out.push([...Array(len).keys()].map((i) => k + i * C));
      }
      return out.filter((cells) => cells.filter((x) => p.clues[x]).length === 1 && cells.every((x) => id[x] === -1 || x === k));
    },
    // Each placed car: its moves lie between the sure ones (only empty
    // cells) and the possible ones (open cells may still be empty).
    region(p, cells, id) {
      const cars = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!cars.has(g)) cars.set(g, []); cars.get(g).push(k); } });
      for (const car of cars.values()) {
        const k = car.find((x) => p.clues[x]);
        const want = p.clues[k] - 1;
        if (moves(p, id, car) > want || moves(p, id, car, (v) => v === -2 || v === -1) < want) return false;
      }
      return true;
    },
    final(p, id) {
      const cars = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!cars.has(g)) cars.set(g, []); cars.get(g).push(k); } });
      for (const cells of cars.values()) {
        const k = cells.find((x) => p.clues[x]);
        if (moves(p, id, cells) !== p.clues[k] - 1) return false;
      }
      return true;
    },
    split(R, C) {
      const N = R * C;
      const id = new Int32Array(N).fill(-2);
      const cars = [];
      for (let t = 0; t < 4 * N && cars.length * 2.5 < N * 0.7; t++) {
        const len = 2 + Math.floor(Math.random() * 2), flat = Math.random() < 0.5;
        const r0 = Math.floor(Math.random() * R), c0 = Math.floor(Math.random() * C);
        const cells = [...Array(len).keys()].map((i) => (flat ? [r0, c0 + i] : [r0 + i, c0]));
        if (cells.some(([r, c]) => r >= R || c >= C || id[r * C + c] !== -2)) continue;
        const ks = cells.map(([r, c]) => r * C + c);
        ks.forEach((x) => { id[x] = cars.length; });
        cars.push(ks);
      }
      cars.id = id;
      return cars;
    },
    clues(p, regions) {
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * cells.length)]] = moves(p, regions.id, cells) + 1;
    },
    thin: false,
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
