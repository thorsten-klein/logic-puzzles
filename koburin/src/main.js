// Koburin. Shade some cells and draw one loop through the centres of all
// other cells. Numbered cells are neither shaded nor on the loop; a
// number tells how many of its four neighbours are shaded. Shaded cells
// never touch by a side. Built on the shared Loop engine: a cell without
// a number and without any line is a shaded cell.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, clues } = p;
    const g = Loop.grid(R, C);
    const N = R * C;
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const edgesOf = (k) => g.cellEdges[k].filter((e) => e >= 0);
    const shaded = (s, k) => clues[k] < 0 && edgesOf(k).every((e) => s[e] === CROSS);
    const onLoop = (s, k) => edgesOf(k).some((e) => s[e] === LINE);
    function rule(s, log) {
      const push = (edges, v, reason, at) => {
        edges.forEach((e) => { s[e] = v; });
        if (log) log.push({ edges, v, reason, at });
        return edges.length;
      };
      // Make cell k a loop cell: if only two sides are open, use both.
      const visit = (k, reason) => {
        const free = edgesOf(k).filter((e) => s[e] !== CROSS);
        if (free.length < 2) return false;
        const open = free.filter((e) => s[e] === UNKNOWN);
        if (free.length === 2 && open.length) return push(open, LINE, reason, k);
        return 0;
      };
      for (let k = 0; k < N; k++) {
        if (clues[k] < 0) continue;
        const own = edgesOf(k).filter((e) => s[e] !== CROSS);
        if (own.some((e) => s[e] === LINE)) return false;
        if (own.length) return push(own, CROSS, 'The loop never enters a numbered cell.', k);
      }
      for (let k = 0; k < N; k++) {
        if (!shaded(s, k)) continue;
        for (const j of nb(k)) {
          if (clues[j] >= 0) continue;
          if (shaded(s, j)) return false;
          const r = visit(j, 'Shaded cells never touch, so the loop must pass through this cell.');
          if (r === false) return false;
          if (r) return r;
        }
      }
      for (let k = 0; k < N; k++) {
        const v = clues[k];
        if (v < 0) continue;
        const cells = nb(k).filter((j) => clues[j] < 0);
        const black = cells.filter((j) => shaded(s, j));
        const maybe = cells.filter((j) => !onLoop(s, j));
        if (black.length > v || maybe.length < v) return false;
        if (black.length === v) {
          for (const j of maybe) {
            if (shaded(s, j)) continue;
            const r = visit(j, `This ${v} already has its shaded neighbours, so the loop passes here.`);
            if (r === false) return false;
            if (r) return r;
          }
        }
        if (maybe.length === v) {
          for (const j of maybe) {
            const open = edgesOf(j).filter((e) => s[e] === UNKNOWN);
            if (open.length) return push(open, CROSS, `This ${v} needs all of these neighbours shaded.`, k);
          }
        }
      }
      return 0;
    }
    return { g, must: null, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.55);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const N = n * n;
      const on = (k) => g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE);
      // Cells off the loop: some shaded (never side by side), the rest numbered.
      const black = new Uint8Array(N);
      const nb = (k) => { const r = Math.floor(k / n), c = k % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) if (!on(k) && nb(k).every((j) => !black[j]) && Math.random() < 0.6) black[k] = 1;
      const clues = new Int8Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (!on(k) && !black[k]) clues[k] = nb(k).filter((j) => black[j]).length;
      const p = { R: n, C: n, clues };
      // Unique: by logic alone, else proven by the full solver.
      if (!Loop.solvedBy(Loop.logicSolve(model(p)))) {
        const r = Loop.solve(model(p), 2, 3000);
        if (r.solutions.length !== 1 || r.capped) continue;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'koburin',
    name: 'Koburin',
    rules: 'Shade some cells and draw one closed loop through the centres of all other cells. Numbered cells are neither ' +
      'shaded nor on the loop; a number tells how many of its four neighbours are shaded. Shaded cells must never touch by a side. ' +
      'A cell with crosses on all its sides counts as shaded.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Loop and shade in harmony — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    drawCell: (p) => {
      const g = Loop.grid(p.R, p.C);
      return (svg, k, x, y, s, state) => {
        const NS = 'http://www.w3.org/2000/svg';
        const box = (cls) => {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x - s / 2 + 1); r.setAttribute('y', y - s / 2 + 1);
          r.setAttribute('width', s - 2); r.setAttribute('height', s - 2);
          r.setAttribute('class', cls);
          svg.appendChild(r);
        };
        if (p.clues[k] >= 0) {
          box('kb-clue');
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.45);
          t.setAttribute('class', 'ls-clue');
          t.textContent = p.clues[k];
          svg.appendChild(t);
          return;
        }
        // Shaded once all sides are crossed (or off the loop in the solution).
        const es = g.cellEdges[k].filter((e) => e >= 0);
        if (state && es.every((e) => state[e] === CROSS)) box('kb-black');
      };
    },
  });
})();
