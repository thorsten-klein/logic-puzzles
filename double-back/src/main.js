// Double Back. Draw one loop through every cell. The loop visits each
// region exactly twice (it crosses each region's border exactly four
// times). Built on the shared Loop engine.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function stepBorder(edges, s, log) {
    const lines = edges.filter((e) => s[e] === LINE).length;
    const open = edges.filter((e) => s[e] === UNKNOWN);
    if (lines > 4 || lines + open.length < 4) return -1;
    if (!open.length) return 0;
    if (lines === 4) {
      for (const e of open) s[e] = CROSS;
      if (log) log.push({ edges: open, v: CROSS, reason: 'This region is already visited twice. The loop crosses no more of its border.' });
      return open.length;
    }
    if (lines + open.length === 4) {
      for (const e of open) s[e] = LINE;
      if (log) log.push({ edges: open, v: LINE, reason: 'The loop must visit this region twice, and only these border crossings are left.' });
      return open.length;
    }
    return 0;
  }

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = new Uint8Array(p.R * p.C).fill(1);
    // Edges on each region's border.
    const border = [];
    for (let e = 0; e < g.E; e++) {
      const [a, b] = g.ends[e];
      if (p.region[a] === p.region[b]) continue;
      border[p.region[a]] ??= []; border[p.region[a]].push(e);
      border[p.region[b]] ??= []; border[p.region[b]].push(e);
    }
    function rule(s, log) {
      for (const edges of border) {
        if (!edges) continue;
        const res = stepBorder(edges, s, log);
        if (res !== 0) return res;
      }
      return 0;
    }
    return { g, must, rule };
  }

  function tourOrder(sol, g, n) {
    const next = Array.from({ length: n * n }, () => []);
    for (let e = 0; e < g.E; e++) {
      if (sol[e] === LINE) {
        const [a, b] = g.ends[e];
        next[a].push(b);
        next[b].push(a);
      }
    }
    const order = [0];
    for (let prev = -1, cur = 0; order.length < n * n;) {
      const nx = next[cur].find((x) => x !== prev);
      prev = cur;
      cur = nx;
      order.push(cur);
    }
    const shift = Math.floor(Math.random() * order.length);
    return order.slice(shift).concat(order.slice(0, shift));
  }

  function pairSegments(n, rot) {
    const seg = new Int32Array(n * n);
    const segs = [];
    for (let i = 0; i < rot.length;) {
      const len = Math.min(rot.length - i, 2 + Math.floor(Math.random() * 4));
      const cells = rot.slice(i, i + len);
      cells.forEach((k) => { seg[k] = segs.length; });
      segs.push(cells);
      i += len;
    }
    const touch = (a, b) => segs[a].some((k) => {
      const r = Math.floor(k / n), c = k % n;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && seg[x * n + y] === b);
    });
    const region = new Int32Array(n * n).fill(-1);
    let id = 0;
    for (const a of PuzzleShell.shuffle([...segs.keys()])) {
      if (region[segs[a][0]] >= 0) continue;
      const b = PuzzleShell.shuffle([...segs.keys()]).find((x) => x !== a && region[segs[x][0]] < 0 && touch(a, x) &&
        Math.abs(x - a) > 1 && !(Math.max(x, a) === segs.length - 1 && Math.min(x, a) === 0));
      if (b === undefined) return null;
      for (const k of [...segs[a], ...segs[b]]) region[k] = id;
      id++;
    }
    return region;
  }

  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sol = Loop.randomTour(n);
      const g = Loop.grid(n, n);
      const rot = tourOrder(sol, g, n);
      const region = pairSegments(n, rot);
      if (!region) continue;
      const p = { R: n, C: n, region };
      const res = Loop.solve(model(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'double-back',
    name: 'Double Back',
    rules: 'Draw one closed loop through the centres of all cells, visiting every cell exactly once. ' +
      'The loop visits each outlined region exactly twice.',
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Every region visited twice — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      return { R: n, C: n, region: Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const { R, C, region } = p;
      const r = Math.floor(k / C), c = k % C;
      const x0 = x - s / 2, y0 = y - s / 2;
      const wall = (x1, y1, x2, y2) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'lp-wall');
        svg.appendChild(l);
      };
      if (c < C - 1 && region[k + 1] !== region[k]) wall(x0 + s, y0, x0 + s, y0 + s);
      if (r < R - 1 && region[k + C] !== region[k]) wall(x0, y0 + s, x0 + s, y0 + s);
    },
  });
})();
