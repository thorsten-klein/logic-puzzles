// Castle Wall. Draw one loop through cell centres. The loop never enters
// a wall cell. Black walls lie outside the loop, white walls inside, grey
// walls either. A number with an arrow counts the loop segments that run
// in the arrow's direction, from the wall to the edge of the grid.
// Built on the shared Loop engine.
// p.wall: '' none, 'b' black, 'w' white, 'g' grey. p.num / p.dir: clue
// count (-1 none) and arrow (0 up, 1 down, 2 left, 3 right).

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;
  const ARROW = ['↑\uFE0E', '↓\uFE0E', '←\uFE0E', '→\uFE0E'];

  // Edges counted by an arrow clue at k: segments along the arrow line.
  function lineEdges(R, C, k, d) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (d === 2) for (let x = 0; x + 1 <= c - 1; x++) out.push(r * (C - 1) + x);
    if (d === 3) for (let x = c + 1; x < C - 1; x++) out.push(r * (C - 1) + x);
    if (d === 0) for (let y = 0; y + 1 <= r - 1; y++) out.push(R * (C - 1) + y * C + c);
    if (d === 1) for (let y = r + 1; y < R - 1; y++) out.push(R * (C - 1) + y * C + c);
    return out;
  }

  // Edges crossed by a ray from k going left, just below the centre.
  const rayEdges = (R, C, k) => {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r < R - 1) for (let x = 0; x < c; x++) out.push(R * (C - 1) + r * C + x);
    return out;
  };

  function model(p) {
    const { R, C, wall, num, dir } = p;
    const g = Loop.grid(R, C);
    const lines = wall.map((w, k) => (w && num[k] >= 0 ? lineEdges(R, C, k, dir[k]) : null));
    const rays = wall.map((w, k) => (w === 'b' || w === 'w' ? rayEdges(R, C, k) : null));
    function rule(s, log) {
      const push = (edges, v, reason, at) => {
        for (const e of edges) s[e] = v;
        if (log) log.push({ edges, v, reason, at });
        return edges.length;
      };
      for (let k = 0; k < R * C; k++) {
        if (!wall[k]) continue;
        const own = g.cellEdges[k].filter((e) => e >= 0 && s[e] !== CROSS);
        if (own.some((e) => s[e] === LINE)) return false;
        if (own.length) return push(own, CROSS, 'The loop never enters a wall cell.', k);
        if (lines[k]) {
          const v = num[k];
          const yes = lines[k].filter((e) => s[e] === LINE).length;
          const open = lines[k].filter((e) => s[e] === UNKNOWN);
          if (yes > v || yes + open.length < v) return false;
          if (open.length && yes === v) return push(open, CROSS, `This ${v} already has all its loop segments in the arrow's direction.`, k);
          if (open.length && yes + open.length === v) return push(open, LINE, `This ${v} needs every open segment in the arrow's direction.`, k);
        }
        if (rays[k]?.every((e) => s[e] !== UNKNOWN)) {
          const inside = rays[k].filter((e) => s[e] === LINE).length % 2 === 1;
          if (inside !== (wall[k] === 'w')) return false;
        }
      }
      return 0;
    }
    return { g, must: null, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.45);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const N = n * n;
      const onLoop = (k) => g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE);
      const wall = new Array(N).fill(''), num = new Int8Array(N).fill(-1), dir = new Int8Array(N);
      const free = [...new Array(N).keys()].filter((k) => !onLoop(k));
      for (const k of PuzzleShell.shuffle(free).slice(0, Math.ceil(free.length * 0.6))) {
        const inside = rayEdges(n, n, k).filter((e) => loop[e] === LINE).length % 2 === 1;
        wall[k] = inside ? 'w' : 'b';
        dir[k] = Math.floor(Math.random() * 4);
        num[k] = lineEdges(n, n, k, dir[k]).filter((e) => loop[e] === LINE).length;
      }
      const p = { R: n, C: n, wall, num, dir };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!wall[k]) continue;
        if (num[k] >= 0) {
          const keep = num[k];
          num[k] = -1;
          if (!solved()) { num[k] = keep; continue; }
        }
        const keepW = wall[k];
        wall[k] = 'g';
        if (!solved()) wall[k] = keepW;
        if (Date.now() > deadline + 4000) break;
      }
      // Grey walls without a number tell nothing more: drop them.
      for (let k = 0; k < N; k++) {
        if (wall[k] !== 'g' || num[k] >= 0) continue;
        wall[k] = '';
        if (!solved()) wall[k] = 'g';
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'castle-wall',
    name: 'Castle Wall',
    rules: 'Draw one closed loop through the centres of cells. The loop never enters a wall cell. Black walls lie outside ' +
      'the loop, white walls inside it, grey walls may be either. A number with an arrow tells how many loop segments run ' +
      'in the arrow\'s direction, between the wall and the edge of the grid.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'The castle is safe — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, w: p.wall.map((x) => x || '.').join(''),
      n: Array.from(p.num, (v, k) => (v < 0 ? '.' : v.toString(36) + p.dir[k])).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.w !== 'string' || d.w.length !== R * C || !/^[.bwg]+$/.test(d.w)) throw new Error('Invalid walls');
      const parts = String(d.n).split(',');
      if (parts.length !== R * C) throw new Error('Invalid numbers');
      const num = new Int8Array(R * C).fill(-1), dir = new Int8Array(R * C);
      parts.forEach((t, k) => {
        if (t === '.') return;
        num[k] = Number.parseInt(t.slice(0, -1), 36);
        dir[k] = Number(t.slice(-1)) % 4;
        if (!(num[k] >= 0)) throw new Error('Invalid numbers');
      });
      return { R, C, wall: Array.from(d.w, (ch) => (ch === '.' ? '' : ch)), num, dir };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.wall[k]) return;
      const NS = 'http://www.w3.org/2000/svg';
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', x - s / 2 + 2);
      rect.setAttribute('y', y - s / 2 + 2);
      rect.setAttribute('width', s - 4);
      rect.setAttribute('height', s - 4);
      rect.setAttribute('class', 'cw-' + p.wall[k]);
      svg.appendChild(rect);
      if (p.num[k] < 0) return;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y);
      t.setAttribute('font-size', s * 0.3);
      t.setAttribute('class', 'cw-num' + (p.wall[k] === 'b' ? ' on-black' : ''));
      t.textContent = p.num[k] + ARROW[p.dir[k]];
      svg.appendChild(t);
    },
  });
})();
