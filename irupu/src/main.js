// Irupu (I-Loop). Draw one loop through cell centres. The loop is made of
// straight blocks of three cells (1×3 or 3×1). Each block holds exactly
// one circle and touches exactly two other blocks: the ones before and
// after it on the loop. Every circle is on the loop.
// Built on the shared Loop engine.

(() => {
  const { UNKNOWN, LINE } = Loop;

  // Loop cells in order (or null if the lines are not one closed loop).
  function order(g, s) {
    const C = g.C;
    const step = [-C, C, -1, 1];
    const deg = (k) => g.cellEdges[k].filter((e) => e >= 0 && s[e] === LINE).length;
    const start = [...new Array(g.R * C).keys()].find((k) => deg(k));
    if (start === undefined) return null;
    const out = [];
    let x = start, from = -1;
    do {
      out.push(x);
      const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
      if (d === undefined) return null;
      x += step[d];
      from = d ^ 1;
    } while (x !== start && out.length <= g.R * C);
    return out;
  }

  // Split the loop into blocks that follow all rules; null if none works.
  function blockNeighborIds(cells, pos, idOf, i, C) {
    const near = new Set();
    for (const k of cells) {
      for (const j of [k - C, k + C, k % C ? k - 1 : -1, (k + 1) % C ? k + 1 : -1]) {
        if (pos.has(j) && idOf(j) !== i) near.add(idOf(j));
      }
    }
    return near;
  }

  function checkBlockNeighbors(list, pos, off, ring, C) {
    const idOf = (k) => Math.floor(((pos.get(k) - off + ring.length) % ring.length) / 3);
    const B = list.length;
    for (let i = 0; i < B; i++) {
      const near = blockNeighborIds(list[i], pos, idOf, i, C);
      if (near.size !== 2 || !near.has((i + 1) % B) || !near.has((i + B - 1) % B)) return false;
    }
    return true;
  }

  function buildBlockList(ring, off, C, circle) {
    const list = [];
    for (let i = 0; i < ring.length; i += 3) {
      const b = [0, 1, 2].map((j) => ring[(i + off + j) % ring.length]);
      const rows = new Set(b.map((k) => Math.floor(k / C))), cols = new Set(b.map((k) => k % C));
      if (rows.size !== 1 && cols.size !== 1) return null;
      if (b.filter((k) => circle[k]).length !== 1) return null;
      list.push(b);
    }
    return list;
  }

  function blocks(C, ring, circle) {
    if (ring.length % 3) return null;
    const pos = new Map(ring.map((k, i) => [k, i]));
    for (let off = 0; off < 3; off++) {
      const list = buildBlockList(ring, off, C, circle);
      if (list && checkBlockNeighbors(list, pos, off, ring, C)) return list;
    }
    return null;
  }

  function canRunFit(len, inner, xCircle, endCircle) {
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const total = len + a + b;
        if (total % 3 === 0 && total / 3 === inner + a * xCircle + b * endCircle) return true;
      }
    }
    return false;
  }

  function checkStraightRun(x, d, g, s, circle, turn, step) {
    let y = x + step[d], k = 0, inner = 0, end = -1;
    for (;;) {
      if (turn(y)) { end = y; break; }
      const e = g.cellEdges[y][d];
      if (e < 0 || s[e] !== LINE) break;
      k++;
      inner += circle[y];
      y += step[d];
    }
    if (end < 0) return true;
    return canRunFit(k, inner, circle[x], circle[end]);
  }

  function checkAllStraightRuns(R, C, g, s, circle) {
    const lines = (k) => [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
    const turn = (k) => { const L = lines(k); return L.length === 2 && (L[0] >> 1) !== (L[1] >> 1); };
    const step = [-C, C, -1, 1];
    for (let x = 0; x < R * C; x++) {
      if (!turn(x)) continue;
      for (const d of lines(x)) {
        if (!checkStraightRun(x, d, g, s, circle, turn, step)) return false;
      }
    }
    return true;
  }

  function model(p) {
    const { R, C, circle } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(circle);
    const count = circle.reduce((a, b) => a + b, 0);
    function rule(s) {
      let cells = 0;
      for (let k = 0; k < R * C; k++) if (g.cellEdges[k].some((e) => e >= 0 && s[e] === LINE)) cells++;
      if (cells > 3 * count) return -1;
      if (!checkAllStraightRuns(R, C, g, s, circle)) return -1;
      if (s.includes(UNKNOWN)) return 0;
      const ring = order(g, s);
      return ring?.length === cells && blocks(C, ring, circle) ? 0 : -1;
    }
    return { g, must, rule };
  }

  function expandSmallLoop(small, sg, g, big) {
    const edgeOf = new Map(g.ends.map((ab, e) => [ab.join(','), e]));
    const loop = new Uint8Array(g.E).fill(Loop.CROSS);
    for (let e = 0; e < sg.E; e++) {
      if (small[e] !== LINE) continue;
      const [a, b] = sg.ends[e].map(big);
      const d = (b - a) / 3;
      for (let i = 0; i < 3; i++) loop[edgeOf.get([a + i * d, a + (i + 1) * d].sort((x, y) => x - y).join(','))] = LINE;
    }
    return loop;
  }

  function extractBlockCircles(ring, n, o1, o2) {
    const off = ring.findIndex((k) => {
      const r = Math.floor(k / n) - o1, c = (k % n) - o2;
      return r % 3 === 0 && c % 3 === 0;
    });
    const circle = new Uint8Array(n * n);
    for (let i = 0; i < ring.length; i += 3) {
      const b = [0, 1, 2].map((j) => ring[(i + off + j) % ring.length]);
      const rows = new Set(b.map((k) => Math.floor(k / n))), cols = new Set(b.map((k) => k % n));
      if (rows.size !== 1 && cols.size !== 1) return null;
      circle[b[Math.floor(Math.random() * 3)]] = 1;
    }
    return circle;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    const g = Loop.grid(n, n);
    while (Date.now() < deadline) {
      const m = Math.floor((n - 1) / 3) + 1;
      const small = m >= 2 ? Loop.randomLoop(m, m, 0.5) : null;
      if (!small) continue;
      const sg = Loop.grid(m, m);
      const span = 3 * (m - 1) + 1;
      const o1 = Math.floor(Math.random() * (n - span + 1)), o2 = Math.floor(Math.random() * (n - span + 1));
      const big = (k) => (3 * Math.floor(k / m) + o1) * n + 3 * (k % m) + o2;
      const loop = expandSmallLoop(small, sg, g, big);
      const ring = order(g, loop);
      if (!ring || ring.length % 3) continue;
      const circle = extractBlockCircles(ring, n, o1, o2);
      if (!circle || !blocks(n, ring, circle)) continue;
      const p = { R: n, C: n, circle };
      if (!Loop.solvedBy(Loop.logicSolve(model(p)))) {
        const r = Loop.solve(model(p), 2, 30000);
        if (r.solutions.length !== 1 || r.capped) continue;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'irupu',
    name: 'Irupu',
    rules: 'Draw one closed loop through the centres of cells. The loop is made of straight blocks of three cells. Each ' +
      'block holds exactly one circle and touches only two other blocks: the ones before and after it on the loop.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'A loop of perfect blocks — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, m: Array.from(p.circle).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.m !== 'string' || d.m.length !== n * n || !/^[01]+$/.test(d.m)) throw new Error('Invalid circles');
      return { R: n, C: n, circle: Uint8Array.from(d.m, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.circle[k]) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.24);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
    },
    drawOnTop: true,
  });
})();
