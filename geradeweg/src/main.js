// Geradeweg. Draw one loop through cell centres that visits every
// circle. A number tells the length of the straight stretch through its
// circle. If the loop turns in the circle, both stretches have that
// length. Lengths count steps between cell centres.
// Built on the shared Loop engine. Clues: -1 = none, v > 0 = circle.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;
  // cellEdges order: up, down, left, right. OPP gives the other side.
  const OPP = [1, 0, 3, 2];
  const STEP = (C) => [-C, C, -1, 1];

  function model(p) {
    const { R, C, clues } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(clues, (v) => (v > 0 ? 1 : 0));
    const step = STEP(C);
    // Leg from cell k in direction d (first edge is LINE): its length so
    // far and whether it surely ends there.
    const leg = (s, k, d) => {
      let x = k, len = 0;
      while (true) {
        const e = g.cellEdges[x][d];
        if (e < 0 || s[e] === CROSS) return { len, final: true };
        if (s[e] === UNKNOWN) return { len, final: false };
        x += step[d];
        len++;
      }
    };
    function rule(s) {
      for (let k = 0; k < R * C; k++) {
        const v = clues[k];
        if (v <= 0) continue;
        const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
        const legs = dirs.map((d) => leg(s, k, d));
        for (const l of legs) {
          // Too long in any case (also a straight stretch would be longer).
          if (l.len > v) return false;
        }
        if (dirs.length === 2) {
          if (dirs[0] === OPP[dirs[1]]) {
            const sum = legs[0].len + legs[1].len;
            if (sum > v || (legs[0].final && legs[1].final && sum !== v)) return false;
          } else if (legs.some((l) => l.final && l.len !== v)) return false;
        } else if (dirs.length === 1 && legs[0].final && legs[0].len !== v) {
          // A short leg that ends needs the loop to go straight through.
          const o = g.cellEdges[k][OPP[dirs[0]]];
          if (o < 0 || s[o] === CROSS) return false;
        }
      }
      return 0;
    }
    return { g, must, rule };
  }

  // Number for a loop cell: straight stretch length, or the leg length
  // at a turn when both legs match (else 0).
  function valueAt(g, s, C, k) {
    const step = STEP(C);
    const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
    if (dirs.length !== 2) return 0;
    const len = (d) => { let x = k, n = 0; while (g.cellEdges[x][d] >= 0 && s[g.cellEdges[x][d]] === LINE) { x += step[d]; n++; } return n; };
    const a = len(dirs[0]), b = len(dirs[1]);
    if (dirs[0] === OPP[dirs[1]]) return a + b;
    return a === b ? a : 0;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.5);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const clues = new Int8Array(n * n).fill(-1);
      for (let k = 0; k < n * n; k++) { const v = valueAt(g, loop, n, k); if (v) clues[k] = v; }
      const p = { R: n, C: n, clues };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(n * n).keys()])) {
        if (clues[k] < 0) continue;
        const keep = clues[k];
        clues[k] = -1;
        if (!solved()) clues[k] = keep;
        if (Date.now() > deadline + 4000) break;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'geradeweg',
    name: 'Geradeweg',
    rules: 'Draw one closed loop through the centres of cells. It passes through every circle. ' +
      'A number tells how long the straight stretch through its circle is (in steps between cell centres). ' +
      'If the loop turns in the circle, both stretches have that length.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Straight to the point — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    drawOnTop: true,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (p.clues[k] <= 0) return;
      const NS = 'http://www.w3.org/2000/svg';
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x);
      o.setAttribute('cy', y);
      o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'gw-circle');
      svg.appendChild(o);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y);
      t.setAttribute('font-size', s * 0.32);
      t.setAttribute('class', 'gw-num');
      t.textContent = p.clues[k];
      svg.appendChild(t);
    },
  });
})();
