// Arukone (Number Link). Join each pair of equal numbers with one line
// through cell centres. Lines never cross or share a cell, and every
// cell is used. Built on the shared Links engine.

(() => {
  function model(p) {
    return { g: Loop.grid(p.R, p.C), label: p.label, fill: true };
  }

  // The menu size is half the board side (random tours need an even side).
  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const { paths, state } = Links.randomPaths(n, 3, Math.max(4, n + 1));
      const label = new Int8Array(n * n).fill(-1);
      paths.forEach((path, i) => { label[path[0]] = i + 1; label[path[path.length - 1]] = i + 1; });
      const p = { R: n, C: n, label };
      if (!Links.unique(model(p))) continue;
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'arukone',
    name: 'Arukone',
    rules: 'Join each pair of equal numbers with one line through the centres of cells. Lines move up, down, left and ' +
      'right; they never cross or share a cell. Every cell is used by a line.',
    size: { min: 2, max: 4, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'All pairs linked — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.label, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      return { R: n, C: n, label: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : parseInt(ch, 36))) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (p.label[k] < 0) return;
      const NS = 'http://www.w3.org/2000/svg';
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.3);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.34);
      t.setAttribute('class', 'll-num');
      t.textContent = p.label[k];
      svg.appendChild(t);
    },
  });
})();
