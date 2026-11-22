// Heyablock. Shade cells in a grid of rooms. Each room has at least one
// shaded cell, and its shaded cells form one connected block. Numbers
// tell how many shaded cells a room has. Shaded cells of different rooms
// never touch by a side. White cells stay connected, and no straight
// white line crosses two room borders. Built on the shared Binary page.

(() => {
  const { YES, NO, splitRooms } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const rooms = Binary.buildRoomsMap(R, C, room);
    const cons = Binary.roomClueConstraints(rooms, clues);
    for (const [, cells] of rooms) cons.push({ cells, min: 1, max: cells.length, why: () => 'Every room has at least one shaded cell.' });
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Shaded cells of different rooms may not touch by a side.';
      if (c < C - 1 && room[k] !== room[k + 1]) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1 && room[k] !== room[k + C]) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    cons.push(...Binary.whiteBorderConstraints(R, C, room));
    // Shaded cells of a room must stay joinable inside the room.
    function roomBlocks(s) {
      for (const [, cells] of rooms) {
        const set = new Set(cells);
        const start = cells.find((k) => s[k] === YES);
        if (start === undefined) continue;
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length) {
          const k = stack.pop();
          const r = Math.floor(k / C), c = k % C;
          for (const j of [r > 0 ? k - C : -1, r < R - 1 ? k + C : -1, c > 0 ? k - 1 : -1, c < C - 1 ? k + 1 : -1]) {
            if (j >= 0 && set.has(j) && !seen.has(j) && s[j] !== NO) { seen.add(j); stack.push(j); }
          }
        }
        if (cells.some((k) => s[k] === YES && !seen.has(k))) return false;
      }
      return true;
    }
    return { N: R * C, cons, check: (s) => Binary.openConnected(R, C, s) && roomBlocks(s) };
  }

  function tryOnce(n) {
    const R = n, C = n;
    const room = splitRooms(R, C);
    const count = Math.max(...room) + 1;
    const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
    const sol = Binary.randomFill(model(p), 0.35, 5);
    if (!sol) return null;
    for (let k = 0; k < R * C; k++) if (p.clues[room[k]] < 0) p.clues[room[k]] = 0;
    for (let k = 0; k < R * C; k++) if (sol[k] === YES) p.clues[room[k]]++;
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(0)) return null;
    Binary.thinClues(p.clues, -1, () => model(p));
    p.solution = sol;
    return p;
  }

  Binary.startGame({
    id: 'heyablock',
    name: 'Heyablock',
    rules: 'Shade some cells. Every room has at least one shaded cell, and the shaded cells of a room form one connected block. ' +
      'A number tells how many shaded cells its room has. Shaded cells of different rooms never touch by a side. ' +
      'All white cells are connected. A straight line of white cells may not pass through more than two rooms.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 6 },
    solvedText: 'Every block in place — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: Binary.encodeRoomClues,
    decode: Binary.decodeRoomClues,
    model,
    draw: Binary.drawRoomClues,
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions hb-board',
  });
})();
