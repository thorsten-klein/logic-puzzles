// Stostone. Shade some cells in every room: at least one, and the shaded
// cells of a room form one block (a stone). A number tells how many cells
// its room has shaded. Cells next to each other across a room border are
// never both shaded. When all stones fall straight down, they fill exactly
// the bottom half of the grid. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Let stones fall; returns the shaded cells afterwards.
  function fall(R, C, shaded) {
    const N = R * C;
    const id = new Int32Array(N).fill(-1);
    const blocks = [];
    for (let k = 0; k < N; k++) {
      if (!shaded[k] || id[k] >= 0) continue;
      const cells = [k];
      id[k] = blocks.length;
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i], r = Math.floor(x / C), c = x % C;
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          const j = a * C + b;
          if (a >= 0 && b >= 0 && a < R && b < C && shaded[j] && id[j] < 0) { id[j] = blocks.length; cells.push(j); }
        }
      }
      blocks.push(cells);
    }
    for (let moved = true; moved;) {
      moved = false;
      for (let b = 0; b < blocks.length; b++) {
        const cells = blocks[b];
        const can = cells.every((k) => { const j = k + C; return j < N && (id[j] < 0 || id[j] === b); });
        if (!can) continue;
        cells.forEach((k) => { id[k] = -1; });
        blocks[b] = cells.map((k) => k + C);
        blocks[b].forEach((k) => { id[k] = b; });
        moved = true;
      }
    }
    return Uint8Array.from(id, (v) => (v >= 0 ? 1 : 0));
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const cons = [];
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (const j of [c < C - 1 ? k + 1 : -1, r < R - 1 ? k + C : -1]) {
        if (j >= 0 && room[j] !== room[k]) cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Cells next to each other across a room border are never both shaded.' });
      }
    }
    // Every column ends up half full.
    for (let c = 0; c < C; c++) cons.push({ cells: Array.from({ length: R }, (_, r) => r * C + c), min: R / 2, max: R / 2, why: (v) => (v === YES ? 'The stones fill the bottom half, so every column has half its cells shaded.' : 'This column already has half its cells shaded.') });
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
      else cons.push({ cells, min: 1, max: cells.length, why: () => 'Every room needs at least one shaded cell.' });
    });
    function check(s, done) {
      // The shaded cells of a room can still form one block.
      for (const cells of rooms) {
        const inRoom = new Set(cells);
        const yes = cells.filter((k) => s[k] === YES);
        if (!yes.length) continue;
        const seen = new Set([yes[0]]);
        const stack = [yes[0]];
        while (stack.length) {
          const k = stack.pop(), r = Math.floor(k / C), c = k % C;
          for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            const j = a * C + b;
            if (a >= 0 && b >= 0 && a < R && b < C && inRoom.has(j) && !seen.has(j) && s[j] !== NO) { seen.add(j); stack.push(j); }
          }
        }
        if (yes.some((k) => !seen.has(k))) return false;
      }
      if (!done) return true;
      const after = fall(R, C, Uint8Array.from(s, (v) => (v === YES ? 1 : 0)));
      return after.every((v, k) => v === (Math.floor(k / C) >= R / 2 ? 1 : 0));
    }
    return { N, cons, check };
  }

  function generate(half) {
    const R = 2 * half, C = 2 * half, N = R * C;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      // Stones tile the bottom half; then each is lifted at random.
      const tiles = Pieces.randomTiling(half, C, () => 1 + Math.floor(Math.random() * 4));
      if (!tiles) continue;
      const stones = tiles.map((cells) => cells.map((k) => k + half * C));
      const pos = new Int32Array(N).fill(-1);
      let ok = true;
      const placed = [];
      // Lift from the top stones down, keeping stones apart.
      for (const cells of stones.sort((a, b) => Math.min(...a) - Math.min(...b))) {
        const top = Math.min(...cells.map((k) => Math.floor(k / C)));
        const lifts = PuzzleShell.shuffle(Array.from({ length: top + 1 }, (_, i) => i));
        let done = false;
        for (const h of lifts) {
          const moved = cells.map((k) => k - h * C);
          const touch = moved.some((k) => {
            if (pos[k] >= 0) return true;
            const r = Math.floor(k / C), c = k % C;
            return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && pos[a * C + b] >= 0);
          });
          if (touch) continue;
          moved.forEach((k) => { pos[k] = placed.length; });
          placed.push(moved);
          done = true;
          break;
        }
        if (!done) { ok = false; break; }
      }
      if (!ok) continue;
      const shaded = Uint8Array.from(pos, (v) => (v >= 0 ? 1 : 0));
      const after = fall(R, C, shaded);
      if (!after.every((v, k) => v === (Math.floor(k / C) >= half ? 1 : 0))) continue;
      // Rooms grow around the stones.
      const room = Int32Array.from(pos);
      for (let open = room.filter((x) => x < 0).length, guard = 0; open > 0 && guard < N * 4; guard++) {
        for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
          if (room[k] >= 0) continue;
          const r = Math.floor(k / C), c = k % C;
          const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && room[a * C + b] >= 0).map(([a, b]) => room[a * C + b]);
          if (!near.length) continue;
          room[k] = near[Math.floor(Math.random() * near.length)];
          open--;
        }
      }
      const sol = Uint8Array.from(shaded, (v) => (v ? YES : NO));
      const p = { R, C, room, clues: Int8Array.from(placed, (cells) => cells.length) };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const g of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[g];
        p.clues[g] = -1;
        if (!unique()) p.clues[g] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'stostone',
    name: 'Stostone',
    rules: 'Shade some cells in every outlined room: at least one, and the shaded cells of a room form one block, a ' +
      'stone. A number tells how many cells its room has shaded. Cells next to each other across a room border are never ' +
      'both shaded. When all stones fall straight down, they fill exactly the bottom half of the grid.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'All stones landed — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20) || R % 2) throw new Error('Invalid board size');
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
    className: 'pz-regions ck-board',
  });
})();
