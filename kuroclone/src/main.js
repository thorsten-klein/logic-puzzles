// Kuroclone. Shade some cells. Each room holds exactly two shaded areas,
// and the two have the same shape and size (they may be turned or
// mirrored). Shaded cells in different rooms never touch by a side. Clue
// cells stay white: the arrow points to a neighbouring cell that is part
// of a shaded area, and the number is the size of that area.
// Built on the shared Binary game page (YES = shaded).
// Clues: 10 * size + direction + 1 (direction 0 up, 1 down, 2 left, 3 right).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const ARROW = ['↑', '↓', '←', '→'];

  // A shape key that is the same for turned or mirrored copies.
  function shapeKey(C, cells) {
    const pts = cells.map((k) => [Math.floor(k / C), k % C]);
    const keys = [];
    for (let t = 0; t < 8; t++) {
      const q = pts.map(([r, c]) => {
        let a = r, b = c;
        if (t & 1) [a, b] = [b, -a];
        if (t & 2) [a, b] = [-a, -b];
        if (t & 4) b = -b;
        return [a, b];
      });
      const r0 = Math.min(...q.map((x) => x[0])), c0 = Math.min(...q.map((x) => x[1]));
      keys.push(q.map(([a, b]) => `${a - r0},${b - c0}`).sort().join(' '));
    }
    return keys.reduce((min, k) => (k < min ? k : min), keys[0]);  // smallest key
  }

  function target(C, k, d) {
    const r = Math.floor(k / C), c = k % C;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]][d];
  }

  function checkRooms(rooms, areas, room, s, done, C) {
    const per = rooms.map(() => []);
    for (const A of areas) per[room[A.cells[0]]].push(A);
    for (let g = 0; g < rooms.length; g++) {
      const list = per[g];
      const closed = list.filter((A) => A.closed);
      if (closed.length > 2) return false;
      if (closed.length === 2 && shapeKey(C, closed[0].cells) !== shapeKey(C, closed[1].cells)) return false;
      const decided = done || rooms[g].every((k) => s[k] !== UNKNOWN);
      if (decided && (list.length !== 2 || closed.length !== 2)) return false;
    }
    return true;
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = [];
    for (let k = 0; k < N; k++) {
      if (k % C < C - 1 && room[k] !== room[k + 1]) cons.push({ cells: [k, k + 1], min: 0, max: 1, why: () => 'Shaded cells in different rooms never touch.' });
      if (k + C < N && room[k] !== room[k + C]) cons.push({ cells: [k, k + C], min: 0, max: 1, why: () => 'Shaded cells in different rooms never touch.' });
      if (clues[k]) {
        cons.push({ cells: [k], min: 0, max: 0, why: () => 'Clue cells stay white.' });
        const [a, b] = target(C, k, (clues[k] % 10) - 1);
        cons.push({ cells: [a * C + b], min: 1, max: 1, why: () => 'The arrow points to a shaded cell.' });
      }
    }
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    function check(s, done) {
      const area = new Int32Array(N).fill(-1);
      const areas = [];
      for (let k = 0; k < N; k++) {
        if (area[k] >= 0 || s[k] !== YES) continue;
        const cells = [k];
        area[k] = areas.length;
        for (const cur of cells) for (const j of nb(cur)) if (area[j] < 0 && s[j] === YES) { area[j] = areas.length; cells.push(j); }
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        areas.push({ cells, closed });
      }
      // Arrows: size of the pointed area.
      for (let k = 0; k < N; k++) {
        if (!clues[k]) continue;
        const [a, b] = target(C, k, (clues[k] % 10) - 1);
        const i = area[a * C + b];
        if (i < 0) continue;
        const size = Math.floor(clues[k] / 10), A = areas[i];
        if (A.cells.length > size || (A.closed && A.cells.length !== size)) return false;
      }
      // Rooms: two areas, same shape.
      return checkRooms(rooms, areas, room, s, done, C);
    }
    return { N, cons, check };
  }

  // Two equal, non-touching areas inside one room (or null).
  function placePair(C, R, cells) {
    const inRoom = new Set(cells);
    const nbs = (k) => [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1].filter((j) => j >= 0 && j < R * C);
    for (let t = 0; t < 30; t++) {
      const size = 1 + Math.floor(Math.random() * Math.min(4, Math.floor(cells.length / 3)));
      const a = [cells[Math.floor(Math.random() * cells.length)]];
      for (let g = 0; g < 20 && a.length < size; g++) {
        const opts = nbs(a[Math.floor(Math.random() * a.length)]).filter((j) => inRoom.has(j) && !a.includes(j));
        if (opts.length) a.push(opts[Math.floor(Math.random() * opts.length)]);
      }
      const key = shapeKey(C, a);
      const blocked = new Set(a.concat(a.flatMap(nbs)));
      // Try copies grown from each free cell with the same shape.
      for (const start of PuzzleShell.shuffle(cells.filter((k) => !blocked.has(k)))) {
        const pts = a.map((k) => [Math.floor(k / C) - Math.floor(a[0] / C), (k % C) - (a[0] % C)]);
        for (let tr = 0; tr < 8; tr++) {
          const b = pts.map(([r, c]) => {
            let x = r, y = c;
            if (tr & 1) [x, y] = [y, -x];
            if (tr & 2) [x, y] = [-x, -y];
            if (tr & 4) y = -y;
            const rr = Math.floor(start / C) + x, cc = (start % C) + y;
            return rr < 0 || cc < 0 || rr >= R || cc >= C ? -1 : rr * C + cc;
          });
          if (b.every((k) => k >= 0 && inRoom.has(k) && !blocked.has(k)) && shapeKey(C, b) === key) return [a, b];
        }
      }
    }
    return null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.max(2, Math.round(N / 8)));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const rooms = [];
      room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
      const sol = new Uint8Array(N).fill(NO);
      const pairs = [];
      let ok = true;
      for (const cells of rooms) {
        const pair = cells.length >= 3 && placePair(C, R, cells);
        if (!pair) { ok = false; break; }
        pairs.push(...pair);
        pair.flat().forEach((k) => { sol[k] = YES; });
      }
      if (!ok) continue;
      // Areas must not touch across rooms.
      if ([...new Array(N).keys()].some((k) => sol[k] === YES && ((k % C < C - 1 && sol[k + 1] === YES && room[k] !== room[k + 1]) || (k + C < N && sol[k + C] === YES && room[k] !== room[k + C])))) continue;
      // An arrow for each area from a white neighbour.
      const clues = new Int16Array(N);
      for (const area of pairs) {
        const opts = [];
        for (const x of area) for (let d = 0; d < 4; d++) {
          const from = [x + C, x - C, (x + 1) % C ? x + 1 : -1, x % C ? x - 1 : -1][d];
          if (from >= 0 && from < N && sol[from] === NO && !clues[from]) opts.push(from * 10 + d);
        }
        if (!opts.length) continue;
        const pick = opts[Math.floor(Math.random() * opts.length)];
        clues[Math.floor(pick / 10)] = 10 * area.length + (pick % 10) + 1;
      }
      const p = { R, C, room, clues };
      const unique = () => Binary.isUnique(model(p));
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!clues[k]) continue;
        const keep = clues[k];
        clues[k] = 0;
        if (!unique()) clues[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'kuroclone',
    name: 'Kuroclone',
    rules: 'Shade some cells. Each outlined room holds exactly two shaded areas with the same shape and size (they may be ' +
      'turned or mirrored). Shaded cells in different rooms never touch by a side. Clue cells stay white: the arrow points ' +
      'to a neighbouring shaded cell, and the number is the size of its area.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Perfect clones everywhere — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = Int16Array.from(String(d.n).split(','), Number);
      if (clues.length !== R * C) throw new Error('Invalid clues');
      return { R, C, room, clues };
    },
    model,
    fixed: (p, k) => (p.clues[k] ? NO : 0),
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      const v = p.clues[k];
      if (!v) return;
      const lab = document.createElement('span');
      lab.className = 'kc-clue';
      lab.textContent = Math.floor(v / 10) + ARROW[(v % 10) - 1] + '︎';
      el.appendChild(lab);
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions ck-board',
  });
})();
