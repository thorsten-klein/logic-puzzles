// Heyawake. Shade cells in a grid of rooms. Numbers tell how many
// shaded cells a room has. Shaded cells never touch by a side, white
// cells stay connected, and no straight white line crosses two room
// borders. Built on the shared Binary game page.

(() => {
  const { YES } = Binary;

  // Random split into rectangles of side 1..4 (no 1x1 rooms).
  function split(R, C) {
    const id = new Int32Array(R * C).fill(-1);
    let count = 0;
    for (let k = 0; k < R * C; k++) {
      if (id[k] >= 0) continue;
      const r = Math.floor(k / C), c = k % C;
      let maxW = 0;
      while (c + maxW < C && id[r * C + c + maxW] < 0 && maxW < 4) maxW++;
      const w = 1 + Math.floor(Math.random() * maxW);
      let maxH = 0;
      while (r + maxH < R && maxH < 4 && [...new Array(w).keys()].every((i) => id[(r + maxH) * C + c + i] < 0)) maxH++;
      let h = 1 + Math.floor(Math.random() * maxH);
      if (w * h === 1 && maxH > 1) h = 2;
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) id[(r + i) * C + c + j] = count;
      count++;
    }
    return id;
  }

  function findWhiteBorders(lines, room) {
    const borders = [];
    for (const line of lines) {
      const parts = [];
      for (const k of line) {
        if (parts.length && room[parts.at(-1)[0]] === room[k]) parts.at(-1).push(k);
        else parts.push([k]);
      }
      for (let i = 1; i + 1 < parts.length; i++) {
        borders.push([parts[i - 1][parts[i - 1].length - 1], ...parts[i], parts[i + 1][0]]);
      }
    }
    return borders;
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const cons = [];
    const rooms = new Map();
    for (let k = 0; k < R * C; k++) {
      if (!rooms.has(room[k])) rooms.set(room[k], []);
      rooms.get(room[k]).push(k);
    }
    for (const [id, cells] of rooms) {
      const v = clues[id];
      if (v < 0) continue;
      cons.push({ cells, min: v, max: v, area: cells,
        why: (x) => {
          if (x === YES) return `This room needs ${PuzzleShell.plural(v, 'shaded cell')}, and only these cells are left.`;
          if (v === 0) return 'This room has a 0. All its cells stay white.';
          return `This room already has its ${PuzzleShell.plural(v, 'shaded cell')}. The rest stay white.`;
        } });
    }
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Shaded cells may not touch by a side.';
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    // A white line may not cross two borders: each stretch that runs
    // through a whole room plus one cell on both sides needs a shade.
    const lines = [];
    for (let r = 0; r < R; r++) lines.push(Array.from({ length: C }, (_, c) => r * C + c));
    for (let c = 0; c < C; c++) lines.push(Array.from({ length: R }, (_, r) => r * C + c));
    for (const cells of findWhiteBorders(lines, room)) {
      cons.push({ cells, min: 1, max: cells.length,
        why: () => 'A straight white line may not cross two room borders. This cell must be shaded to break it.' });
    }
    return { N: R * C, cons, check: (s) => Binary.openConnected(R, C, s) };
  }

  function tryOnce(n) {
    const R = n, C = n;
    const room = split(R, C);
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
    encode: (p) => ({
      r: p.R, c: p.C,
      g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''),
      n: Array.from(p.clues).join(','),
    }),
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
      const first = p.room.indexOf(p.room[k]) === k;
      if (first && p.clues[p.room[k]] >= 0) {
        const lab = document.createElement('span');
        lab.className = 'room-clue';
        lab.textContent = p.clues[p.room[k]];
        el.appendChild(lab);
      }
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions hw-board',
  });
})();
