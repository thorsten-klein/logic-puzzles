// Detour. Draw one loop that visits every cell. A number in a region
// tells how many times the loop turns inside that region.
// Built on the shared Loop engine. Menu size is half the board side.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const must = new Uint8Array(p.R * p.C).fill(1);
    const list = groups(p.region);
    // Turn state of a cell: 1 turn, 0 straight, -1 not known yet.
    const turnOf = (s, k) => {
      const [u, d, l, r] = g.cellEdges[k];
      const on = (e) => e >= 0 && s[e] === LINE;
      const off = (e) => e < 0 || s[e] === CROSS;
      if ((on(u) || on(d)) && (on(l) || on(r))) return 1;
      if ((on(u) && on(d)) || (on(l) && on(r))) return 0;
      if ((off(u) && off(d)) || (off(l) && off(r))) return 0;
      if ((off(u) || off(d)) && (off(l) || off(r))) return 1;
      return -1;
    };
    function rule(s) {
      for (let i = 0; i < list.length; i++) {
        const v = p.clues[i];
        if (v < 0) continue;
        let turns = 0, open = 0;
        for (const k of list[i]) {
          const t = turnOf(s, k);
          if (t === 1) turns++;
          else if (t === -1) open++;
        }
        if (turns > v || turns + open < v) return false;
      }
      return 0;
    }
    return { g, must, rule };
  }

  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sol = Loop.randomTour(n);
      const seeds = PuzzleShell.shuffle([...new Array(n * n).keys()]).slice(0, Math.round((n * n) / 5));
      const region = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const g = Loop.grid(n, n);
      const p = { R: n, C: n, region, clues: groups(region).map((cells) => cells.filter((k) => {
        const [u, d, l, r] = g.cellEdges[k];
        const on = (e) => e >= 0 && sol[e] === LINE;
        return (on(u) || on(d)) && (on(l) || on(r));
      }).length) };
      const unique = () => { const r = Loop.solve(model(p), 2, 20000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const i of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[i];
        p.clues[i] = -1;
        if (!unique()) p.clues[i] = keep;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'detour',
    name: 'Detour',
    rules: 'Draw one closed loop through the centres of all cells, visiting every cell exactly once. ' +
      'A number in a region tells how many times the loop turns inside that region.',
    size: { min: 2, max: 3, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Every turn counted — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), c: p.clues.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid regions');
      const region = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = String(d.c).split(',').map(Number);
      return { R: n, C: n, region, clues };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      const { R, C, region } = p;
      const r = Math.floor(k / C), c = k % C;
      const x0 = x - s / 2, y0 = y - s / 2;
      const wall = (x1, y1, x2, y2) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'lp-wall');
        svg.appendChild(l);
      };
      if (c < C - 1 && region[k + 1] !== region[k]) wall(x0 + s, y0, x0 + s, y0 + s);
      if (r < R - 1 && region[k + C] !== region[k]) wall(x0, y0 + s, x0 + s, y0 + s);
      const id = region[k];
      if (region.indexOf(id) === k && p.clues[id] >= 0) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 + 4);
        t.setAttribute('y', y0 + s * 0.3);
        t.setAttribute('font-size', s * 0.3);
        t.setAttribute('class', 'lp-num');
        t.textContent = p.clues[id];
        svg.appendChild(t);
      }
    },
  });
})();
