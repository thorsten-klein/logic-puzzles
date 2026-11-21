// Konarupu (Corner Loop). Draw one loop along the dots. A number in a
// cell tells how many of the cell's four corner dots the loop turns at.
// Built on the shared Loop engine: the dots are the engine's "cells"
// (an (n+1) x (n+1) grid); numbers sit between four dots.

(() => {
  const { LINE, CROSS } = Loop;

  function model(p) {
    const { n, clues } = p;
    const D = n + 1;
    const g = Loop.grid(D, D);
    // Turn at dot k: 1 turn, 0 no turn (straight or unused), -1 unknown.
    const turnOf = (s, k) => {
      const [u, d, l, r] = g.cellEdges[k];
      const on = (e) => e >= 0 && s[e] === LINE, off = (e) => e < 0 || s[e] === CROSS;
      if ((on(u) || on(d)) && (on(l) || on(r))) return 1;
      if ((off(u) && off(d)) || (off(l) && off(r))) return 0;
      if (g.cellEdges[k].every(off)) return 0;
      return -1;
    };
    const corners = (k) => {
      const r = Math.floor(k / n), c = k % n;
      return [r * D + c, r * D + c + 1, (r + 1) * D + c, (r + 1) * D + c + 1];
    };
    function rule(s) {
      for (let k = 0; k < n * n; k++) {
        const v = clues[k];
        if (v < 0) continue;
        let turns = 0, open = 0;
        for (const d of corners(k)) { const t = turnOf(s, d); if (t === 1) turns++; else if (t < 0) open++; }
        if (turns > v || turns + open < v) return false;
      }
      return 0;
    }
    return { g, must: null, rule, turnOf, corners };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const D = n + 1;
      const loop = Loop.randomLoop(D, D, 0.5, Math.random() < 0.5);
      if (!loop) continue;
      const p = { n, R: D, C: D, clues: new Int8Array(n * n) };
      const m = model(p);
      for (let k = 0; k < n * n; k++) p.clues[k] = m.corners(k).filter((d) => m.turnOf(loop, d) === 1).length;
      const unique = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[k];
        p.clues[k] = -1;
        if (!unique()) p.clues[k] = keep;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'konarupu',
    name: 'Konarupu',
    rules: 'Draw one closed loop from dot to dot, moving up, down, left or right. ' +
      'A number in a cell tells at how many of its four corner dots the loop turns.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'Every corner counted — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      return { n, R: n + 1, C: n + 1, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      const D = p.n + 1, r = Math.floor(k / D), c = k % D;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', Math.max(2.5, s * 0.07));
      dot.setAttribute('class', 'lp-dot');
      svg.appendChild(dot);
      if (r < p.n && c < p.n && p.clues[r * p.n + c] >= 0) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + s / 2); t.setAttribute('y', y + s / 2);
        t.setAttribute('font-size', s * 0.42);
        t.setAttribute('class', 'kn-num');
        t.textContent = p.clues[r * p.n + c];
        svg.appendChild(t);
      }
    },
  });
})();
