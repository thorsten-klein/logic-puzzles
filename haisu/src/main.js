// Haisu (House). Draw one line through cell centres from S to G that
// visits every cell. A small number in a room's corner tells how many
// times the line enters that room. A big number in a cell tells on which
// entry into its room the line passes that cell.
// Built on the shared Links engine.
// p.room per cell; p.count per room (-1 none); p.entry per cell (0 none).

(() => {
  const { LINE } = Loop;

  function model(p) {
    const { R, C, room, count, entry, start, goal } = p;
    const g = Loop.grid(R, C);
    const label = new Int8Array(R * C).fill(-1);
    label[start] = 1;
    label[goal] = 1;
    const step = [-C, C, -1, 1];
    function rule(s) {
      // Walk from S: count entries per room, check the numbers met.
      const visits = new Int32Array(count.length);
      let x = start, from = -1, prev = -1;
      for (let guard = 0; guard <= R * C; guard++) {
        if (room[x] !== prev) { visits[room[x]]++; prev = room[x]; }
        if (entry[x] && entry[x] !== visits[room[x]]) return -1;
        const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
        if (d === undefined) break;
        x += step[d];
        from = d ^ 1;
      }
      const finished = x === goal;
      const countOk = () => {
        for (let i = 0; i < count.length; i++) {
          if (count[i] < 0) continue;
          if (visits[i] > count[i]) return false;
          if (finished && visits[i] !== count[i]) return false;
        }
        return true;
      };
      return countOk() ? 0 : -1;
    }
    return { g, label, fill: true, rule };
  }

  // The menu size is half the board side (random tours need an even side).
  function generate(half) {
    const n = 2 * half, N = n * n;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      // A tour through every cell, cut open into a path.
      const tour = Loop.randomTour(n);
      const g = Loop.grid(n, n);
      const lines = [...tour.keys()].filter((e) => tour[e] === LINE);
      const cut = lines[Math.floor(Math.random() * lines.length)];
      const state = Uint8Array.from(tour);
      state[cut] = 2;
      const [start, goal] = g.ends[cut];
      // Walk the path to know the order of cells.
      const step = [-n, n, -1, 1];
      const order = [start];
      let x = start, from = -1;
      for (;;) {
        const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && state[g.cellEdges[x][q]] === LINE);
        if (d === undefined) break;
        x += step[d];
        from = d ^ 1;
        order.push(x);
      }
      if (order.length !== N) continue;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const rooms = Math.max(...room) + 1;
      const count = new Int8Array(rooms);
      const entry = new Int8Array(N);
      let prev = -1;
      for (const k of order) {
        if (room[k] !== prev) { count[room[k]]++; prev = room[k]; }
        entry[k] = count[room[k]];
      }
      const p = { R: n, C: n, room, count, entry, start, goal };
      if (!Links.unique(model(p), 8000)) continue;
      thin(p, deadline);
      p.solution = state;
      return p;
    }
    return null;
  }

  // Thin: drop room counts and entry numbers while it stays unique.
  function thin(p, deadline) {
    for (const i of PuzzleShell.shuffle([...p.count.keys()])) {
      const keep = p.count[i];
      p.count[i] = -1;
      if (!Links.unique(model(p), 8000)) p.count[i] = keep;
      if (Date.now() > deadline + 3000) break;
    }
    const N = p.R * p.C;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (!p.entry[k]) continue;
      const keep = p.entry[k];
      p.entry[k] = 0;
      if (!Links.unique(model(p), 8000)) p.entry[k] = keep;
      if (Date.now() > deadline + 4000) break;
    }
  }

  Links.startGame({
    id: 'haisu',
    name: 'Haisu',
    rules: 'Draw one line through the centres of cells from S to G that visits every cell. A small number in a room\'s ' +
      'corner tells how many times the line enters that room. A big number in a cell tells on which entry into its room ' +
      'the line passes that cell (1 = the first time it comes into the room).',
    size: { min: 2, max: 3, def: 2, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Home at last — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, s: p.start, t: p.goal, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''),
      c: Array.from(p.count).join(','), e: Array.from(p.entry, (v) => v.toString(36)).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n || typeof d.e !== 'string' || d.e.length !== n * n) throw new Error('Invalid puzzle');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const count = Int8Array.from(String(d.c).split(','), Number);
      return { R: n, C: n, room, count, entry: Int8Array.from(d.e, (ch) => Number.parseInt(ch, 36)), start: d.s, goal: d.t };
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
      const text = (tx, ty, size, cls, str) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', tx); t.setAttribute('y', ty); t.setAttribute('font-size', size);
        t.setAttribute('class', cls);
        t.textContent = str;
        svg.appendChild(t);
      };
      if (p.room.indexOf(p.room[k]) === k && p.count[p.room[k]] >= 0) text(x - s * 0.3, y - s * 0.28, s * 0.26, 'll-num hs-small', p.count[p.room[k]]);
      if (k === p.start || k === p.goal) {
        const o = document.createElementNS(NS, 'circle');
        o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
        o.setAttribute('class', 'll-white');
        svg.appendChild(o);
        text(x, y, s * 0.34, 'll-num', k === p.start ? 'S' : 'G');
      } else if (p.entry[k]) text(x, y, s * 0.42, 'll-num', p.entry[k]);
    },
  });
})();
