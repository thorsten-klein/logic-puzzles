// Heyawake. Shade cells in a grid of rooms. Numbers tell how many
// shaded cells a room has. Shaded cells never touch by a side, white
// cells stay connected, and no straight white line crosses two room
// borders. Built on the shared Binary game page.

(() => {
  const { YES, splitRooms } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const cons = Binary.roomClueConstraints(Binary.buildRoomsMap(R, C, room), clues);
    cons.push(...Binary.noTouchConstraints(R, C), ...Binary.whiteBorderConstraints(R, C, room));
    return { N: R * C, cons, check: (s) => Binary.openConnected(R, C, s) };
  }

  function tryOnce(n) {
    const R = n, C = n;
    const room = splitRooms(R, C);
    const count = Math.max(...room) + 1;
    const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
    const sol = Binary.randomFill(model(p), 0.3, 5);
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
    id: 'heyawake',
    name: 'Heyawake',
    rules: 'Shade some cells. A number tells how many shaded cells its room has. Shaded cells must never touch by a side. ' +
      'All white cells are connected. A straight line of white cells may not pass through more than two rooms.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Every room checks out — nicely done.',
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
    className: 'pz-regions hw-board',
  });
})();
