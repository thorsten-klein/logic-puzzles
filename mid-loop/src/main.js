// Mid-Loop. Draw one loop through cell centres that passes every dot.
// Dots sit in cells or on borders between cells. The loop goes straight
// through each dot, and the dot is the middle of that straight stretch.
// Built on the shared Loop engine.
// p.cdot marks cells with a dot; p.edot lists edges with a dot.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, cdot, edot } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(cdot);
    for (const e of edot) for (const k of g.ends[e]) must[k] = 1;
    const step = [-C, C, -1, 1];
    // Straight run from cell x in direction d: edges so far, and whether
    // it surely stops there.
    const run = (s, x, d) => {
      let len = 0;
      for (;;) {
        const perp = (d >> 1) ? [0, 1] : [2, 3];
        if (perp.some((q) => g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE)) return { len, final: true };
        const e = g.cellEdges[x][d];
        if (e < 0 || s[e] === CROSS) return { len, final: true };
        if (s[e] === UNKNOWN) return { len, final: false };
        len++;
        x += step[d];
      }
    };
    const same = (a, b) => !(a.final && b.final && a.len !== b.len) && !(a.final && b.len > a.len) && !(b.final && a.len > b.len);
    function rule(s, log) {
      for (const e of edot) {
        if (s[e] === CROSS) return false;
        if (s[e] === UNKNOWN) {
          s[e] = LINE;
          if (log) log.push({ edges: [e], v: LINE, reason: 'The loop passes every dot.' });
          return 1;
        }
        const [a, b] = g.ends[e];
        const d = b - a === 1 ? 3 : 1; // direction from a to b
        if (!same(run(s, a, d ^ 1), run(s, b, d))) return false;
      }
      for (let k = 0; k < R * C; k++) {
        if (!cdot[k]) continue;
        const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
        if (dirs.length === 2 && (dirs[0] >> 1) !== (dirs[1] >> 1)) return false;
        if (dirs.length === 1) {
          const o = g.cellEdges[k][dirs[0] ^ 1];
          if (o < 0 || s[o] === CROSS) return false;
        }
        if (dirs.length === 2) {
          const walk = (d) => { const r = run(s, k + step[d], d); return { len: r.len + 1, final: r.final }; };
          if (!same(walk(dirs[0]), walk(dirs[1]))) return false;
        }
      }
      return 0;
    }
    return { g, must, rule };
  }

  // All possible dots of a full loop.
  function dotsOf(n, loop) {
    const g = Loop.grid(n, n);
    const step = [-n, n, -1, 1];
    const has = (x, d) => g.cellEdges[x][d] >= 0 && loop[g.cellEdges[x][d]] === LINE;
    const len = (x, d) => { let k = 0; while (has(x, d)) { x += step[d]; k++; } return k; };
    const cells = [], edges = [];
    for (let k = 0; k < n * n; k++) {
      for (const [a, b] of [[0, 1], [2, 3]]) if (has(k, a) && has(k, b) && len(k, a) === len(k, b)) cells.push(k);
    }
    for (let e = 0; e < g.E; e++) {
      if (loop[e] !== LINE) continue;
      const [a, b] = g.ends[e];
      const d = b - a === 1 ? 3 : 1;
      if (len(a, d ^ 1) === len(b, d)) edges.push(e);
    }
    return { cells, edges };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.5);
      if (!loop) continue;
      const { cells, edges } = dotsOf(n, loop);
      const p = { R: n, C: n, cdot: new Uint8Array(n * n), edot: edges.slice() };
      cells.forEach((k) => { p.cdot[k] = 1; });
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      const items = PuzzleShell.shuffle([...cells.map((k) => ['c', k]), ...edges.map((e) => ['e', e])]);
      for (const [t, x] of items) {
        if (t === 'c') { p.cdot[x] = 0; if (!solved()) p.cdot[x] = 1; }
        else { p.edot = p.edot.filter((e) => e !== x); if (!solved()) p.edot.push(x); }
        if (Date.now() > deadline + 4000) break;
      }
      p.edot.sort((a, b) => a - b);
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'mid-loop',
    name: 'Mid-Loop',
    rules: 'Draw one closed loop through the centres of cells. It passes every dot; dots sit in cells or on the border ' +
      'between two cells. The loop goes straight through each dot, and the dot is exactly in the middle of that straight stretch.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Right down the middle — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, c: Array.from(p.cdot).join(''), e: p.edot.join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.c !== 'string' || d.c.length !== n * n || !/^[01]+$/.test(d.c)) throw new Error('Invalid dots');
      const E = Loop.grid(n, n).E;
      const edot = String(d.e || '').split(',').filter((t) => t !== '').map(Number);
      if (edot.some((e) => !(e >= 0 && e < E))) throw new Error('Invalid dots');
      return { R: n, C: n, cdot: Uint8Array.from(d.c, Number), edot };
    },
    model,
    drawCell: (p) => {
      const g = Loop.grid(p.R, p.C);
      const onEdge = new Map();
      for (const e of p.edot) { const [a, b] = g.ends[e]; onEdge.set(a, [...(onEdge.get(a) || []), b - a === 1 ? 'r' : 'd']); }
      return (svg, k, x, y, s) => {
        const dot = (cx, cy) => {
          const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          o.setAttribute('cx', cx);
          o.setAttribute('cy', cy);
          o.setAttribute('r', s * 0.16);
          o.setAttribute('class', 'ml-dot');
          svg.appendChild(o);
        };
        if (p.cdot[k]) dot(x, y);
        for (const w of onEdge.get(k) || []) dot(w === 'r' ? x + s / 2 : x, w === 'd' ? y + s / 2 : y);
      };
    },
    drawOnTop: true,
  });
})();
