// Wamuzu (Worms). Join the circles in pairs with lines through cell
// centres. Every cell is used by a line. Each straight part of a line is
// one cell long: a line turns in every cell it passes through.
// Built on the shared Links engine (every circle may pair with any other).

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function model(p) {
    const g = Loop.grid(p.R, p.C);
    const label = Int8Array.from(p.end, (v) => (v ? 0 : -1));
    // Inside a line, a cell has one across and one down line.
    function rule(s, log) {
      let set = 0;
      for (let k = 0; k < p.R * p.C; k++) {
        if (label[k] >= 0) continue;
        const [up, down, left, right] = g.cellEdges[k];
        for (const [a, b] of [[up, down], [left, right]]) {
          if (a < 0 || b < 0) continue;
          if (s[a] === LINE && s[b] === LINE) return -1;
          const other = s[a] === LINE ? b : s[b] === LINE ? a : -1;
          if (other < 0 || s[other] !== UNKNOWN) continue;
          s[other] = CROSS;
          if (log) { log.push({ edges: [other], v: CROSS, reason: 'A line turns in every cell, so it can not go straight on here.' }); return 1; }
          set++;
        }
      }
      return set;
    }
    return { g, label, fill: true, rule };
  }

  // Random cover by turning paths of 2..maxLen cells (or null).
  function randomCover(n, deadline) {
    const N = n * n;
    const used = new Uint8Array(N);
    const paths = [];
    const free = (r, c) => r >= 0 && c >= 0 && r < n && c < n && !used[r * n + c];
    function grow(path, axis, maxLen) {
      if (Date.now() > deadline) return false;
      if (path.length >= 2 && (path.length === maxLen || Math.random() < 0.35)) {
        paths.push(path.slice());
        if (rec()) return true;
        paths.pop();
      }
      if (path.length >= maxLen) return false;
      const x = path.at(-1), r = Math.floor(x / n), c = x % n;
      const opts = (axis === 0 ? [[0, 1], [0, -1]] : axis === 1 ? [[1, 0], [-1, 0]] : [[0, 1], [1, 0]])
        .filter(([a, b]) => free(r + a, c + b));
      for (const [a, b] of PuzzleShell.shuffle(opts)) {
        const k = (r + a) * n + c + b;
        used[k] = 1;
        path.push(k);
        if (grow(path, a ? 0 : 1, maxLen)) return true;
        path.pop();
        used[k] = 0;
      }
      if (path.length >= 2 && path.length < maxLen) {
        paths.push(path.slice());
        if (rec()) return true;
        paths.pop();
      }
      return false;
    }
    function rec() {
      const k = used.indexOf(0);
      if (k < 0) return true;
      used[k] = 1;
      if (grow([k], 2, 3 + Math.floor(Math.random() * 4))) return true;
      used[k] = 0;
      return false;
    }
    return rec() ? paths : null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const paths = randomCover(n, Math.min(deadline, Date.now() + 500));
      if (!paths) continue;
      const end = new Uint8Array(n * n);
      for (const path of paths) { end[path[0]] = 1; end[path.at(-1)] = 1; }
      const p = { R: n, C: n, end };
      if (!Links.unique(model(p))) continue;
      const g = Loop.grid(n, n);
      const sol = new Uint8Array(g.E).fill(CROSS);
      const edgeOf = new Map(g.ends.map((ab, e) => [ab.join(','), e]));
      for (const path of paths) for (let i = 0; i + 1 < path.length; i++) {
        sol[edgeOf.get([path[i], path[i + 1]].sort((a, b) => a - b).join(','))] = LINE;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'wamuzu',
    name: 'Wamuzu',
    rules: 'Join the circles in pairs with lines through the centres of cells. Every cell is used by a line. Each straight ' +
      'part of a line is just one cell long: a line turns in every cell it passes through.',
    size: { min: 4, max: 6, def: 6 },
    solvedText: 'All worms wriggling — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, e: Array.from(p.end).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 14) throw new Error('Invalid board size');
      if (typeof d.e !== 'string' || d.e.length !== n * n || !/^[01]+$/.test(d.e)) throw new Error('Invalid circles');
      return { R: n, C: n, end: Uint8Array.from(d.e, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      if (!p.end[k]) return;
      const o = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.22);
      o.setAttribute('class', 'll-white');
      svg.appendChild(o);
    },
  });
})();
