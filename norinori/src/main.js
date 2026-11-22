// Norinori. Shade exactly two cells in every room. Every shaded cell is
// part of a domino (two shaded cells side by side, rooms do not matter),
// and dominoes never touch each other by a side.
// Built on the shared Binary game page (YES = shaded). p.room per cell.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const cons = rooms.map((cells) => ({ cells, min: 2, max: 2, at: cells[0],
      why: (v) => (v === YES ? 'This room needs two shaded cells.' : 'This room already has its two shaded cells.') }));
    function propagate(s, log) {
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        const n = nb(k);
        const yes = n.filter((j) => s[j] === YES), open = n.filter((j) => s[j] === UNKNOWN);
        if (yes.length > 1 || (!yes.length && !open.length)) return -1;
        if (yes.length === 1 && open.length) {
          open.forEach((j) => { s[j] = NO; });
          if (log) log.push({ cells: open, v: NO, reason: 'This domino is complete. Dominoes never touch by a side.' });
          return open.length;
        }
        if (!yes.length && open.length === 1) {
          s[open[0]] = YES;
          if (log) log.push({ cells: open, v: YES, reason: 'A shaded cell needs a partner, and only this neighbour is left.' });
          return 1;
        }
      }
      // A cell next to a complete domino stays white.
      return 0;
    }
    const check = (s) => {
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        const yes = nb(k).filter((j) => s[j] === YES).length;
        if (yes > 1) return false;
      }
      return true;
    };
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + (n > 6 ? 14000 : 8000);
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      // Dominoes that never touch by a side.
      const shade = new Uint8Array(N);
      const free = (k) => {
        const r = Math.floor(k / C), c = k % C;
        return !shade[k] && [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].every(([a, b]) => a < 0 || b < 0 || a >= R || b >= C || !shade[a * C + b]);
      };
      const dominoes = [];
      for (let t = 0; t < N * 3; t++) {
        const k = Math.floor(Math.random() * N), r = Math.floor(k / C), c = k % C;
        let j;
        if (Math.random() < 0.5) j = c < C - 1 ? k + 1 : -1;
        else if (r < R - 1) j = k + C;
        else j = -1;
        if (j < 0 || !free(k) || !free(j)) continue;
        shade[k] = shade[j] = 1;
        dominoes.push([k, j]);
      }
      // Rooms: each domino seeds a room; the rest of the cells join rooms.
      const room = new Int32Array(N).fill(-1);
      dominoes.forEach(([a, b], i) => { room[a] = room[b] = i; });
      for (let open = room.filter((x) => x < 0).length, guard = 0; open > 0 && guard < N * 4; guard++) {
        for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
          if (room[k] >= 0) continue;
          const r = Math.floor(k / C), c = k % C;
          const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
            .filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && room[a * C + b] >= 0).map(([a, b]) => room[a * C + b]);
          if (!near.length) continue;
          room[k] = near[Math.floor(Math.random() * near.length)];
          open--;
        }
      }
      if (room.some((x) => x < 0)) continue;
      const p = { R, C, room };
      const sol = Uint8Array.from(shade, (x) => (x ? YES : NO));
      // Repair: while a second answer exists, move one of its extra shaded
      // cells (white in ours) into a neighbouring room (see LITS).
      const side = (k) => [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1].filter((j) => j >= 0 && j < N);
      let ok = false;
      for (let fix = 0; fix < 40 && Date.now() < deadline; fix++) {
        const t = Binary.logicSolve(model(p));
        if (!t) break;
        if (!t.includes(UNKNOWN)) { ok = true; break; }
        const r = Binary.solve(model(p), 2, 5000, t);
        if (r.capped) break;
        const other = r.solutions.find((x) => x.some((v, k) => v !== sol[k]));
        if (!other) { ok = r.solutions.length === 1; break; }
        let moved = false;
        for (const x of PuzzleShell.shuffle([...new Array(N).keys()].filter((k) => other[k] === YES && sol[k] === NO))) {
          const g = room[x];
          const to = side(x).filter((j) => room[j] !== g);
          if (!to.length) continue;
          const rest = [...new Array(N).keys()].filter((k) => room[k] === g && k !== x);
          const set = new Set(rest), seen = new Set([rest[0]]), st = [rest[0]];
          while (st.length) { const k = st.pop(); for (const j of side(k)) if (set.has(j) && !seen.has(j)) { seen.add(j); st.push(j); } }
          if (seen.size !== rest.length) continue;
          room[x] = room[to[Math.floor(Math.random() * to.length)]];
          moved = true;
          break;
        }
        if (!moved) break;
      }
      if (!ok) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'norinori',
    name: 'Norinori',
    rules: 'Shade exactly two cells in every outlined room. Every shaded cell is part of a domino — two shaded cells side ' +
      'by side, across room borders or not — and dominoes never touch each other by a side.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 6 },
    solvedText: 'Dominoes all in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      return { R, C, room: Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) };
    },
    model,
    draw(p, k, el) { PuzzleShell.regionBorders(el, k, p.room, p.R, p.C); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions nn-board',
  });
})();
