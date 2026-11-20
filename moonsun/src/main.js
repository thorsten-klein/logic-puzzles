// Moonsun. Draw one loop through cell centres. It crosses the border of
// each room exactly twice, so it passes every room once. In a room the
// loop visits either all suns (white circles) and no moons, or all moons
// (black circles) and no suns. Sun rooms and moon rooms alternate along
// the loop. Built on the shared Loop engine.
// p.room: room per cell; p.mark: 0 none, 1 sun, 2 moon.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, room, mark } = p;
    const g = Loop.grid(R, C);
    const count = Math.max(...room) + 1;
    const cellsOf = Array.from({ length: count }, () => []);
    room.forEach((r, k) => cellsOf[r].push(k));
    const border = Array.from({ length: count }, () => []);
    const between = [];
    for (let e = 0; e < g.E; e++) {
      const [a, b] = g.ends[e];
      if (room[a] === room[b]) continue;
      border[room[a]].push(e); border[room[b]].push(e);
      between.push([e, room[a], room[b]]);
    }
    const lines = (s, k) => g.cellEdges[k].filter((e) => e >= 0 && s[e] === LINE).length;
    const closed = (s, k) => g.cellEdges[k].every((e) => e < 0 || s[e] === CROSS);
    // Colour of a room: 1 sun, 2 moon, 0 not known, -1 broken.
    const colour = (s, r) => {
      let c = 0;
      for (const k of cellsOf[r]) {
        if (!mark[k] || !lines(s, k)) continue;
        if (c && c !== mark[k]) return -1;
        c = mark[k];
      }
      // A circle that is shut off can not be part of the room's colour.
      const can = [1, 2].filter((m) => !cellsOf[r].some((k) => mark[k] === m && closed(s, k)));
      if (c) return can.includes(c) ? c : -1;
      const has = [1, 2].filter((m) => cellsOf[r].some((k) => mark[k] === m));
      const left = has.length ? has.filter((m) => can.includes(m)) : [1, 2];
      if (!left.length) return -1;
      return left.length === 1 && has.length ? left[0] : 0;
    };
    function rule(s) {
      const col = [];
      for (let r = 0; r < count; r++) {
        const cross = border[r].filter((e) => s[e] === LINE).length;
        if (cross > 2) return false;
        if (border[r].every((e) => s[e] !== UNKNOWN) && cross !== 2) return false;
        col[r] = colour(s, r);
        if (col[r] < 0) return false;
        // Circles of the other colour stay off the loop.
        if (col[r]) for (const k of cellsOf[r]) if (mark[k] && mark[k] !== col[r] && lines(s, k)) return false;
      }
      for (const [e, a, b] of between) if (s[e] === LINE && col[a] && col[a] === col[b]) return false;
      return 0;
    }
    return { g, must: null, rule };
  }

  // Walk the loop and list its cells in order.
  function order(n, loop) {
    const g = Loop.grid(n, n);
    const step = [-n, n, -1, 1];
    let start = -1;
    for (let k = 0; k < n * n && start < 0; k++) if (g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE)) start = k;
    const out = [];
    let x = start, from = -1;
    do {
      out.push(x);
      const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && loop[g.cellEdges[x][q]] === LINE);
      x += step[d];
      from = d ^ 1;
    } while (x !== start);
    return out;
  }

  // Rooms: each stretch as it is, then the free cells join a random
  // neighbouring room until all cells have one.
  function grow(n, groups) {
    const N = n * n;
    const room = new Int32Array(N).fill(-1);
    groups.forEach((cells, id) => cells.forEach((k) => { room[k] = id; }));
    for (let open = room.filter((x) => x < 0).length; open > 0;) {
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (room[k] >= 0) continue;
        const r = Math.floor(k / n), c = k % n;
        const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && room[a * n + b] >= 0).map(([a, b]) => room[a * n + b]);
        if (!near.length) continue;
        room[k] = near[Math.floor(Math.random() * near.length)];
        open--;
      }
    }
    return room;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.5);
      if (!loop) continue;
      const path = order(n, loop);
      // Cut the loop into an even number of stretches (2–6 cells each).
      const cuts = [];
      for (let i = 0; i < path.length;) { const len = 2 + Math.floor(Math.random() * 5); cuts.push(path.slice(i, i + len)); i += len; }
      if (cuts.length < 4) continue;
      if (cuts[cuts.length - 1].length < 2 || cuts.length % 2) { const last = cuts.pop(); cuts[cuts.length - 1].push(...last); }
      if (cuts.length % 2) continue;
      const room = grow(n, cuts);
      const N = n * n;
      const onLoop = new Uint8Array(N);
      path.forEach((k) => { onLoop[k] = 1; });
      // Room colours alternate; suns or moons on the loop cells, the
      // other kind on cells off the loop.
      const mark = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        const want = (room[k] % 2) + 1;
        if (onLoop[k]) mark[k] = want;
        else if (Math.random() < 0.6) mark[k] = 3 - want;
      }
      const p = { R: n, C: n, room, mark };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (!mark[k]) continue;
        const keep = mark[k];
        mark[k] = 0;
        // Every room keeps at least one circle of its colour.
        const r = room[k];
        const left = [...Array(N).keys()].some((j) => room[j] === r && mark[j] === (r % 2) + 1);
        if (!left || !solved()) mark[k] = keep;
        if (Date.now() > deadline + 4000) break;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'moonsun',
    name: 'Moonsun',
    rules: 'Draw one closed loop through the centres of cells. It crosses the border of every outlined room exactly twice. ' +
      'In each room the loop visits either all suns (white circles) and no moons, or all moons (black circles) and no suns. ' +
      'Along the loop, sun rooms and moon rooms take turns.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Day and night in turn — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), m: Array.from(p.mark).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      if (typeof d.m !== 'string' || d.m.length !== n * n || !/^[012]+$/.test(d.m)) throw new Error('Invalid circles');
      const room = Int32Array.from({ length: n * n }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R: n, C: n, room, mark: Uint8Array.from(d.m, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      const r = Math.floor(k / p.C), c = k % p.C;
      const wall = (x1, y1, x2, y2) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'dl-wall');
        svg.appendChild(l);
      };
      if (c < p.C - 1 && p.room[k + 1] !== p.room[k]) wall(x + s / 2, y - s / 2, x + s / 2, y + s / 2);
      if (r < p.R - 1 && p.room[k + p.C] !== p.room[k]) wall(x - s / 2, y + s / 2, x + s / 2, y + s / 2);
      if (!p.mark[k]) return;
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x);
      o.setAttribute('cy', y);
      o.setAttribute('r', s * 0.22);
      o.setAttribute('class', p.mark[k] === 2 ? 'll-black' : 'll-white');
      svg.appendChild(o);
    },
  });
})();
