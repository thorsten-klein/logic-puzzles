// Yajilin. Draw one loop through cell centres. Every cell without an
// arrow is either on the loop or black; black cells never touch by a
// side. An arrow clue tells how many black cells lie in its direction.
// Built on the shared Loop engine. A black cell is a cell the loop
// does not use (all its edges crossed).

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;
  const DIRS = { u: [-1, 0], d: [1, 0], l: [0, -1], r: [0, 1] };
  const ARROW = { u: '↑', d: '↓', l: '←', r: '→' };

  function model(p) {
    const { R, C, clues } = p;
    const g = Loop.grid(R, C);
    const isArrow = (k) => !!clues[k];
    const edges = (k) => g.cellEdges[k].filter((e) => e >= 0);
    const black = (s, k) => !isArrow(k) && edges(k).every((e) => s[e] === CROSS);
    const onLoop = (s, k) => edges(k).some((e) => s[e] === LINE);
    const nbs = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const ray = (k, d) => {
      const [dr, dc] = DIRS[d], out = [];
      let r = Math.floor(k / C) + dr, c = (k % C) + dc;
      while (r >= 0 && c >= 0 && r < R && c < C) { if (!isArrow(r * C + c)) out.push(r * C + c); r += dr; c += dc; }
      return out;
    };
    const rays = [];
    for (let k = 0; k < R * C; k++) if (clues[k]) rays.push([k, clues[k].n, ray(k, clues[k].d)]);

    // A cell that must be on the loop: set its edges if only two are left.
    const needLoop = (s, k, log, why) => {
      const es = edges(k);
      const lines = es.filter((e) => s[e] === LINE).length, open = es.filter((e) => s[e] === UNKNOWN);
      if (lines + open.length < 2) return false;
      if (lines < 2 && lines + open.length === 2) {
        for (const e of open) s[e] = LINE;
        if (log) log.push({ edges: open, v: LINE, reason: why, at: k });
        return open.length;
      }
      return 0;
    };

    function rule(s, log) {
      for (let k = 0; k < R * C; k++) {
        if (isArrow(k)) {
          const open = edges(k).filter((e) => s[e] !== CROSS);
          if (open.some((e) => s[e] === LINE)) return false;
          if (open.length) {
            for (const e of open) s[e] = CROSS;
            if (log) log.push({ edges: open, v: CROSS, reason: 'The loop never passes through an arrow cell.', at: k });
            return open.length;
          }
          continue;
        }
        if (!black(s, k)) continue;
        // Black: neighbours are not black, so they are on the loop.
        for (const j of nbs(k)) {
          if (isArrow(j)) continue;
          if (black(s, j)) return false;
          const r = needLoop(s, j, log, 'Black cells never touch. This cell must be on the loop, and only two sides are open.');
          if (r === false) return false;
          if (r) return r;
        }
      }
      for (const [, n, cells] of rays) {
        const known = cells.filter((j) => black(s, j)).length;
        const maybe = cells.filter((j) => !black(s, j) && !onLoop(s, j)).length;
        if (known > n || known + maybe < n) return false;
        if (known === n) {
          for (const j of cells) {
            if (black(s, j) || onLoop(s, j)) continue;
            const r = needLoop(s, j, log, `This arrow already sees its ${n} black cell${n === 1 ? '' : 's'}. The other cells that way are on the loop.`);
            if (r === false) return false;
            if (r) return r;
          }
        }
      }
      return 0;
    }
    return { g, must: null, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.55, Math.random() < 0.5);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const on = (k) => g.cellEdges[k].some((e) => e >= 0 && loop[e] === LINE);
      const off = [...new Array(n * n).keys()].filter((k) => !on(k));
      // Arrows break up touching off-loop cells; a few extra for clues.
      const arrow = new Uint8Array(n * n);
      for (const k of PuzzleShell.shuffle(off.slice())) {
        const r = Math.floor(k / n), c = k % n;
        const touching = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !on(a * n + b) && !arrow[a * n + b]);
        if (touching || Math.random() < 0.15) arrow[k] = 1;
      }
      const blackCell = (k) => !on(k) && !arrow[k];
      const clues = new Array(n * n).fill(null);
      for (let k = 0; k < n * n; k++) {
        if (!arrow[k]) continue;
        // Point where the arrow sees the most black cells (ties random).
        let best = null;
        for (const d of PuzzleShell.shuffle(['u', 'd', 'l', 'r'])) {
          const [dr, dc] = DIRS[d];
          let r = Math.floor(k / n) + dr, c = (k % n) + dc, cnt = 0, cells = 0;
          while (r >= 0 && c >= 0 && r < n && c < n) { if (blackCell(r * n + c)) cnt++; cells++; r += dr; c += dc; }
          if (cells && (!best || cnt > best.n)) best = { d, n: cnt };
        }
        clues[k] = best || { d: 'u', n: 0 };
      }
      const p = { R: n, C: n, clues };
      if (!Loop.solvedBy(Loop.logicSolve(model(p)))) {
        const res = Loop.solve(model(p), 2, 20000);
        if (res.solutions.length !== 1 || res.capped) continue;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'yajilin',
    name: 'Yajilin',
    rules: 'Draw one closed loop through the centres of cells. It never enters an arrow cell. Every other cell is either ' +
      'on the loop or black (a cell the loop skips is black). Black cells never touch by a side. ' +
      'An arrow tells how many black cells lie in its direction.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Loop and shadows in place — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: p.clues.map((x) => (x ? x.d + x.n.toString(36) : '..')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid clues');
      const clues = Array.from({ length: R * C }, (_, k) => {
        const t = d.g.slice(2 * k, 2 * k + 2);
        if (t === '..') return null;
        if (!DIRS[t[0]]) throw new Error('Invalid clue');
        return { d: t[0], n: Number.parseInt(t[1], 36) };
      });
      return { R, C, clues };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s, state) => {
      const cl = p.clues[k];
      const NS = 'http://www.w3.org/2000/svg';
      if (!cl) {
        // A cell the loop skips (all sides crossed) is black.
        const g = Loop.grid(p.R, p.C);
        if (g.cellEdges[k].every((e) => e < 0 || state[e] === CROSS)) {
          const b = document.createElementNS(NS, 'rect');
          b.setAttribute('x', x - s / 2 + 2); b.setAttribute('y', y - s / 2 + 2);
          b.setAttribute('width', s - 4); b.setAttribute('height', s - 4);
          b.setAttribute('class', 'yj-black');
          svg.appendChild(b);
        }
        return;
      }
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', x - s / 2 + 1); bg.setAttribute('y', y - s / 2 + 1);
      bg.setAttribute('width', s - 2); bg.setAttribute('height', s - 2);
      bg.setAttribute('class', 'yj-clue-bg');
      svg.appendChild(bg);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('font-size', s * 0.36);
      t.setAttribute('class', 'yj-clue');
      t.textContent = `${cl.n}${ARROW[cl.d]}`;
      svg.appendChild(t);
    },
  });
})();
