// Mintonette. Join the circles in pairs with lines through cell centres.
// Any two circles may pair up. Lines never cross or share a cell, and
// every cell is used. A number in a circle tells how many times its line
// turns. Built on the shared Links engine.
// p.circle: -1 none, 0 circle without number, v > 0 circle with v - 1 turns.

(() => {
  const { LINE } = Loop;

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const label = Int8Array.from(p.circle, (v) => (v >= 0 ? 0 : -1));
    const step = [-p.C, p.C, -1, 1];
    // Walk from end cell k along its line: turns so far, and the cell
    // where the walk stops.
    const walk = (s, k) => {
      let x = k, from = -1, turns = 0, last = -1;
      for (let guard = 0; guard < p.R * p.C; guard++) {
        const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
        if (d === undefined) return { turns, end: x };
        if (last >= 0 && (d >> 1) !== (last >> 1)) turns++;
        last = d;
        x += step[d];
        from = d ^ 1;
      }
      return { turns, end: x };
    };
    function rule(s) {
      for (let k = 0; k < p.R * p.C; k++) {
        const v = p.circle[k] - 1;
        if (v < 0) continue;
        const w = walk(s, k);
        if (w.turns > v) return -1;
        if (w.end !== k && label[w.end] >= 0 && w.turns !== v) return -1;
        // The partner circle's number (if any) must match too.
        if (w.end !== k && p.circle[w.end] > 0 && p.circle[w.end] !== p.circle[k]) return -1;
      }
      return 0;
    }
    return { g, label, fill: true, rule };
  }

  // The menu size is half the board side (random tours need an even side).
  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const { paths, state } = Links.randomPaths(n, 2, n + 2);
      const circle = new Int8Array(n * n).fill(-1);
      for (const path of paths) {
        let turns = 0;
        for (let i = 1; i + 1 < path.length; i++) {
          const a = path[i] - path[i - 1], b = path[i + 1] - path[i];
          if (a !== b) turns++;
        }
        circle[path[0]] = turns + 1;
        circle[path.at(-1)] = turns + 1;
      }
      const p = { R: n, C: n, circle };
      if (!Links.unique(model(p))) continue;
      for (const k of PuzzleShell.shuffle([...new Array(n * n).keys()])) {
        if (circle[k] <= 0) continue;
        const keep = circle[k];
        circle[k] = 0;
        if (!Links.unique(model(p))) circle[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'mintonette',
    name: 'Mintonette',
    rules: 'Join the circles in pairs with lines through the centres of cells; any two circles may pair up. Lines move ' +
      'up, down, left and right, never cross or share a cell, and every cell is used. A number in a circle tells how ' +
      'many times its line turns.',
    size: { min: 2, max: 4, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Every pair served — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.circle, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid circles');
      return { R: n, C: n, circle: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (p.circle[k] < 0) return;
      const NS = 'http://www.w3.org/2000/svg';
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
      if (!p.circle[k]) return;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.34);
      t.setAttribute('class', 'll-num');
      t.textContent = p.circle[k] - 1;
      svg.appendChild(t);
    },
  });
})();
