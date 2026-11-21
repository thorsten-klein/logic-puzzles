// Purenrupu (Pure Loop). Draw one loop that visits every white cell
// exactly once. Black cells are never visited. Built on the Loop engine.

(() => {
  const { LINE, CROSS } = Loop;

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = Uint8Array.from(p.black, (b) => (b ? 0 : 1));
    function rule(s, log) {
      for (let k = 0; k < p.R * p.C; k++) {
        if (!p.black[k]) continue;
        const open = g.cellEdges[k].filter((e) => e >= 0 && s[e] !== CROSS);
        if (open.some((e) => s[e] === LINE)) return false;
        if (open.length) {
          for (const e of open) s[e] = CROSS;
          if (log) log.push({ edges: open, v: CROSS, reason: 'The loop never enters a black cell.', at: k });
          return open.length;
        }
      }
      return 0;
    }
    return { g, must, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.7, true);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const black = Uint8Array.from({ length: n * n }, (_, k) => (g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE) ? 0 : 1));
      const p = { R: n, C: n, black };
      if (!Loop.solvedBy(Loop.logicSolve(model(p)))) {
        const res = Loop.solve(model(p), 2, 20000);
        if (res.solutions.length !== 1 || res.capped) continue;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'purenrupu',
    name: 'Purenrupu',
    rules: 'Draw one closed loop through the centres of cells. It visits every white cell exactly once and never enters a black cell.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'A pure loop — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, b: Array.from(p.black).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.b !== 'string' || d.b.length !== R * C || !/^[01]+$/.test(d.b)) throw new Error('Invalid grid');
      return { R, C, black: Uint8Array.from(d.b, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.black[k]) return;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x - s / 2);
      r.setAttribute('y', y - s / 2);
      r.setAttribute('width', s);
      r.setAttribute('height', s);
      r.setAttribute('class', 'lp-black');
      svg.appendChild(r);
    },
  });
})();
