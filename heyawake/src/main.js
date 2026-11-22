// Heyawake. Shade cells in a grid of rooms. Numbers tell how many
// shaded cells a room has. Shaded cells never touch by a side, white
// cells stay connected, and no straight white line crosses two room
// borders. Built on the shared Binary game page.

(() => {
  function model(p) {
    const { R, C, room, clues } = p;
    const cons = Binary.roomClueConstraints(Binary.buildRoomsMap(R, C, room), clues);
    cons.push(...Binary.noTouchConstraints(R, C), ...Binary.whiteBorderConstraints(R, C, room));
    return { N: R * C, cons, check: (s) => Binary.openConnected(R, C, s) };
  }

  function tryOnce(n) {
    return Binary.generateRoomClues(n, model, 0.3);
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
