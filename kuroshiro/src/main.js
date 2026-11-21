// Kuroshiro. Draw one loop through cell centres that passes every circle
// and goes straight through each circle. Between two circles that follow
// each other on the loop: if they have the same colour the loop does not
// turn; if their colours differ the loop turns exactly once.
// Built on the shared Loop engine. p.mark: 0 none, 1 white, 2 black.

(() => {
  const { LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, mark } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(mark, (m) => (m ? 1 : 0));
    const step = [-C, C, -1, 1];
    const linesAt = (s, x) => [0, 1, 2, 3].filter((d) => g.cellEdges[x][d] >= 0 && s[g.cellEdges[x][d]] === LINE);
    // Walk from circle k through side d: turns seen, and the circle reached.
    const walk = (s, k, d) => {
      let x = k + step[d], from = d ^ 1, turns = 0;
      for (let guard = 0; guard < R * C; guard++) {
        if (mark[x]) return { turns, end: x };
        const dirs = linesAt(s, x);
        if (dirs.length < 2) return { turns, end: -1 };
        const out = dirs.find((e) => e !== from);
        if ((out >> 1) !== (from >> 1)) turns++;
        x += step[out];
        from = out ^ 1;
      }
      return { turns, end: -1 };
    };
    function rule(s) {
      for (let k = 0; k < R * C; k++) {
        if (!mark[k]) continue;
        const dirs = linesAt(s, k);
        // Straight through the circle.
        if (dirs.length === 2 && (dirs[0] >> 1) !== (dirs[1] >> 1)) return false;
        if (dirs.length === 1) {
          const o = g.cellEdges[k][dirs[0] ^ 1];
          if (o < 0 || s[o] === CROSS) return false;
        }
        for (const d of dirs) {
          const w = walk(s, k, d);
          const need = w.end >= 0 ? (mark[w.end] === mark[k] ? 0 : 1) : 1;
          if (w.turns > need) return false;
          if (w.end >= 0 && w.turns !== need) return false;
        }
      }
      return 0;
    }
    return { g, must, rule };
  }

  // Loop cells in order, with turn flags.
  function walkLoop(n, loop) {
    const g = Loop.grid(n, n);
    const step = [-n, n, -1, 1];
    const linesAt = (x) => [0, 1, 2, 3].filter((d) => g.cellEdges[x][d] >= 0 && loop[g.cellEdges[x][d]] === LINE);
    let start = -1;
    for (let k = 0; k < n * n && start < 0; k++) if (linesAt(k).length === 2) start = k;
    const order = [];
    let x = start, from = -1;
    do {
      const dirs = linesAt(x);
      order.push({ k: x, turn: (dirs[0] >> 1) !== (dirs[1] >> 1) });
      const out = dirs.find((d) => d !== from);
      x += step[out];
      from = out ^ 1;
    } while (x !== start);
    return order;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      // A loop on a half-size grid, scaled up by two: every straight run
      // then has a free cell between two turns.
      const m = Math.floor((n + 1) / 2);
      const small = Loop.randomLoop(m, m, 0.5);
      if (!small) continue;
      const sg = Loop.grid(m, m), bg = Loop.grid(n, n);
      const off = [Math.floor(Math.random() * (n - 2 * m + 2)), Math.floor(Math.random() * (n - 2 * m + 2))];
      const edge = new Map();
      for (let e = 0; e < bg.E; e++) edge.set(bg.ends[e].join(','), e);
      const loop = new Uint8Array(bg.E).fill(CROSS);
      const big = (k) => (2 * Math.floor(k / m) + off[0]) * n + 2 * (k % m) + off[1];
      for (let e = 0; e < sg.E; e++) {
        if (small[e] !== LINE) continue;
        const [a, b] = sg.ends[e].map(big);
        const mid = (a + b) / 2;
        loop[edge.get([a, mid].sort((x, y) => x - y).join(','))] = LINE;
        loop[edge.get([mid, b].sort((x, y) => x - y).join(','))] = LINE;
      }
      const order = walkLoop(n, loop);
      // Rotate so the walk starts right after a turn.
      const t0 = order.findIndex((o) => o.turn);
      const ring = order.slice(t0 + 1).concat(order.slice(0, t0 + 1));
      // Every straight run between two turns needs at least one circle.
      const mark = new Uint8Array(n * n);
      let ok = true, run = [];
      const runs = [];
      for (const o of ring) {
        if (o.turn) { runs.push(run); run = []; } else run.push(o.k);
      }
      for (const cells of runs) {
        if (!cells.length) { ok = false; break; }
        for (const k of cells) if (Math.random() < 0.5) mark[k] = 1;
        if (!cells.some((k) => mark[k])) mark[cells[Math.floor(Math.random() * cells.length)]] = 1;
      }
      if (!ok) continue;
      // Colours: same after no turn, different after one turn.
      let colour = 1, turns = 0;
      for (const o of ring) {
        if (o.turn) { turns++; continue; }
        if (!mark[o.k]) continue;
        if (turns % 2) colour = 3 - colour;
        mark[o.k] = colour;
        turns = 0;
      }
      const p = { R: n, C: n, mark };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      const unique = () => solved() || (() => { const r = Loop.solve(model(p), 2, 3000); return r.solutions.length === 1 && !r.capped; })();
      if (!unique()) continue;
      // Drop circles where the answer keeps at most one turn between circles.
      const turnsBetween = () => {
        let t = 0, max = 0, seen = false;
        for (const o of ring.concat(ring)) {
          if (o.turn) t++;
          else if (mark[o.k]) { if (seen) max = Math.max(max, t); seen = true; t = 0; }
        }
        return max;
      };
      for (const k of PuzzleShell.shuffle([...new Array(n * n).keys()])) {
        if (!mark[k]) continue;
        const keep = mark[k];
        mark[k] = 0;
        if (turnsBetween() > 1 || !unique()) mark[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'kuroshiro',
    name: 'Kuroshiro',
    rules: 'Draw one closed loop through the centres of cells that passes every circle and goes straight through each ' +
      'circle. Between two circles that follow each other on the loop: if both have the same colour, the loop does not ' +
      'turn between them; if their colours differ, it turns exactly once.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Black and white in harmony — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, m: Array.from(p.mark).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.m !== 'string' || d.m.length !== n * n || !/^[012]+$/.test(d.m)) throw new Error('Invalid circles');
      return { R: n, C: n, mark: Uint8Array.from(d.m, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.mark[k]) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.24);
      o.setAttribute('class', p.mark[k] === 2 ? 'll-black' : 'll-white');
      svg.appendChild(o);
    },
    drawOnTop: true,
  });
})();
