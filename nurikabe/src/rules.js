// Nurikabe rules as a Binary model. Exposes the global `Rules`.
//
// Puzzle: { n, clues (Int8Array, 0 = none) }. YES = sea (shaded).
// Rules: each island (white area) holds exactly one number, equal to
// its size. All sea cells are connected. No 2x2 block is all sea.

const Rules = (() => {
  const { UNKNOWN, YES, NO } = Binary;

  function neighbours(n) {
    const nb = [];
    for (let k = 0; k < n * n; k++) {
      const r = Math.floor(k / n), c = k % n, out = [];
      if (r > 0) out.push(k - n);
      if (r < n - 1) out.push(k + n);
      if (c > 0) out.push(k - 1);
      if (c < n - 1) out.push(k + 1);
      nb.push(out);
    }
    return nb;
  }

  // Components of cells where test(k) is true. Returns comp ids (-1 = none) and lists.
  function components(N, nb, test) {
    const id = new Int32Array(N).fill(-1);
    const list = [];
    for (let k = 0; k < N; k++) {
      if (id[k] >= 0 || !test(k)) continue;
      const cells = [k];
      id[k] = list.length;
      for (const cur of cells) {
        for (const j of nb[cur]) if (id[j] < 0 && test(j)) { id[j] = list.length; cells.push(j); }
      }
      list.push(cells);
    }
    return { id, list };
  }

  function model(p) {
    const { n, clues } = p;
    const N = n * n;
    const nb = neighbours(n);
    const cons = [];
    for (let k = 0; k < N; k++) {
      if (clues[k]) {
        cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells are part of an island.' });
      }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const k = r * n + c;
      cons.push({ cells: [k, k + 1, k + n, k + n + 1], min: 0, max: 3,
        why: () => 'The sea may not fill a 2×2 block. The last cell must be island.' });
    }

    // Island facts from the white cells: comp id, number in it (0 / -1 if two).
    function islands(s) {
      const comp = components(N, nb, (k) => s[k] === NO);
      const num = comp.list.map((cells) => {
        let v = 0;
        for (const k of cells) if (clues[k]) v = v ? -1 : clues[k];
        return v;
      });
      return { ...comp, num };
    }

    // Cells some numbered island can still reach. Each island grows
    // through open and unnumbered white cells, never touching another
    // numbered island. Each step counts one cell, so this never misses.
    function reachable(s, isl) {
      const reach = new Uint8Array(N);
      isl.list.forEach((cells, i) => {
        const v = isl.num[i];
        if (v <= 0) return;
        const left = v - cells.length;
        const dist = new Int32Array(N).fill(-1);
        const queue = [];
        for (const k of cells) { dist[k] = 0; reach[k] = 1; queue.push(k); }
        for (const cur of queue) {
          const k = cur;
          if (dist[k] >= left) continue;
          for (const j of nb[k]) {
            if (dist[j] >= 0 || s[j] === YES) continue;
            // May not join or touch a different numbered island.
            const other = (x) => s[x] === NO && isl.id[x] !== i && isl.num[isl.id[x]] !== 0;
            if (other(j) || nb[j].some(other)) continue;
            dist[j] = dist[k] + 1;
            reach[j] = 1;
            queue.push(j);
          }
        }
      });
      return reach;
    }

    function propagate(s, log) {
      const isl = islands(s);
      for (let i = 0; i < isl.list.length; i++) {
        const v = isl.num[i], cells = isl.list[i];
        if (v < 0) return -1;
        if (v > 0 && cells.length > v) return -1;
        if (v > 0 && cells.length === v) {
          const around = [...new Set(cells.flatMap((k) => nb[k]))].filter((j) => s[j] === UNKNOWN);
          if (around.length) {
            for (const j of around) s[j] = YES;
            if (log) log.push({ cells: around, v: YES, reason: `This island of ${v} is complete. The cells around it are sea.` });
            return around.length;
          }
        }
      }
      // An island that still needs cells and has one way out grows there.
      for (let i = 0; i < isl.list.length; i++) {
        const v = isl.num[i], cells = isl.list[i];
        if (v > 0 && cells.length >= v) continue;
        const exits = [...new Set(cells.flatMap((k) => nb[k]))].filter((j) => s[j] === UNKNOWN);
        if (exits.length === 0) return -1;
        if (exits.length === 1) {
          s[exits[0]] = NO;
          if (log) log.push({ cells: exits, v: NO, reason: v
            ? `This island of ${v} needs more cells, and this is its only way out.`
            : 'This white part has no number yet. It must grow through its only way out.' });
          return 1;
        }
      }
      // A sea part that is not the whole sea has one way out: it flows there.
      const sea = components(N, nb, (k) => s[k] === YES);
      if (sea.list.length > 1) {
        for (const cells of sea.list) {
          const exits = [...new Set(cells.flatMap((k) => nb[k]))].filter((j) => s[j] === UNKNOWN);
          if (exits.length === 0) return -1;
          if (exits.length === 1) {
            s[exits[0]] = YES;
            if (log) log.push({ cells: exits, v: YES, reason: 'This part of the sea must connect to the rest, and this is its only way out.' });
            return 1;
          }
        }
      }
      // Open cell between two numbered islands.
      for (let k = 0; k < N; k++) {
        if (s[k] !== UNKNOWN) continue;
        const ids = new Set(nb[k].filter((j) => s[j] === NO && isl.num[isl.id[j]] > 0).map((j) => isl.id[j]));
        if (ids.size > 1) {
          s[k] = YES;
          if (log) log.push({ cells: [k], v: YES, reason: 'This cell touches two numbered islands. It must be sea to keep them apart.' });
          return 1;
        }
      }
      const reach = reachable(s, isl);
      const far = [];
      for (let k = 0; k < N; k++) if (s[k] === UNKNOWN && !reach[k]) far.push(k);
      // A white cell no numbered island can reach is broken.
      for (let k = 0; k < N; k++) if (s[k] === NO && !reach[k]) return -1;
      if (far.length) {
        for (const j of far) s[j] = YES;
        if (log) log.push({ cells: far, v: YES, reason: 'No island can reach these cells. They must be sea.' });
        return far.length;
      }
      return 0;
    }

    function check(s, done) {
      // Sea cells must be able to connect through sea or open cells.
      const sea = components(N, nb, (k) => s[k] !== NO);
      const seaIds = new Set();
      for (let k = 0; k < N; k++) if (s[k] === YES) seaIds.add(sea.id[k]);
      if (seaIds.size > 1) return false;
      if (!done) return true;
      const isl = islands(s);
      return isl.list.every((cells, i) => isl.num[i] === cells.length);
    }

    return { N, cons, propagate, check };
  }

  function isSolved(p, s) {
    // Number cells can not be shaded by the player: they count as white.
    const t = Uint8Array.from(s, (v, k) => (v === YES && !p.clues[k] ? YES : NO));
    const m = model(p);
    if (!m.cons.every((con) => {
      const y = con.cells.filter((j) => t[j] === YES).length;
      return y >= con.min && y <= con.max;
    })) return false;
    return m.check(t, true);
  }

  return { model, isSolved, neighbours, components };
})();
