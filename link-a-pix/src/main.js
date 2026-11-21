// Link-a-Pix (Paint by Pairs). Join pairs of equal numbers with a line
// through cell centres. The line covers exactly as many cells as the
// number (both ends counted). A 1 is a path of one cell on its own. Lines
// never cross or share a cell; cells may stay empty.
// Built on the shared Links engine. p.num: 0 none, else the number.

(() => {
  const { LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, num } = p;
    const g = Loop.grid(R, C);
    const label = Int8Array.from(num, (v) => (v > 1 ? v : -1));
    const step = [-C, C, -1, 1];
    function rule(s, log) {
      for (let k = 0; k < R * C; k++) {
        if (num[k] !== 1) continue;
        const own = g.cellEdges[k].filter((e) => e >= 0 && s[e] !== CROSS);
        if (own.some((e) => s[e] === LINE)) return false;
        if (own.length) {
          own.forEach((e) => { s[e] = CROSS; });
          if (log) log.push({ edges: own, v: CROSS, reason: 'A 1 is a path on its own; no line touches it.' });
          return own.length;
        }
      }
      // Path lengths: from each end, count cells along its line.
      for (let k = 0; k < R * C; k++) {
        const v = num[k];
        if (v < 2) continue;
        let x = k, from = -1, len = 1;
        for (let guard = 0; guard < R * C; guard++) {
          const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
          if (d === undefined) break;
          x += step[d];
          from = d ^ 1;
          len++;
        }
        if (len > v) return false;
        if (x !== k && num[x] > 1 && len !== v) return false;
      }
      return 0;
    }
    return { g, label, fill: false, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const used = new Uint8Array(N);
      const num = new Int8Array(N);
      const g = Loop.grid(n, n);
      const state = new Uint8Array(g.E).fill(CROSS);
      const edgeOf = (a, b) => { const [x, y] = [a, b].sort((u, v) => u - v); return y - x === 1 ? Math.floor(x / n) * (n - 1) + (x % n) : n * (n - 1) + x; };
      // Random paths of 2..6 cells, plus some single 1s.
      for (let t = 0; t < N * 4; t++) {
        const want = 1 + Math.floor(Math.random() * 6);
        const k = Math.floor(Math.random() * N);
        if (used[k]) continue;
        const path = [k];
        used[k] = 1;
        for (let s = 1; s < want; s++) {
          const x = path.at(-1), r = Math.floor(x / n), c = x % n;
          const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !used[a * n + b]);
          if (!opts.length) break;
          const [a, b] = opts[Math.floor(Math.random() * opts.length)];
          used[a * n + b] = 1;
          path.push(a * n + b);
        }
        num[path[0]] = path.length;
        num[path.at(-1)] = path.length;
        for (let i = 0; i + 1 < path.length; i++) state[edgeOf(path[i], path[i + 1])] = LINE;
      }
      const p = { R: n, C: n, num };
      if (!Links.unique(model(p), 8000)) continue;
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'link-a-pix',
    name: 'Link-a-Pix',
    rules: 'Join pairs of equal numbers with a line through the centres of cells. The line covers exactly as many cells ' +
      'as the number, both ends counted. A 1 is a path of a single cell. Lines never cross or share a cell; cells may ' +
      'stay empty.',
    size: { min: 4, max: 10, def: 6 },
    solvedText: 'The picture appears — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.num, (v) => (v ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      return { R: n, C: n, num: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number.parseInt(ch, 36))) };
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
