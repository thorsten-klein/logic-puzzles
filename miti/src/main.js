// Miti (Road). All cells form one closed road, one cell wide: draw a loop
// through the centres of all cells. Think of the cell borders the road
// does not cross as walls; the frame is a wall too. At a dot exactly
// three walls meet; at every other grid point at most two walls meet.
// Built on the shared Loop engine. p.dot: one flag per grid point,
// (n + 1) × (n + 1).

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  // Grid points (i, j), 0..n each, without the four frame corners. For
  // each: the loop edges crossing its inner borders, and how many border
  // pieces meet there (frame pieces count as walls).
  function points(n) {
    const H = (a, b) => a * (n - 1) + b, V = (a, b) => n * (n - 1) + a * n + b;
    const out = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const edgeI = i === 0 || i === n, edgeJ = j === 0 || j === n;
      if (edgeI && edgeJ) continue;
      const es = [];
      if (i > 0 && j > 0 && j < n) es.push(H(i - 1, j - 1));
      if (i < n && j > 0 && j < n) es.push(H(i, j - 1));
      if (j > 0 && i > 0 && i < n) es.push(V(i - 1, j - 1));
      if (j < n && i > 0 && i < n) es.push(V(i - 1, j));
      out.push({ k: i * (n + 1) + j, es, pieces: edgeI || edgeJ ? 3 : 4 });
    }
    return out;
  }

  function model(p) {
    const { R: n, dot } = p;
    const g = Loop.grid(n, n);
    const must = new Uint8Array(n * n).fill(1);
    const pts = points(n);
    function rule(s, log) {
      let changed = 0;
      for (const { k, es, pieces } of pts) {
        const lines = es.filter((e) => s[e] === LINE).length, open = es.filter((e) => s[e] === UNKNOWN);
        if (dot[k]) {
          // Three walls: the road crosses pieces - 3 borders here.
          const need = pieces - 3;
          if (lines > need || lines + open.length < need) return -1;
          if (!open.length) continue;
          const v = lines === need ? CROSS : lines + open.length === need ? LINE : 0;
          if (!v) continue;
          for (const e of open) s[e] = v;
          if (log) { log.push({ edges: open, v, reason: v === CROSS ? 'Three walls meet at this dot, so the road crosses no more borders here.' : 'Three walls meet at this dot, so the road must cross the open borders here.' }); return 1; }
          changed++;
        } else {
          const need = pieces - 2;
          if (lines + open.length < need) return -1;
          if (open.length && lines + open.length === need) {
            for (const e of open) s[e] = LINE;
            if (log) { log.push({ edges: open, v: LINE, reason: 'At most two walls meet at a point without a dot, so the road must cross the open borders here.' }); return 1; }
            changed++;
          }
        }
      }
      return changed;
    }
    return { g, must, rule };
  }

  // Random 2×2 flips that keep one loop through all cells.
  function mixTour(n) {
    const s = Loop.randomTour(n);
    const g = Loop.grid(n, n);
    const H = (a, b) => a * (n - 1) + b, V = (a, b) => n * (n - 1) + a * n + b;
    const oneLoop = () => {
      let x = 0, prev = -1, len = 0;
      do {
        const e = g.cellEdges[x].find((f) => f >= 0 && s[f] === LINE && !g.ends[f].includes(prev));
        const [a, b] = g.ends[e];
        prev = x;
        x = a === x ? b : a;
        len++;
      } while (x !== 0 && len <= n * n);
      return len === n * n;
    };
    for (let t = 0; t < n * n * 30; t++) {
      const r = Math.floor(Math.random() * (n - 1)), c = Math.floor(Math.random() * (n - 1));
      const es = [H(r, c), H(r + 1, c), V(r, c), V(r, c + 1)];
      const hz = s[es[0]] === LINE && s[es[1]] === LINE && s[es[2]] === CROSS && s[es[3]] === CROSS;
      const vt = s[es[2]] === LINE && s[es[3]] === LINE && s[es[0]] === CROSS && s[es[1]] === CROSS;
      if (!hz && !vt) continue;
      for (const e of es) s[e] = s[e] === LINE ? CROSS : LINE;
      if (!oneLoop()) for (const e of es) s[e] = s[e] === LINE ? CROSS : LINE;
    }
    return s;
  }

  // Dots for a tour, or null if some point has four walls.
  function dotsOf(n, tour) {
    const dot = new Uint8Array((n + 1) * (n + 1));
    for (const { k, es, pieces } of points(n)) {
      const walls = pieces - es.filter((e) => tour[e] === LINE).length;
      if (walls > 3) return null;
      if (walls === 3) dot[k] = 1;
    }
    return dot;
  }

  // The best of a few unique boards: the one with the most dots.
  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 6000;
    let best = null;
    for (let t = 0; t < 40 && Date.now() < deadline; t++) {
      const tour = mixTour(n);
      const dot = dotsOf(n, tour);
      if (!dot) continue;
      const count = dot.reduce((a, b) => a + b, 0);
      if (best && count <= best.count) continue;
      const p = { R: n, C: n, dot };
      if (!Loop.solvedBy(Loop.logicSolve(model(p)))) {
        const r = Loop.solve(model(p), 2, 5000);
        if (r.solutions.length !== 1 || r.capped) continue;
      }
      p.solution = tour;
      best = { p, count };
    }
    return best ? best.p : null;
  }

  Loop.startGame({
    id: 'miti',
    name: 'Miti',
    rules: 'All cells form one closed road, one cell wide: draw a loop through the centres of all cells. The cell borders ' +
      'the road does not cross are walls, and so is the outer frame. At each dot exactly three walls meet; at every other ' +
      'grid point at most two walls meet.',
    size: { min: 3, max: 5, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'One road through it all — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, d: Array.from(p.dot).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 16 || n % 2) throw new Error('Invalid board size');
      if (typeof d.d !== 'string' || d.d.length !== (n + 1) * (n + 1) || !/^[01]+$/.test(d.d)) throw new Error('Invalid dots');
      return { R: n, C: n, dot: Uint8Array.from(d.d, Number) };
    },
    model,
    // Each cell draws the dots at its top-left corner; the last row and
    // column also draw their other corners.
    drawCell: (p) => (svg, k, x, y, s) => {
      const n = p.R, r = Math.floor(k / n), c = k % n;
      const spots = [[r, c, -1, -1]];
      if (c === n - 1) spots.push([r, c + 1, 1, -1]);
      if (r === n - 1) spots.push([r + 1, c, -1, 1]);
      if (r === n - 1 && c === n - 1) spots.push([r + 1, c + 1, 1, 1]);
      for (const [i, j, dx, dy] of spots) {
        if (!p.dot[i * (n + 1) + j]) continue;
        const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        o.setAttribute('cx', x + dx * s / 2); o.setAttribute('cy', y + dy * s / 2); o.setAttribute('r', s * 0.11);
        o.setAttribute('class', 'mi-dot');
        svg.appendChild(o);
      }
    },
    drawOnTop: true,
  });
})();
