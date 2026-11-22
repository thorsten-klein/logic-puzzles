// Chocona (Chocolate). Shade some cells so the shaded cells form
// rectangles (any size, across room borders). Rectangles never share a
// side. A number tells how many cells its room has shaded; rooms without
// a number may have any amount.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, clues } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const cons = [];
    rooms.forEach((cells, g) => {
      if (clues[g] >= 0) cons.push({ cells, min: clues[g], max: clues[g], at: cells[0], why: (v) => (v === YES ? `This room needs ${clues[g]} shaded cells.` : `This room already has its ${clues[g]} shaded cells.`) });
    });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    function check(s) {
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (seen[k] || s[k] !== YES) continue;
        const cells = [k];
        seen[k] = 1;
        for (const cur of cells) for (const j of nb(cur)) if (!seen[j] && s[j] === YES) { seen[j] = 1; cells.push(j); }
        const rs = cells.map((x) => Math.floor(x / C)), cs = cells.map((x) => x % C);
        const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cs), c1 = Math.max(...cs);
        // The final rectangle covers this box, so no white cell may sit inside it.
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (s[r * C + c] === NO) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = new Uint8Array(N).fill(NO);
      // Random rectangles that never share a side.
      for (let t = 0; t < 40; t++) {
        const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
        const r0 = Math.floor(Math.random() * (R - h + 1)), c0 = Math.floor(Math.random() * (C - w + 1));
        let ok = true;
        for (let r = r0 - 1; r <= r0 + h && ok; r++) for (let c = c0 - 1; c <= c0 + w && ok; c++) {
          if (r < 0 || c < 0 || r >= R || c >= C) continue;
          const corner = (r === r0 - 1 || r === r0 + h) && (c === c0 - 1 || c === c0 + w);
          if (!corner && sol[r * C + c] === YES) ok = false;
        }
        if (!ok) continue;
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) sol[r * C + c] = YES;
      }
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const count = Math.max(...room) + 1;
      const clues = new Int8Array(count);
      sol.forEach((v, k) => { if (v === YES) clues[room[k]]++; });
      const p = { R, C, room, clues };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
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
    id: 'chocona',
    name: 'Chocona',
    rules: 'Shade some cells so the shaded cells form rectangles (of any size, also across room borders). Rectangles ' +
      'never share a side. A number tells how many cells its outlined room has shaded; rooms without a number may have ' +
      'any amount.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'All chocolate bars squared away — nicely done.',
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
