// Dotchi-Loop. Draw one loop through cell centres. It visits every white
// circle and never enters a black circle. In each room, the loop either
// goes straight through all its white circles or turns at all of them.
// Built on the shared Loop engine.
// p.room: room per cell; p.mark: 0 none, 1 white circle, 2 black circle.

(() => {
  const { LINE, CROSS } = Loop;

  function model(p) {
    const { R, C, room, mark } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(mark, (m) => (m === 1 ? 1 : 0));
    const whites = [];
    mark.forEach((m, k) => { if (m === 1) { whites[room[k]] ??= []; whites[room[k]].push(k); } });
    // 'S' straight, 'T' turn, '' not known yet.
    const shape = (s, k) => {
      const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
      if (dirs.length === 2) return (dirs[0] >> 1) === (dirs[1] >> 1) ? 'S' : 'T';
      if (dirs.length === 1) {
        const opp = g.cellEdges[k][dirs[0] ^ 1];
        if (opp < 0 || s[opp] === CROSS) return 'T';
        const perp = (dirs[0] >> 1) ? [0, 1] : [2, 3];
        if (perp.every((d) => g.cellEdges[k][d] < 0 || s[g.cellEdges[k][d]] === CROSS)) return 'S';
      }
      return '';
    };
    function rule(s, log) {
      for (let k = 0; k < R * C; k++) {
        if (mark[k] !== 2) continue;
        const own = g.cellEdges[k].filter((e) => e >= 0 && s[e] !== CROSS);
        if (own.some((e) => s[e] === LINE)) return false;
        if (own.length) {
          own.forEach((e) => { s[e] = CROSS; });
          if (log) log.push({ edges: own, v: CROSS, reason: 'The loop never enters a black circle.', at: k });
          return own.length;
        }
      }
      for (const cells of whites) {
        if (!cells) continue;
        const kinds = new Set(cells.map((k) => shape(s, k)).filter(Boolean));
        if (kinds.size > 1) return false;
      }
      return 0;
    }
    return { g, must, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.5);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const shapeOf = (k) => {
        const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && loop[g.cellEdges[k][d]] === LINE);
        return dirs.length !== 2 ? '' : (dirs[0] >> 1) === (dirs[1] >> 1) ? 'S' : 'T';
      };
      // Each room picks straight or turn; circles on its loop cells of that kind.
      const mark = new Uint8Array(N);
      const pick = new Map();
      for (let k = 0; k < N; k++) {
        const sh = shapeOf(k);
        if (!sh) { mark[k] = 2; continue; }
        if (!pick.has(room[k])) pick.set(room[k], sh);
        if (pick.get(room[k]) === sh) mark[k] = 1;
      }
      const p = { R: n, C: n, room, mark };
      const solved = () => Loop.solvedBy(Loop.logicSolve(model(p)));
      if (!solved()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!mark[k]) continue;
        const keep = mark[k];
        mark[k] = 0;
        if (!solved()) mark[k] = keep;
        if (Date.now() > deadline + 4000) break;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'dotchi-loop',
    name: 'Dotchi-Loop',
    rules: 'Draw one closed loop through the centres of cells. It visits every white circle and never enters a black ' +
      'circle. In each outlined room, the loop either goes straight through all of its white circles or turns at all of them.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Either way, you found it — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), m: Array.from(p.mark).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 16) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      if (typeof d.m !== 'string' || d.m.length !== n * n || !/^[012]+$/.test(d.m)) throw new Error('Invalid circles');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R: n, C: n, room, mark: Uint8Array.from(d.m, Number) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      const r = Math.floor(k / p.C), c = k % p.C;
      const wall = (x1, y1, x2, y2) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'dl-wall');
        svg.appendChild(l);
      };
      if (c < p.C - 1 && p.room[k + 1] !== p.room[k]) wall(x + s / 2, y - s / 2, x + s / 2, y + s / 2);
      if (r < p.R - 1 && p.room[k + p.C] !== p.room[k]) wall(x - s / 2, y + s / 2, x + s / 2, y + s / 2);
      if (!p.mark[k]) return;
      const o = document.createElementNS(NS, 'circle');
      o.setAttribute('cx', x);
      o.setAttribute('cy', y);
      o.setAttribute('r', s * 0.22);
      o.setAttribute('class', p.mark[k] === 2 ? 'll-black' : 'll-white');
      svg.appendChild(o);
    },
  });
})();
