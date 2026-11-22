// Every Second Turn. Draw one loop through the centres of all cells. The
// loop turns in every circle. Between two circles that follow each other
// on the loop, it turns exactly once (outside the circles).
// Built on the shared Loop engine. p.circle marks circles; p.given lists
// edges drawn from the start.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function applyGiven(given, s, log) {
    for (const e of given) {
      if (s[e] === CROSS) return -1;
      if (s[e] === UNKNOWN) {
        s[e] = LINE;
        if (log) log.push({ edges: [e], v: LINE, reason: 'This line piece is given.' });
        return 1;
      }
    }
    return 0;
  }

  function checkCircleTurns(k, g, s, dirs) {
    if (dirs.length === 2 && (dirs[0] >> 1) === (dirs[1] >> 1)) return -1;
    if (dirs.length === 1) {
      const opp = g.cellEdges[k][dirs[0] ^ 1];
      if (opp >= 0 && s[opp] === UNKNOWN) {
        const perp = (dirs[0] >> 1) ? [0, 1] : [2, 3];
        if (perp.every((d) => g.cellEdges[k][d] < 0 || s[g.cellEdges[k][d]] === CROSS)) return -1;
      }
    }
    return 0;
  }

  function checkCircleWalk(dirs, walk, s, k) {
    for (const d of dirs) {
      const w = walk(s, k, d);
      if (w.turns > 1 || (w.done && w.turns !== 1)) return -1;
    }
    return 0;
  }

  function model(p) {
    const { R, C, circle } = p;
    const g = Loop.grid(R, C);
    const must = new Uint8Array(R * C).fill(1);
    const linesAt = (s, x) => [0, 1, 2, 3].filter((d) => g.cellEdges[x][d] >= 0 && s[g.cellEdges[x][d]] === LINE);
    const step = [-C, C, -1, 1];
    // Walk from circle k out through side d. Returns the turns seen on
    // the way, and whether the next circle was reached.
    const walk = (s, k, d) => {
      let x = k + step[d], from = d ^ 1, turns = 0;
      for (let guard = 0; guard < R * C; guard++) {
        const dirs = linesAt(s, x);
        if (circle[x]) return { turns, done: true };
        if (dirs.length < 2) return { turns, done: false };
        const out = dirs.find((e) => e !== from);
        if (out === undefined) return { turns, done: false };
        if ((out >> 1) !== (from >> 1)) turns++;
        x += step[out];
        from = out ^ 1;
      }
      return { turns, done: false };
    };
    function rule(s, log) {
      const givenRes = applyGiven(p.given, s, log);
      if (givenRes !== 0) return givenRes;
      for (let k = 0; k < R * C; k++) {
        if (!circle[k]) continue;
        const dirs = linesAt(s, k);
        if (checkCircleTurns(k, g, s, dirs) === -1) return -1;
        if (checkCircleWalk(dirs, walk, s, k) === -1) return -1;
      }
      return 0;
    }
    return { g, must, rule };
  }

  // Circles on every second turn of the loop (the loop must turn an even
  // number of times).
  function circlesOf(n, loop) {
    const g = Loop.grid(n, n);
    const step = [-n, n, -1, 1];
    const linesAt = (x) => [0, 1, 2, 3].filter((d) => g.cellEdges[x][d] >= 0 && loop[g.cellEdges[x][d]] === LINE);
    const order = [];
    let x = 0, from = -1;
    do {
      order.push(x);
      const out = linesAt(x).find((d) => d !== from);
      x += step[out];
      from = out ^ 1;
    } while (x !== 0);
    const turnAt = order.filter((k) => { const d = linesAt(k); return (d[0] >> 1) !== (d[1] >> 1); });
    if (turnAt.length % 2) return null;
    const circle = new Uint8Array(n * n);
    const off = Math.random() < 0.5 ? 0 : 1;
    turnAt.forEach((k, i) => { if (i % 2 === off) circle[k] = 1; });
    return circle;
  }

  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomTour(n);
      const circle = circlesOf(n, loop);
      if (!circle) continue;
      const p = { R: n, C: n, circle, given: [] };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      // Add given line pieces until logic solves it, then drop extras.
      const lines = [...loop.keys()].filter((e) => loop[e] === LINE);
      for (let guard = 0; guard < lines.length && !solved(); guard++) {
        const st = Loop.logicSolve(model(p));
        const open = lines.filter((e) => !st || st[e] === UNKNOWN);
        if (!open.length) break;
        p.given.push(open[Math.floor(Math.random() * open.length)]);
      }
      if (!solved()) continue;
      for (const e of PuzzleShell.shuffle(p.given.slice())) {
        p.given = p.given.filter((x) => x !== e);
        if (!solved()) p.given.push(e);
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'every-second-turn',
    name: 'Every Second Turn',
    rules: 'Draw one closed loop through the centres of all cells. The loop turns in every circle. Between two circles ' +
      'that follow each other along the loop, it turns exactly once. Dark line pieces, if any, are given.',
    size: { min: 2, max: 5, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Turn, and turn again — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, o: Array.from(p.circle).join(''), e: p.given.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.o !== 'string' || d.o.length !== n * n || !/^[01]+$/.test(d.o)) throw new Error('Invalid circles');
      const E = Loop.grid(n, n).E;
      const given = String(d.e || '').split(',').filter(Boolean).map(Number);
      if (given.some((e) => !(e >= 0 && e < E))) throw new Error('Invalid lines');
      return { R: n, C: n, circle: Uint8Array.from(d.o, Number), given };
    },
    model,
    fixed: (p) => p.given,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.circle[k]) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x);
      o.setAttribute('cy', y);
      o.setAttribute('r', s * 0.22);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
    },
    drawOnTop: true,
  });
})();
