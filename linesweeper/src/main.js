// Linesweeper. Draw one loop through cell centres. Numbered cells are
// not crossed; a number tells how many of the eight cells around it the
// loop passes through. Built on the shared Loop engine.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, clues } = p;
    const g = Loop.grid(R, C);
    const around = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
      }
      return out;
    };
    const near = Array.from(clues, (v, k) => (v >= 0 ? around(k) : null));

    function rule(s, log) {
      const edgesOf = (k) => g.cellEdges[k].filter((e) => e >= 0);
      const on = (k) => edgesOf(k).some((e) => s[e] === LINE);
      const off = (k) => edgesOf(k).every((e) => s[e] === CROSS);
      const push = (edges, v, reason, at) => {
        for (const e of edges) s[e] = v;
        if (log) log.push({ edges, v, reason, at });
        return edges.length;
      };
      for (let k = 0; k < R * C; k++) {
        const v = clues[k];
        if (v < 0) continue;
        // The clue cell itself is never crossed.
        const own = edgesOf(k).filter((e) => s[e] !== CROSS);
        if (own.some((e) => s[e] === LINE)) return false;
        if (own.length) return push(own, CROSS, 'The loop never passes through a numbered cell.', k);
        const cells = near[k];
        const yes = cells.filter(on);
        const open = cells.filter((j) => !on(j) && !off(j));
        if (yes.length > v || yes.length + open.length < v) return false;
        if (!open.length) continue;
        if (yes.length === v) {
          const es = [...new Set(open.flatMap(edgesOf))].filter((e) => s[e] === UNKNOWN);
          if (es.length) {
            return push(es, CROSS, v === 0 ? 'A 0 means the loop avoids every cell around it.'
              : `This ${v} already sees the loop in ${v} cell${v === 1 ? '' : 's'}. The loop avoids the other cells around it.`, k);
          }
        }
        if (yes.length + open.length === v) {
          for (const j of open) {
            const es = edgesOf(j);
            const lines = es.filter((e) => s[e] === LINE).length;
            const free = es.filter((e) => s[e] === UNKNOWN);
            if (lines + free.length < 2) return false;
            if (lines + free.length === 2 && free.length) {
              return push(free, LINE, `This ${v} needs the loop in every open cell around it. This cell has only two ways in and out.`, k);
            }
          }
        }
      }
      return 0;
    }
    return { g, must: null, rule };
  }

  function generate(n) {
    for (let t = 0; t < 40; t++) {
      const loop = Loop.randomLoop(n, n, 0.5);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const onLoop = (k) => g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE);
      const clues = new Int8Array(n * n).fill(-1);
      for (let k = 0; k < n * n; k++) {
        if (onLoop(k)) continue;
        const r = Math.floor(k / n), c = k % n;
        let v = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if ((dr || dc) && nr >= 0 && nc >= 0 && nr < n && nc < n && onLoop(nr * n + nc)) v++;
        }
        clues[k] = v;
      }
      const p = { R: n, C: n, clues };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...Array(n * n).keys()])) {
        if (clues[k] < 0) continue;
        const keep = clues[k];
        clues[k] = -1;
        if (!solved()) clues[k] = keep;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'linesweeper',
    name: 'Linesweeper',
    rules: 'Draw one closed loop through the centres of cells. The loop never enters a numbered cell. ' +
      'A number tells how many of the eight cells around it the loop passes through.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'The loop is clear — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-8]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (p.clues[k] < 0) return;
      const NS = 'http://www.w3.org/2000/svg';
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', x - s / 2 + 1);
      bg.setAttribute('y', y - s / 2 + 1);
      bg.setAttribute('width', s - 2);
      bg.setAttribute('height', s - 2);
      bg.setAttribute('class', 'ls-clue-bg');
      svg.appendChild(bg);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y);
      t.setAttribute('font-size', s * 0.45);
      t.setAttribute('class', 'ls-clue');
      t.textContent = p.clues[k];
      svg.appendChild(t);
    },
  });
})();
