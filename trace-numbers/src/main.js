// Trace Numbers. Draw one line from every 1. Each line passes the numbers
// 1, 2, 3, ... up to the highest number in that order, and ends there.
// Lines run through cell centres, never cross or share a cell, and every
// cell is used. Built on the shared Links engine.
// p.num: 0 none, else the number in the cell.

(() => {
  const { LINE } = Loop;

  function model(p) {
    const { R, C, num } = p;
    const g = Loop.grid(R, C);
    const top = Math.max(...num);
    // Ends: every 1 and every top number; they pair 1 with top.
    const label = Int8Array.from(num, (v) => (v === 1 ? 0 : v === top ? 0 : -1));
    const step = [-C, C, -1, 1];
    function rule(s) {
      for (let k = 0; k < R * C; k++) {
        if (num[k] !== 1) continue;
        // Walk from the 1: numbers met must go 2, 3, ... in order.
        let x = k, from = -1, want = 2;
        for (let guard = 0; guard < R * C; guard++) {
          const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
          if (d === undefined) break;
          x += step[d];
          from = d ^ 1;
          if (!num[x]) continue;
          if (num[x] !== want) return false;
          want++;
        }
        // A line that reached an end must have met every number.
        if (x !== k && num[x] === top && want !== top + 1) return false;
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
      const top = 3 + Math.floor(Math.random() * 2);
      const { paths, state } = Links.randomPaths(n, top + 1, n + 3);
      const num = new Int8Array(n * n);
      for (const path of paths) {
        // 1 at the start, top at the end, the rest in order between.
        const inner = PuzzleShell.shuffle(Array.from({ length: path.length - 2 }, (_, i) => i + 1)).slice(0, top - 2).sort((a, b) => a - b);
        num[path[0]] = 1;
        inner.forEach((pos, i) => { num[path[pos]] = i + 2; });
        num[path[path.length - 1]] = top;
      }
      const p = { R: n, C: n, num };
      if (!Links.unique(model(p))) continue;
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'trace-numbers',
    name: 'Trace Numbers',
    rules: 'Draw one line from every 1. Each line passes the numbers 1, 2, 3, … up to the highest number, in that order, ' +
      'and ends on the highest number. Lines run through the centres of cells, never cross or share a cell, and every ' +
      'cell is used.',
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Traced from start to end — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.num, (v) => (v ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      return { R: n, C: n, num: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : parseInt(ch, 36))) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.num[k]) return;
      const NS = 'http://www.w3.org/2000/svg';
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.34);
      t.setAttribute('class', 'll-num');
      t.textContent = p.num[k];
      svg.appendChild(t);
    },
  });
})();
