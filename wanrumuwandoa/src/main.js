// Wanrumuwandoa (One Room One Door). Shade some cells. A number tells
// how many cells its room has shaded. Shaded cells must never touch by a side.
// The white cells of each room connect inside the room. Two white cells
// next to each other across a room border form a door; two rooms share
// at most one door. All white cells connect.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function checkRoomConnectivity(rooms, s, R, C) {
    for (const cells of rooms) {
      const inRoom = new Set(cells);
      const start = cells.find((k) => s[k] === NO);
      if (start === undefined) continue;
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        const k = stack.pop(), r = Math.floor(k / C), c = k % C;
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          const j = a * C + b;
          if (a >= 0 && b >= 0 && a < R && b < C && inRoom.has(j) && !seen.has(j) && s[j] !== YES) { seen.add(j); stack.push(j); }
        }
      }
      if (cells.some((k) => s[k] === NO && !seen.has(k))) return false;
    }
    return true;
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = [];
    // Border pairs, grouped by the pair of rooms.
    const walls = new Map();
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (const j of [c < C - 1 ? k + 1 : -1, r < R - 1 ? k + C : -1]) {
        if (j < 0) continue;
        cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Shaded cells must never touch by a side.' });
        if (room[j] === room[k]) continue;
        const key = Math.min(room[k], room[j]) + ':' + Math.max(room[k], room[j]);
        if (!walls.has(key)) walls.set(key, []);
        walls.get(key).push([k, j]);
      }
    }
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    function propagate(s, log) {
      // Once two rooms have a door, no second door may open between them.
      for (const pairs of walls.values()) {
        const doors = pairs.filter(([a, b]) => s[a] === NO && s[b] === NO);
        if (doors.length > 1) return -1;
        if (doors.length !== 1) continue;
        for (const [a, b] of pairs) {
          if (pairs === doors || (s[a] === NO && s[b] === NO)) continue;
          let open;
          if (s[a] === NO && s[b] === UNKNOWN) open = b;
          else if (s[b] === NO && s[a] === UNKNOWN) open = a;
          else open = -1;
          if (open < 0) continue;
          s[open] = YES;
          if (log) log.push({ cells: [open], v: YES, reason: 'These two rooms already share a door. A second door between them is not allowed.' });
          return 1;
        }
      }
      return 0;
    }
    function check(s) {
      for (const pairs of walls.values()) if (pairs.filter(([a, b]) => s[a] === NO && s[b] === NO).length > 1) return false;
      if (!checkRoomConnectivity(rooms, s, R, C)) return false;
      return Binary.canConnect(R, C, s, NO);
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const count = Math.max(...room) + 1;
      const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
      const fill = Binary.randomFill(model(p), 0.4, 10);
      if (!fill) continue;
      if (fill.filter((v) => v === YES).length < N / 6) continue;
      p.clues = new Int8Array(count);
      fill.forEach((v, k) => { if (v === YES) p.clues[room[k]]++; });
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'wanrumuwandoa',
    name: 'Wanrumuwandoa',
    rules: 'Shade some cells. A number tells how many cells its room has shaded. Shaded cells must never touch by a side. ' +
      'The white cells of each room connect inside that room. Two white cells next to each other across a room border ' +
      'form a door; two rooms share at most one door. All white cells connect.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'One room, one door — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = Int8Array.from(String(d.n).split(','), Number);
      if (room.some((v) => !(v >= 0 && v < clues.length))) throw new Error('Invalid rooms');
      return { R, C, room, clues };
    },
    model,
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (p.room.indexOf(p.room[k]) === k && p.clues[p.room[k]] >= 0) {
        const lab = document.createElement('span');
        lab.className = 'room-clue';
        lab.textContent = p.clues[p.room[k]];
        el.appendChild(lab);
      }
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions wd-board',
  });
})();
