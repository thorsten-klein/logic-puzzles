// Wataridori. Join the circles in pairs with lines through cell centres.
// Equal numbers may pair, and an empty circle may pair with any circle.
// A number tells how many rooms its line passes through. A line enters
// each room at most once. Lines never cross or share a cell; cells may
// stay empty. Built on the shared Links engine.
// p.room per cell; p.circle: -1 none, 0 empty circle, v > 0 number.

(() => {
  const { LINE } = Loop;

  function model(p) {
    const { R, C, room, circle } = p;
    const g = Loop.grid(R, C);
    const step = [-C, C, -1, 1];
    // Walk from end k: rooms passed in order, and where it stops.
    const walk = (s, k) => {
      const rooms = [room[k]];
      let x = k, from = -1;
      for (let guard = 0; guard < R * C; guard++) {
        const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
        if (d === undefined) break;
        x += step[d];
        from = d ^ 1;
        if (room[x] !== rooms[rooms.length - 1]) rooms.push(room[x]);
      }
      return { rooms, end: x };
    };
    function rule(s) {
      for (let k = 0; k < R * C; k++) {
        if (circle[k] < 0) continue;
        const w = walk(s, k);
        if (new Set(w.rooms).size !== w.rooms.length) return false;
        const v = circle[k];
        if (v > 0 && w.rooms.length > v) return false;
        const done = w.end !== k && circle[w.end] >= 0;
        if (done && v > 0 && w.rooms.length !== v) return false;
      }
      return 0;
    }
    return { g, label: circle, fill: false, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const even = n % 2 ? n - 1 : n;
      // Paths from a random tour on the even part of the grid; keep some.
      const { paths } = Links.randomPaths(even, 3, n + 2);
      const keep = PuzzleShell.shuffle(paths).slice(0, Math.max(2, Math.round(paths.length * 0.6)));
      const remap = (k) => Math.floor(k / even) * n + (k % even);
      const lines = keep.map((path) => path.map(remap));
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      // Every line may enter a room only once.
      const ok = lines.every((path) => {
        const seq = path.map((k) => room[k]).filter((r, i, a) => i === 0 || r !== a[i - 1]);
        return new Set(seq).size === seq.length;
      });
      if (!ok) continue;
      const circle = new Int8Array(N).fill(-1);
      const g = Loop.grid(n, n);
      const state = new Uint8Array(g.E).fill(2);
      const edgeOf = new Map();
      for (let e = 0; e < g.E; e++) edgeOf.set(g.ends[e].join(','), e);
      for (const path of lines) {
        const count = path.map((k) => room[k]).filter((r, i, a) => i === 0 || r !== a[i - 1]).length;
        circle[path[0]] = count;
        circle[path[path.length - 1]] = count;
        for (let i = 0; i + 1 < path.length; i++) state[edgeOf.get([path[i], path[i + 1]].sort((a, b) => a - b).join(','))] = LINE;
      }
      const p = { R: n, C: n, room, circle };
      if (!Links.unique(model(p))) continue;
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (circle[k] <= 0) continue;
        const keepV = circle[k];
        circle[k] = 0;
        if (!Links.unique(model(p))) circle[k] = keepV;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'wataridori',
    name: 'Wataridori',
    rules: 'Join the circles in pairs with lines through the centres of cells. Two equal numbers may pair, and an empty ' +
      'circle may pair with any circle. A number tells how many outlined rooms its line passes through, and a line enters ' +
      'each room at most once. Lines never cross or share a cell; cells may stay empty.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every bird has flown home — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), o: Array.from(p.circle, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      if (typeof d.o !== 'string' || d.o.length !== n * n) throw new Error('Invalid circles');
      const room = Int32Array.from({ length: n * n }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R: n, C: n, room, circle: Int8Array.from(d.o, (ch) => (ch === '.' ? -1 : parseInt(ch, 36))) };
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
      if (p.circle[k] < 0) return;
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
      if (!p.circle[k]) return;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.34);
      t.setAttribute('class', 'll-num');
      t.textContent = p.circle[k];
      svg.appendChild(t);
    },
  });
})();
