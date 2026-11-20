// Grand Tour. Connect all points with one loop. A few connections are
// given so the loop is unique. Built on the shared Loop engine.
// The menu size is half the board side (tours need an even side).

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = new Uint8Array(p.R * p.C).fill(1);
    function rule(s, log) {
      for (const e of p.given) {
        if (s[e] === CROSS) return false;
        if (s[e] === UNKNOWN) {
          s[e] = LINE;
          if (log) log.push({ edges: [e], v: LINE, reason: 'This connection is given.' });
          return 1;
        }
      }
      return 0;
    }
    return { g, must, rule };
  }

  function generate(half) {
    const n = 2 * half;
    const sol = Loop.randomTour(n);
    const p = { R: n, C: n, given: [] };
    const lines = [...sol.keys()].filter((e) => sol[e] === LINE);
    // Give connections where another tour differs, until unique.
    for (let guard = 0; guard < lines.length; guard++) {
      const res = Loop.solve(model(p), 2, 20000);
      if (res.solutions.length === 1 && !res.capped) break;
      const other = res.solutions.find((x) => x.some((v, e) => v !== sol[e]));
      const opts = lines.filter((e) => !p.given.includes(e) && (!other || other[e] !== LINE));
      p.given.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    // Drop givens that are not needed.
    for (const e of PuzzleShell.shuffle(p.given.slice())) {
      p.given = p.given.filter((x) => x !== e);
      const res = Loop.solve(model(p), 2, 20000);
      if (res.solutions.length !== 1 || res.capped) p.given.push(e);
    }
    p.given.sort((a, b) => a - b);
    p.solution = sol;
    return p;
  }

  Loop.startGame({
    id: 'grand-tour',
    name: 'Grand Tour',
    rules: 'Draw one closed loop that visits every point exactly once. It moves only up, down, left and right. ' +
      'The dark connections are given and belong to the loop.',
    size: { min: 2, max: 5, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'A grand tour of every point — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, e: p.given.join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      const E = Loop.grid(n, n).E;
      const given = String(d.e || '').split(',').filter(Boolean).map(Number);
      if (given.some((e) => !(e >= 0 && e < E))) throw new Error('Invalid connections');
      return { R: n, C: n, given };
    },
    model,
    fixed: (p) => p.given,
    drawCell: () => (svg, k, x, y, s) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', Math.max(2.5, s * 0.07));
      c.setAttribute('class', 'lp-dot');
      svg.appendChild(c);
    },
  });
})();
