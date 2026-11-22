// Chiyotsui (Door Hinge). Shade some cells. Shaded cells form areas that
// never touch by a side. Each area spans exactly two rooms, and its two
// parts mirror each other across the border between those rooms. A number
// tells how many cells its room has shaded.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES } = Binary;

  // Two parts mirror each other across a line between rows or columns.
  function mirrored(C, room, cells) {
    const set = new Set(cells);
    const regs = [...new Set(cells.map((k) => room[k]))];
    if (regs.length !== 2) return false;
    for (const a of cells) for (const [b, vert] of [[a + 1, true], [a + C, false]]) {
      if (!set.has(b) || (vert && b % C === 0) || room[a] === room[b]) continue;
      // Axis between a and b.
      const ra = Math.floor(a / C), ca = a % C;
      const flip = (k) => {
        const r = Math.floor(k / C), c = k % C;
        return vert ? r * C + (2 * ca + 1 - c) : (2 * ra + 1 - r) * C + c;
      };
      const ok = cells.every((k) => {
        const m = flip(k);
        const r = Math.floor(k / C), c = k % C;
        const side = vert ? c <= ca : r <= ra;
        const mr = Math.floor(m / C), mc = m % C;
        if (vert ? (mc < 0 || mc >= C) : mr < 0) return false;
        return set.has(m) && room[k] === (side ? room[a] : room[b]) && room[m] === (side ? room[b] : room[a]);
      });
      if (ok) return true;
    }
    return false;
  }

  // True when the shaded area is ok: at most 2 rooms; if closed, mirrors across border.
  function areaOk(cells, R, C, room, s, done) {
    if (new Set(cells.map((x) => room[x])).size > 2) return false;
    const closed = done || cells.every((x) => Binary.sideNeighbours(R, C, x).every((j) => s[j] !== UNKNOWN));
    return !closed || mirrored(C, room, cells);
  }

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = [];
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    function check(s, done) {
      return Binary.areas(R, C, s).list.every((cells) => areaOk(cells, R, C, room, s, done));
    }
    return { N, cons, check };
  }

  // Places one mirrored hinge area across room borders if possible.
  function tryPlaceHinge(R, C, room, sol) {
    const N = R * C;
    const a = Math.floor(Math.random() * N), vert = Math.random() < 0.5;
    const b = vert ? a + 1 : a + C;
    if (b >= N || (vert && b % C === 0) || room[a] === room[b]) return;
    const ra = Math.floor(a / C), ca = a % C;
    const flip = (k) => {
      const r = Math.floor(k / C), c = k % C;
      return vert ? r * C + (2 * ca + 1 - c) : (2 * ra + 1 - r) * C + c;
    };
    const inside = (k) => {
      const r = Math.floor(k / C), c = k % C;
      const m = flip(k), mr = Math.floor(m / C), mc = m % C;
      return (vert ? c <= ca && mc < C : r <= ra && mr < R) && room[k] === room[a] && room[m] === room[b];
    };
    const half = [a];
    const want = 1 + Math.floor(Math.random() * 3);
    for (let g = 0; g < 20 && half.length < want; g++) {
      const x = half[Math.floor(Math.random() * half.length)];
      const opts = Binary.sideNeighbours(R, C, x).filter((j) => !half.includes(j) && inside(j));
      if (opts.length) half.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    const cells = half.concat(half.map(flip));
    const own = new Set(cells);
    const free = (k) => sol[k] !== YES;
    const nbOk = (k) => Binary.sideNeighbours(R, C, k).every((j) => own.has(j) || sol[j] !== YES);
    if (cells.every((k) => free(k) && nbOk(k))) {
      cells.forEach((k) => { sol[k] = YES; });
    }
  }

  // Places mirrored areas on an empty board.
  function placeMirrored(R, C, room) {
    const sol = new Uint8Array(R * C).fill(2);
    for (let t = 0; t < 40; t++) tryPlaceHinge(R, C, room, sol);
    return sol;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const sol = placeMirrored(R, C, room);
      if (!sol.includes(YES)) continue;
      const count = Math.max(...room) + 1;
      const clues = new Int8Array(count);
      sol.forEach((v, k) => { if (v === YES) clues[room[k]]++; });
      const p = { R, C, room, clues };
      const unique = () => Binary.isUnique(model(p));
      if (!unique()) continue;
      for (const g of PuzzleShell.shuffle([...new Array(count).keys()])) {
        const keep = clues[g];
        clues[g] = -1;
        if (!unique()) clues[g] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'chiyotsui',
    name: 'Chiyotsui',
    rules: 'Shade some cells. Shaded cells form areas that never touch by a side. Each area spans exactly two outlined ' +
      'rooms, and its two parts mirror each other across the border between those rooms. A number tells how many cells ' +
      'its room has shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Every hinge swings true — nicely done.',
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
    className: 'pz-regions ck-board',
  });
})();
