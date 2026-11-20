// Shimaguni (Islands). Shade some cells in every room: at least one, and
// the shaded cells of a room form one connected block. A number tells how
// many cells its room has shaded. Two neighbouring rooms never have the
// same number of shaded cells, and shaded cells in different rooms never
// share a side.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const side = (C, N, k) => [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1].filter((j) => j >= 0 && j < N);

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
    const cons = [];
    rooms.forEach((cells, g) => {
      if (!cells) return;
      if (clues[g] > 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
      else cons.push({ cells, min: 1, max: cells.length, at: cells[0], why: () => 'Every room has at least one shaded cell.' });
    });
    for (let k = 0; k < N; k++) for (const j of [k % C < C - 1 ? k + 1 : -1, k + C < N ? k + C : -1]) {
      if (j >= 0 && room[j] !== room[k]) cons.push({ cells: [k, j], min: 0, max: 1, why: () => 'Shaded cells in different rooms never share a side.' });
    }
    // Neighbouring rooms.
    const near = rooms.map(() => new Set());
    for (let k = 0; k < N; k++) for (const j of side(C, N, k)) if (room[j] !== room[k]) near[room[k]].add(room[j]);
    // For rooms with a number: every connected block of that size.
    const blocks = rooms.map((cells, g) => {
      if (!cells || !(clues[g] > 0) || cells.length > 14) return null;
      const want = clues[g], set = new Set(cells), out = new Set();
      const grow = (cur) => {
        if (cur.length === want) { out.add(cur.slice().sort((x, y) => x - y).join(',')); return; }
        for (const x of cur) for (const j of side(C, N, x)) {
          if (!set.has(j) || cur.includes(j) || j < cur[0]) continue;
          cur.push(j); grow(cur); cur.pop();
        }
      };
      for (const k of cells) grow([k]);
      return [...out].map((t) => t.split(',').map(Number));
    });
    function propagate(s, log) {
      let set = 0;
      for (let g = 0; g < rooms.length; g++) {
        if (!blocks[g]) continue;
        const fit = blocks[g].filter((ks) => rooms[g].every((k) => (s[k] === YES ? ks.includes(k) : s[k] === NO ? !ks.includes(k) : true)));
        if (!fit.length) return false;
        for (const k of rooms[g]) {
          if (s[k] !== UNKNOWN) continue;
          const inAll = fit.every((ks) => ks.includes(k)), inNone = fit.every((ks) => !ks.includes(k));
          if (!inAll && !inNone) continue;
          s[k] = inAll ? YES : NO;
          set++;
          if (log) { log.push({ cells: [k], v: s[k], reason: inAll ? 'Every block that still fits this room covers this cell.' : 'No block that still fits this room covers this cell.' }); return set; }
        }
      }
      return set;
    }
    function check(s, done) {
      const count = rooms.map(() => -1);
      for (let g = 0; g < rooms.length; g++) {
        const cells = rooms[g];
        if (!cells) continue;
        const black = cells.filter((k) => s[k] === YES);
        // Shaded cells must be able to join inside the room.
        if (black.length > 1) {
          const ok = new Set(cells.filter((k) => s[k] !== NO));
          const seen = new Set([black[0]]), st = [black[0]];
          while (st.length) { const k = st.pop(); for (const j of side(C, N, k)) if (ok.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (black.some((k) => !seen.has(k))) return false;
        }
        if (done || cells.every((k) => s[k] !== UNKNOWN)) {
          const set = new Set(black);
          if (!black.length) return false;
          const seen = new Set([black[0]]), st = [black[0]];
          while (st.length) { const k = st.pop(); for (const j of side(C, N, k)) if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (seen.size !== black.length) return false;
          count[g] = black.length;
        }
      }
      for (let g = 0; g < rooms.length; g++) {
        if (count[g] < 0) continue;
        for (const h of near[g]) if (count[h] === count[g]) return false;
      }
      return true;
    }
    return { N, cons, check, propagate };
  }

  function generate(n) {
    const deadline = Date.now() + (n > 5 ? 14000 : 8000);
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const rooms = [];
      room.forEach((g, k) => { (rooms[g] = rooms[g] || []).push(k); });
      const sol = new Uint8Array(N).fill(NO);
      // A connected blob per room, apart from other rooms' blobs.
      let ok = true;
      const count = [];
      for (let g = 0; g < rooms.length && ok; g++) {
        let placed = false;
        for (let t = 0; t < 30 && !placed; t++) {
          const want = 1 + Math.floor(Math.random() * Math.min(4, rooms[g].length));
          const blob = [rooms[g][Math.floor(Math.random() * rooms[g].length)]];
          for (let u = 0; u < 20 && blob.length < want; u++) {
            const opts = side(C, N, blob[Math.floor(Math.random() * blob.length)]).filter((j) => room[j] === g && !blob.includes(j));
            if (opts.length) blob.push(opts[Math.floor(Math.random() * opts.length)]);
          }
          if (blob.some((k) => side(C, N, k).some((j) => room[j] !== g && sol[j] === YES))) continue;
          blob.forEach((k) => { sol[k] = YES; });
          count[g] = blob.length;
          placed = true;
        }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      const p = { R, C, room, clues: Int8Array.from(count) };
      if (model(p).check(sol, true) === false) continue;
      // Repair rooms until the answer is unique (see LITS).
      let unique = false;
      for (let fix = 0; fix < 30 && !unique && Date.now() < deadline; fix++) {
        const r = Binary.solve(model(p), 2, 20000);
        if (r.capped || !r.solutions.length) break;
        const other = r.solutions.find((x) => x.some((v, k) => v !== sol[k]));
        if (!other) { unique = true; break; }
        let moved = false;
        for (const x of PuzzleShell.shuffle([...Array(N).keys()].filter((k) => other[k] === YES && sol[k] === NO))) {
          const g = room[x];
          const to = side(C, N, x).filter((j) => room[j] !== g && sol[j] === NO);
          if (!to.length) continue;
          const rest = [...Array(N).keys()].filter((k) => room[k] === g && k !== x);
          const set = new Set(rest), seen = new Set([rest[0]]), st = [rest[0]];
          while (st.length) { const k = st.pop(); for (const j of side(C, N, k)) if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (seen.size !== rest.length) continue;
          const old = room[x];
          room[x] = room[to[Math.floor(Math.random() * to.length)]];
          if (model(p).check(sol, true) === false) { room[x] = old; continue; }
          moved = true;
          break;
        }
        if (!moved) break;
      }
      if (!unique) continue;
      // Drop numbers that are not needed.
      const isUnique = () => { const r = Binary.solve(model(p), 2, 4000); return r.solutions.length === 1 && !r.capped; };
      const stop = Date.now() + 1500;
      for (const g of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[g];
        p.clues[g] = 0;
        if (!isUnique()) p.clues[g] = keep;
        if (Date.now() > stop) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'shimaguni',
    name: 'Shimaguni',
    rules: 'Shade some cells in every outlined room: at least one, and the shaded cells of a room form one connected ' +
      'block. A number tells how many cells its room has shaded. Two neighbouring rooms never have the same number of ' +
      'shaded cells, and shaded cells in different rooms never share a side.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'All islands charted — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: R * C }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = Int8Array.from(String(d.n).split(','), Number);
      if (room.some((v) => !(v >= 0 && v < clues.length))) throw new Error('Invalid rooms');
      return { R, C, room, clues };
    },
    model,
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      if (p.room.indexOf(p.room[k]) === k && p.clues[p.room[k]] > 0) {
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
